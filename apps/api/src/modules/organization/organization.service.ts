import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrganizationSetupInput,
  OrganizationUpdateInput,
  SYSTEM_ROLE_CODES,
} from '@itsm/shared';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const org = await this.prisma.organizationSettings.findFirst();
    if (!org) {
      return { isConfigured: false, organization: null };
    }
    return {
      isConfigured: true,
      organization: {
        id: org.id,
        companyName: org.companyName,
        logoUrl: org.logoUrl,
        primaryColor: org.primaryColor,
        supportEmail: org.supportEmail,
        defaultTimezone: org.defaultTimezone,
        defaultLocale: org.defaultLocale,
        autoCloseDays: org.autoCloseDays,
        reopenWindowDays: org.reopenWindowDays,
      },
    };
  }

  async setup(input: OrganizationSetupInput) {
    const existing = await this.prisma.organizationSettings.findFirst();
    if (existing) {
      throw new ConflictException('A instância já foi configurada.');
    }

    const passwordHash = await argon2.hash(input.adminPassword, {
      type: argon2.argon2id,
    });

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organizationSettings.create({
        data: {
          companyName: input.companyName,
          supportEmail: input.supportEmail,
          defaultTimezone: input.defaultTimezone,
          defaultLocale: input.defaultLocale,
          primaryColor: input.primaryColor,
          logoUrl: input.logoUrl || null,
        },
      });

      const roleDescriptions: Record<(typeof SYSTEM_ROLE_CODES)[number], string> = {
        end_user: 'Usuário final (Portal)',
        agent: 'Agente de Service Desk / Resolvedor',
        manager: 'Gestor do Service Desk',
        admin: 'Administrador da plataforma',
      };

      const roles = await Promise.all(
        SYSTEM_ROLE_CODES.map((code) =>
          tx.role.upsert({
            where: { code },
            update: {},
            create: {
              code,
              name: code.toUpperCase(),
              description: roleDescriptions[code],
              isSystem: true,
            },
          }),
        ),
      );

      const adminRole = roles.find((r) => r.code === 'admin')!;

      const adminUser = await tx.user.create({
        data: {
          name: input.adminName,
          email: input.adminEmail.toLowerCase(),
          passwordHash,
          locale: input.defaultLocale,
          roles: {
            create: { roleId: adminRole.id },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'organization_settings',
          entityId: organization.id,
          action: 'CREATE',
          actorId: adminUser.id,
          newValue: {
            companyName: organization.companyName,
            supportEmail: organization.supportEmail,
            defaultTimezone: organization.defaultTimezone,
            defaultLocale: organization.defaultLocale,
          },
        },
      });

      return {
        organization,
        adminUser: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      };
    });
  }

  async update(input: OrganizationUpdateInput, actorId?: string) {
    const existing = await this.prisma.organizationSettings.findFirst();
    if (!existing) {
      throw new NotFoundException('Organização ainda não configurada.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationSettings.update({
        where: { id: existing.id },
        data: {
          companyName: input.companyName,
          supportEmail: input.supportEmail,
          defaultTimezone: input.defaultTimezone,
          defaultLocale: input.defaultLocale,
          primaryColor: input.primaryColor,
          logoUrl: input.logoUrl === '' ? null : input.logoUrl,
          autoCloseDays: input.autoCloseDays,
          reopenWindowDays: input.reopenWindowDays,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'organization_settings',
          entityId: updated.id,
          action: 'UPDATE',
          actorId: actorId ?? null,
          oldValue: {
            companyName: existing.companyName,
            supportEmail: existing.supportEmail,
            primaryColor: existing.primaryColor,
          },
          newValue: {
            companyName: updated.companyName,
            supportEmail: updated.supportEmail,
            primaryColor: updated.primaryColor,
          },
        },
      });

      return updated;
    });
  }
}
