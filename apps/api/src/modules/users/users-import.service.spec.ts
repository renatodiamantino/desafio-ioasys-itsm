import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { ScimTokenGuard } from './scim-token.guard';
import { UsersImportService } from './users-import.service';

describe('UsersImportService & ScimTokenGuard (US-004)', () => {
  it('dryRun validates invalid and duplicate emails and counts created vs updated', async () => {
    const prismaMock = {
      user: {
        findMany: async () => [{ id: 'u1', email: 'existing@acme.com' }],
      },
    } as any;

    const service = new UsersImportService(prismaMock);
    const csv = [
      'email,name,groups',
      'existing@acme.com,Existing User,N1',
      'new@acme.com,New User,N1|Redes',
      'invalid-email,Bad User,N1',
      'new@acme.com,Duplicate User,N1',
    ].join('\n');

    const report = await service.importCsv(csv, true, 'admin-1');
    assert.equal(report.dryRun, true);
    assert.equal(report.totalRows, 4);
    assert.equal(report.created, 1);
    assert.equal(report.updated, 1);
    assert.equal(report.skipped, 2);
    assert.equal(report.errors.length, 2);
    assert.equal(report.errors[0].line, 4);
    assert.equal(report.errors[1].line, 5);
  });

  it('imports CSV users, links groups, and records audit log', async () => {
    let createdUsers = 0;
    let groupUpserts = 0;
    let auditAction = '';

    const prismaMock = {
      user: {
        findMany: async () => [],
      },
      role: {
        findUnique: async () => ({ id: 'role-end-user', code: 'end_user' }),
      },
      $transaction: async (cb: any) =>
        cb({
          user: {
            create: async () => {
              createdUsers++;
              return { id: `u-${createdUsers}` };
            },
          },
          userRole: {
            create: async () => ({}),
          },
          group: {
            upsert: async () => {
              groupUpserts++;
              return { id: `g-${groupUpserts}` };
            },
          },
          groupMember: {
            upsert: async () => ({}),
          },
          auditLog: {
            create: async (args: any) => {
              auditAction = args.data.action;
            },
          },
        }),
    } as any;

    const service = new UsersImportService(prismaMock);
    const csv = 'email;name;groups\nalice@acme.com;Alice Silva;Service Desk|N2';
    const report = await service.importCsv(csv, false, 'admin-1');

    assert.equal(report.dryRun, false);
    assert.equal(report.created, 1);
    assert.equal(groupUpserts, 2);
    assert.equal(auditAction, 'IMPORT_CSV');
  });

  it('creates and deactivates user via SCIM 2.0', async () => {
    let deactivated = false;
    const prismaMock = {
      user: {
        findUnique: async (args: any) => {
          if (args.where.email) return null;
          return {
            id: 'u-scim',
            email: 'bob@acme.com',
            name: 'Bob',
            externalId: 'ext-1',
            isActive: true,
          };
        },
      },
      role: {
        findUnique: async () => ({ id: 'role-end-user' }),
      },
      $transaction: async (cb: any) =>
        cb({
          user: {
            create: async (args: any) => ({ id: 'u-scim', ...args.data }),
            update: async (args: any) => {
              if (args.data.isActive === false) deactivated = true;
              return { id: 'u-scim', ...args.data };
            },
          },
          userRole: { create: async () => ({}) },
          auditLog: { create: async () => ({}) },
        }),
    } as any;

    const service = new UsersImportService(prismaMock);
    const created = await service.scimCreateUser({
      userName: 'bob@acme.com',
      displayName: 'Bob',
      externalId: 'ext-1',
      active: true,
    });
    assert.equal(created.userName, 'bob@acme.com');
    assert.equal(created.active, true);

    await service.scimDeactivateUser('u-scim');
    assert.equal(deactivated, true);
  });

  it('ScimTokenGuard rejects missing or invalid Bearer token with 401', () => {
    const guard = new ScimTokenGuard();
    const invalidCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer wrong-token' } }),
      }),
    } as any;
    assert.throws(() => guard.canActivate(invalidCtx), UnauthorizedException);

    const validCtx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: `Bearer ${process.env.SCIM_TOKEN || 'itsm-scim-dev-token'}`,
          },
        }),
      }),
    } as any;
    assert.equal(guard.canActivate(validCtx), true);
  });
});
