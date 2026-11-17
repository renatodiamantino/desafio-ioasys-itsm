import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsQueryInput } from '@itsm/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordAuditInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  fieldName?: string | null;
  oldValue?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  newValue?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra uma entrada imutável em audit_logs. */
  async record(input: RecordAuditInput) {
    const created = await this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId ?? null,
        fieldName: input.fieldName ?? null,
        oldValue: input.oldValue ?? Prisma.JsonNull,
        newValue: input.newValue ?? Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
      },
    });
    return { ...created, id: created.id.toString() };
  }

  /** Consulta paginada e filtrada do histórico imutável de auditoria. */
  async findAll(query: AuditLogsQueryInput) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize,
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        id: item.id.toString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Retorna o histórico cronológico completo de uma entidade específica. */
  async findByEntity(entityType: string, entityId: string) {
    const items = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return items.map((item) => ({
      ...item,
      id: item.id.toString(),
    }));
  }
}
