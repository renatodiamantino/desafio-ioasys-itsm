import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addTaskCommentSchema,
  createIncidentSchema,
  linkChildIncidentsSchema,
  resolveIncidentSchema,
  updateIncidentSchema,
} from '@itsm/shared';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IncidentsService } from './incidents.service';

@ApiTags('Incidents (E02)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  private isEndUser(user: AuthenticatedUser): boolean {
    return !user.roles.some((r) => ['agent', 'manager', 'admin'].includes(r));
  }

  @Get('catalog/lookups')
  @ApiOperation({ summary: 'Retorna categorias, códigos de resolução, motivos, grupos e usuários' })
  getLookups() {
    return this.incidentsService.getLookups();
  }

  @Get()
  @Roles('agent', 'manager', 'admin')
  @ApiOperation({ summary: 'Lista incidentes e contadores do Workspace' })
  findAll(
    @Query('state') state?: string,
    @Query('unassigned') unassigned?: string,
    @Query('q') q?: string,
  ) {
    return this.incidentsService.findAll({
      state,
      unassigned: unassigned === 'true',
      q,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Cria um novo incidente (US-020, US-021)' })
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const parsed = createIncidentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.incidentsService.create(parsed.data, user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Lista chamados do próprio usuário para o Portal (US-082)' })
  findMy(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string) {
    return this.incidentsService.findAll({
      q,
      requesterOrOpenedById: user.id,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um incidente, comentários e linha do tempo' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.findOne(id, this.isEndUser(user));
  }

  @Patch(':id')
  @Roles('agent', 'manager', 'admin')
  @ApiOperation({ summary: 'Atualiza campos, estado ou atribuição do incidente (US-022, US-023)' })
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = updateIncidentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.incidentsService.update(id, parsed.data, user.id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Adiciona nota de trabalho interna ou comentário público (US-025)' })
  addComment(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = addTaskCommentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.incidentsService.addComment(id, parsed.data, user.id, this.isEndUser(user));
  }

  @Post(':id/resolve')
  @Roles('agent', 'manager', 'admin')
  @ApiOperation({ summary: 'Resolve incidente e filhos vinculados (US-028, US-029)' })
  resolve(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = resolveIncidentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.incidentsService.resolve(id, parsed.data, user.id);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reabre incidente resolvido dentro da janela configurada (US-026)' })
  reopen(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.reopen(id, user.id, this.isEndUser(user));
  }

  @Post(':id/link-children')
  @Roles('agent', 'manager', 'admin')
  @ApiOperation({ summary: 'Vincula incidentes filhos a um incidente pai (US-029)' })
  linkChildren(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const parsed = linkChildIncidentsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.incidentsService.linkChildren(id, parsed.data.childIds, user.id);
  }
}
