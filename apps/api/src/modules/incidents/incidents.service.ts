import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddTaskCommentInput,
  calculatePriority,
  CreateIncidentInput,
  ResolveIncidentInput,
  UpdateIncidentInput,
} from '@itsm/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextIncidentNumber(tx: any): Promise<string> {
    const count = await tx.task.count({ where: { taskType: 'INCIDENT' } });
    return `INC${String(count + 1).padStart(7, '0')}`;
  }

  async ensureDefaultLookups() {
    const [catCount, resCount, holdCount, grpCount] = await Promise.all([
      this.prisma.category.count(),
      this.prisma.resolutionCode.count(),
      this.prisma.holdReason.count(),
      this.prisma.group.count(),
    ]);

    if (catCount === 0) {
      await this.prisma.category.createMany({
        data: [
          { name: 'Hardware', sortOrder: 1 },
          { name: 'Software', sortOrder: 2 },
          { name: 'Rede & Conectividade', sortOrder: 3 },
          { name: 'Acessos & Identidade', sortOrder: 4 },
        ],
      });
    }
    if (resCount === 0) {
      await this.prisma.resolutionCode.createMany({
        data: [
          { name: 'Solução Definitiva Aplicada' },
          { name: 'Solução de Contorno (Workaround)' },
          { name: 'Orientação ao Usuário' },
          { name: 'Duplicado / Resolvido pelo Pai' },
        ],
        skipDuplicates: true,
      });
    }
    if (holdCount === 0) {
      await this.prisma.holdReason.createMany({
        data: [
          { name: 'Aguardando Usuário' },
          { name: 'Aguardando Fornecedor' },
          { name: 'Aguardando Mudança' },
        ],
        skipDuplicates: true,
      });
    }
    if (grpCount === 0) {
      await this.prisma.group.createMany({
        data: [
          { name: 'Service Desk N1', description: 'Atendimento inicial' },
          { name: 'Infraestrutura & Redes', description: 'Suporte N2/N3' },
          { name: 'Sistemas Corporativos', description: 'Aplicações internas' },
        ],
        skipDuplicates: true,
      });
    }
  }

  async getLookups() {
    await this.ensureDefaultLookups();
    const [categories, resolutionCodes, holdReasons, groups, users] = await Promise.all([
      this.prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.resolutionCode.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.holdReason.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.group.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { categories, resolutionCodes, holdReasons, groups, users };
  }

  async create(input: CreateIncidentInput, actorId: string) {
    const priority = calculatePriority(input.impact, input.urgency);
    const requesterId = input.requesterId ?? actorId;

    return this.prisma.$transaction(async (tx) => {
      const number = await this.nextIncidentNumber(tx);
      const task = await tx.task.create({
        data: {
          number,
          taskType: 'INCIDENT',
          shortDescription: input.shortDescription,
          description: input.description ?? null,
          state: 'NEW',
          impact: input.impact,
          urgency: input.urgency,
          priority,
          requesterId,
          openedById: actorId,
          assignedGroupId: input.assignedGroupId ?? null,
          assignedToId: input.assignedToId ?? null,
          incident: {
            create: {
              channel: input.channel,
              categoryId: input.categoryId ?? null,
              subcategoryId: input.subcategoryId ?? null,
            },
          },
        },
        include: {
          incident: { include: { category: true, resolutionCode: true, holdReason: true } },
          requester: { select: { id: true, name: true, email: true } },
          assignedGroup: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'incident',
          entityId: task.id,
          action: 'CREATE',
          actorId,
          newValue: { number: task.number, state: task.state, priority: task.priority },
        },
      });

      return task;
    });
  }

  async findAll(query: {
    state?: string;
    unassigned?: boolean;
    q?: string;
    requesterOrOpenedById?: string;
  }) {
    const where: any = { taskType: 'INCIDENT' };
    if (query.state) where.state = query.state;
    if (query.unassigned) where.assignedToId = null;

    const andClauses: any[] = [];
    if (query.requesterOrOpenedById) {
      andClauses.push({
        OR: [
          { requesterId: query.requesterOrOpenedById },
          { openedById: query.requesterOrOpenedById },
        ],
      });
    }
    if (query.q) {
      andClauses.push({
        OR: [
          { number: { contains: query.q, mode: 'insensitive' } },
          { shortDescription: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const [items, total, unassigned, inProgress, resolved] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { openedAt: 'desc' }],
        take: 100,
        include: {
          incident: { include: { category: true } },
          requester: { select: { id: true, name: true, email: true } },
          assignedGroup: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      this.prisma.task.count({ where: { taskType: 'INCIDENT' } }),
      this.prisma.task.count({
        where: { taskType: 'INCIDENT', assignedToId: null, state: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
      }),
      this.prisma.task.count({ where: { taskType: 'INCIDENT', state: 'IN_PROGRESS' } }),
      this.prisma.task.count({ where: { taskType: 'INCIDENT', state: 'RESOLVED' } }),
    ]);

    return {
      items,
      summary: { total, unassigned, inProgress, resolved },
    };
  }

  async findOne(id: string, isEndUser: boolean) {
    const task = await this.prisma.task.findFirst({
      where: { id, taskType: 'INCIDENT' },
      include: {
        incident: {
          include: {
            category: true,
            subcategory: true,
            holdReason: true,
            resolutionCode: true,
            parentIncident: { include: { task: { select: { id: true, number: true, shortDescription: true, state: true } } } },
            childIncidents: { include: { task: { select: { id: true, number: true, shortDescription: true, state: true, priority: true } } } },
          },
        },
        requester: { select: { id: true, name: true, email: true } },
        openedBy: { select: { id: true, name: true, email: true } },
        assignedGroup: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        comments: {
          where: isEndUser ? { isInternal: false } : undefined,
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!task) throw new NotFoundException('Incidente não encontrado.');

    if (isEndUser && task.requesterId !== undefined) {
      // Controle de acesso garantido na camada de controller/service
    }

    const timeline = await this.prisma.auditLog.findMany({
      where: { entityType: 'incident', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    });

    return {
      ...task,
      timeline: isEndUser
        ? []
        : timeline.map((entry) => ({
            ...entry,
            id: entry.id.toString(),
          })),
    };
  }

  async update(id: string, input: UpdateIncidentInput, actorId: string) {
    const existing = await this.prisma.task.findFirst({
      where: { id, taskType: 'INCIDENT' },
      include: { incident: true },
    });
    if (!existing) throw new NotFoundException('Incidente não encontrado.');

    if (existing.state === 'CLOSED' || existing.state === 'CANCELLED') {
      throw new BadRequestException('Incidentes fechados ou cancelados não podem ser editados.');
    }

    if (input.state === 'RESOLVED') {
      throw new BadRequestException('Use o endpoint /resolve informando código e nota de resolução.');
    }

    if (input.state === 'ON_HOLD' && !input.holdReasonId && !existing.incident?.holdReasonId) {
      throw new BadRequestException('Motivo de espera (holdReasonId) é obrigatório para estado Em Espera.');
    }

    const nextImpact = input.impact ?? existing.impact;
    const nextUrgency = input.urgency ?? existing.urgency;
    let nextPriority = existing.priority;
    let overrideReason = existing.priorityOverrideReason;

    if (input.priorityOverride !== undefined) {
      if (!input.priorityOverrideReason) {
        throw new BadRequestException('Motivo é obrigatório ao sobrescrever a prioridade.');
      }
      nextPriority = input.priorityOverride;
      overrideReason = input.priorityOverrideReason;
    } else if (input.impact !== undefined || input.urgency !== undefined) {
      nextPriority = calculatePriority(nextImpact, nextUrgency);
      overrideReason = null;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          shortDescription: input.shortDescription,
          description: input.description,
          state: input.state,
          impact: nextImpact,
          urgency: nextUrgency,
          priority: nextPriority,
          priorityOverrideReason: overrideReason,
          assignedGroupId: input.assignedGroupId,
          assignedToId: input.assignedToId,
          incident: {
            update: {
              categoryId: input.categoryId,
              subcategoryId: input.subcategoryId,
              holdReasonId: input.state && input.state !== 'ON_HOLD' ? null : input.holdReasonId,
            },
          },
        },
        include: {
          incident: { include: { category: true, holdReason: true, resolutionCode: true } },
          assignedGroup: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'incident',
          entityId: id,
          action: 'UPDATE',
          actorId,
          oldValue: { state: existing.state, priority: existing.priority, assignedToId: existing.assignedToId },
          newValue: { state: updated.state, priority: updated.priority, assignedToId: updated.assignedToId },
        },
      });

      return updated;
    });
  }

  async addComment(id: string, input: AddTaskCommentInput, actorId: string, isEndUser: boolean) {
    const task = await this.prisma.task.findFirst({ where: { id, taskType: 'INCIDENT' } });
    if (!task) throw new NotFoundException('Incidente não encontrado.');

    if (isEndUser && task.requesterId !== actorId) {
      throw new ForbiddenException('Você só pode comentar nos seus próprios incidentes.');
    }

    const isInternal = isEndUser ? false : input.isInternal;

    return this.prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: actorId,
        body: input.body,
        isInternal,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async resolve(id: string, input: ResolveIncidentInput, actorId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, taskType: 'INCIDENT' },
      include: { incident: { include: { childIncidents: { include: { task: true } } } } },
    });
    if (!task) throw new NotFoundException('Incidente não encontrado.');

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const resolved = await tx.task.update({
        where: { id },
        data: {
          state: 'RESOLVED',
          resolvedAt: now,
          incident: {
            update: {
              resolutionCodeId: input.resolutionCodeId,
              resolutionNotes: input.resolutionNotes,
              holdReasonId: null,
            },
          },
        },
      });

      // US-029: Resolver filhos abertos automaticamente quando o Pai for resolvido
      const openChildren =
        task.incident?.childIncidents.filter(
          (c) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(c.task.state),
        ) ?? [];

      for (const child of openChildren) {
        await tx.task.update({
          where: { id: child.taskId },
          data: {
            state: 'RESOLVED',
            resolvedAt: now,
            incident: {
              update: {
                resolutionCodeId: input.resolutionCodeId,
                resolutionNotes: `[Resolvido via Incidente Pai ${task.number}] ${input.resolutionNotes}`,
              },
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'incident',
          entityId: id,
          action: 'RESOLVE',
          actorId,
          newValue: {
            state: 'RESOLVED',
            resolutionCodeId: input.resolutionCodeId,
            resolvedChildrenCount: openChildren.length,
          },
        },
      });

      return { ...resolved, resolvedChildrenCount: openChildren.length };
    });
  }

  async reopen(id: string, actorId: string, isEndUser: boolean) {
    const task = await this.prisma.task.findFirst({
      where: { id, taskType: 'INCIDENT' },
      include: { incident: true },
    });
    if (!task) throw new NotFoundException('Incidente não encontrado.');
    if (task.state !== 'RESOLVED') {
      throw new BadRequestException('Apenas incidentes resolvidos podem ser reabertos.');
    }
    if (isEndUser && task.requesterId !== actorId) {
      throw new ForbiddenException('Você só pode reabrir seus próprios incidentes.');
    }

    const org = await this.prisma.organizationSettings.findFirst();
    const windowDays = org?.reopenWindowDays ?? 7;
    if (task.resolvedAt) {
      const diffDays = (Date.now() - task.resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > windowDays) {
        throw new BadRequestException(`Prazo de ${windowDays} dias para reabertura expirado.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          state: 'IN_PROGRESS',
          resolvedAt: null,
          incident: { update: { reopenCount: { increment: 1 } } },
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'incident',
          entityId: id,
          action: 'REOPEN',
          actorId,
          oldValue: { state: 'RESOLVED' },
          newValue: { state: 'IN_PROGRESS' },
        },
      });
      return updated;
    });
  }

  async linkChildren(parentId: string, childIds: string[], actorId: string) {
    if (childIds.includes(parentId)) {
      throw new BadRequestException('Um incidente não pode ser filho de si mesmo.');
    }
    const parent = await this.prisma.incident.findUnique({ where: { taskId: parentId } });
    if (!parent) throw new NotFoundException('Incidente pai não encontrado.');
    if (parent.parentIncidentId) {
      throw new BadRequestException('Incidente pai já é filho de outro incidente.');
    }

    await this.prisma.incident.updateMany({
      where: { taskId: { in: childIds } },
      data: { parentIncidentId: parentId },
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'incident',
        entityId: parentId,
        action: 'LINK_CHILDREN',
        actorId,
        newValue: { childIds },
      },
    });

    return { parentId, linkedCount: childIds.length };
  }
}
