import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  organizationSetupSchema,
  organizationUpdateSchema,
} from '@itsm/shared';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationService } from './organization.service';

@ApiTags('Organization (US-001)')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'Consulta status e configurações da empresa' })
  async getStatus() {
    return this.organizationService.getStatus();
  }

  @Post('setup')
  @ApiOperation({ summary: 'Executa wizard inicial da instância e cria primeiro admin' })
  async setup(@Body() body: unknown) {
    const parsed = organizationSetupSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.organizationService.setup(parsed.data);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza configurações gerais da empresa (somente admin)' })
  async update(@Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    const parsed = organizationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.organizationService.update(parsed.data, actor.id);
  }
}
