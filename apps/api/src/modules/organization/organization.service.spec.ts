import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from './organization.service';

describe('OrganizationService (US-001)', () => {
  it('returns isConfigured=false when organization_settings is empty', async () => {
    const prismaMock = {
      organizationSettings: {
        findFirst: async () => null,
      },
    } as any;

    const service = new OrganizationService(prismaMock);
    const result = await service.getStatus();
    assert.deepEqual(result, { isConfigured: false, organization: null });
  });

  it('throws ConflictException if setup is called when already configured', async () => {
    const prismaMock = {
      organizationSettings: {
        findFirst: async () => ({ id: 'org-1', companyName: 'Acme' }),
      },
    } as any;

    const service = new OrganizationService(prismaMock);
    await assert.rejects(
      () =>
        service.setup({
          companyName: 'Acme',
          supportEmail: 'suporte@acme.com',
          defaultTimezone: 'America/Sao_Paulo',
          defaultLocale: 'pt-BR',
          primaryColor: '#0F4C81',
          adminName: 'Admin',
          adminEmail: 'admin@acme.com',
          adminPassword: 'Password123!',
        }),
      ConflictException,
    );
  });

  it('creates organization, 4 system roles, admin user, and audit log on setup', async () => {
    const createdRoles: string[] = [];
    let auditCreated = false;
    let createdAdminEmail = '';

    const txMock = {
      organizationSettings: {
        create: async ({ data }: any) => ({ id: 'org-1', ...data }),
      },
      role: {
        upsert: async ({ where, create }: any) => {
          createdRoles.push(where.code);
          return { id: `role-${where.code}`, ...create };
        },
      },
      user: {
        create: async ({ data }: any) => {
          createdAdminEmail = data.email;
          assert.ok(data.passwordHash.startsWith('$argon2id$'));
          return { id: 'user-1', name: data.name, email: data.email };
        },
      },
      auditLog: {
        create: async () => {
          auditCreated = true;
          return { id: 1n };
        },
      },
    };

    const prismaMock = {
      organizationSettings: {
        findFirst: async () => null,
      },
      $transaction: async (fn: any) => fn(txMock),
    } as any;

    const service = new OrganizationService(prismaMock);
    const res = await service.setup({
      companyName: 'Empresa Teste',
      supportEmail: 'ti@empresa.com',
      defaultTimezone: 'America/Sao_Paulo',
      defaultLocale: 'pt-BR',
      primaryColor: '#0F4C81',
      adminName: 'Renato Admin',
      adminEmail: 'Admin@Empresa.com',
      adminPassword: 'StrongPassword123',
    });

    assert.equal(res.organization.companyName, 'Empresa Teste');
    assert.equal(createdAdminEmail, 'admin@empresa.com');
    assert.deepEqual(createdRoles.sort(), ['admin', 'agent', 'end_user', 'manager']);
    assert.equal(auditCreated, true);
  });

  it('throws NotFoundException when updating before setup', async () => {
    const prismaMock = {
      organizationSettings: {
        findFirst: async () => null,
      },
    } as any;

    const service = new OrganizationService(prismaMock);
    await assert.rejects(
      () => service.update({ companyName: 'Nova' }),
      NotFoundException,
    );
  });
});
