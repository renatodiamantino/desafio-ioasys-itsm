import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ssoCallbackSchema, ssoConfigSchema } from '@itsm/shared';
import { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SsoService } from './sso.service';

@ApiTags('SSO (US-003)')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('config')
  @ApiOperation({ summary: 'Consulta status público do SSO para tela de login' })
  async getPublicConfig() {
    return this.ssoService.getPublicConfig();
  }

  @Get('admin-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta configuração do IdP SSO (somente admin)' })
  async getAdminConfig() {
    return this.ssoService.getAdminConfig();
  }

  @Put('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configura IdP SAML/OIDC e ativa SSO corporativo (somente admin)' })
  async saveConfig(
    @Body() body: unknown,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const parsed = ssoConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.ssoService.saveConfig(parsed.data, actor.id);
  }

  @Get('login')
  @ApiOperation({ summary: 'Gera URL de redirecionamento para autenticação no IdP' })
  async login(@Query('redirectUri') redirectUri?: string) {
    return this.ssoService.getLoginRedirectUrl(
      redirectUri || 'http://localhost:3000/login',
    );
  }

  @Post('callback')
  @ApiOperation({ summary: 'Processa callback/asserção do IdP com JIT provisioning e emite JWT' })
  async callback(@Body() body: unknown) {
    const parsed = ssoCallbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.ssoService.authenticateViaSso(parsed.data);
  }
}
