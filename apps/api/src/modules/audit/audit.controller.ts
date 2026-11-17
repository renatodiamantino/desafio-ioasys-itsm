import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { auditLogsQuerySchema } from '@itsm/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';

/**
 * Somente leitura: audit_logs é estritamente append-only (sem POST/PUT/PATCH/DELETE).
 */
@ApiTags('Audit (US-006)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Consulta paginada e filtrada dos logs de auditoria (admin/manager)' })
  async findAll(@Query() query: Record<string, unknown>) {
    const parsed = auditLogsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.auditService.findAll(parsed.data);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Lista histórico cronológico de alterações de uma entidade' })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', new ParseUUIDPipe()) entityId: string,
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }
}
