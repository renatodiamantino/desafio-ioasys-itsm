import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  assignUserRolesSchema,
  loginSchema,
  mfaVerifySchema,
  refreshTokenSchema,
  updateLocaleSchema,
} from '@itsm/shared';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('Auth & RBAC (US-002, US-005)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário com e-mail e senha' })
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.login(parsed.data);
  }

  @Post('mfa/verify')
  @ApiOperation({ summary: 'Validar código TOTP de 6 dígitos para concluir login' })
  async verifyMfa(@Body() body: unknown) {
    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.verifyMfa(parsed.data);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ativar MFA TOTP para o usuário autenticado' })
  async setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user.id);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renovar accessToken usando refreshToken' })
  async refresh(@Body() body: unknown) {
    const parsed = refreshTokenSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.refresh(parsed.data.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna usuário autenticado e seus papéis' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Patch('me/locale')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alterna idioma preferido do usuário (pt-BR, en, es)' })
  async updateLocale(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateLocaleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.updateLocale(user.id, parsed.data.locale);
  }

  @Put('users/:id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atribuir papéis a um usuário (somente admin)' })
  async assignRoles(
    @Param('id') targetUserId: string,
    @Body() body: unknown,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const parsed = assignUserRolesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.assignUserRoles(targetUserId, parsed.data.roleCodes, actor.id);
  }
}
