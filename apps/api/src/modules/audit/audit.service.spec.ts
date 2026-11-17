import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

describe('AuditService & AuditController (US-006)', () => {
  it('findAll filters by entityType/action and serializes BigInt id to string', async () => {
    let capturedWhere: any = null;
    const prismaMock = {
      auditLog: {
        findMany: async (args: any) => {
          capturedWhere = args.where;
          return [
            {
              id: 42n,
              entityType: 'tasks',
              entityId: '11111111-1111-1111-1111-111111111111',
              action: 'UPDATE',
              actorId: '22222222-2222-2222-2222-222222222222',
              fieldName: 'state',
              oldValue: 'NEW',
              newValue: 'IN_PROGRESS',
              ipAddress: '127.0.0.1',
              createdAt: new Date('2026-11-16T20:00:00.000Z'),
              actor: { id: '22222222-2222-2222-2222-222222222222', name: 'Admin', email: 'admin@acme.com' },
            },
          ];
        },
        count: async () => 1,
      },
    } as any;

    const service = new AuditService(prismaMock);
    const result = await service.findAll({
      entityType: 'tasks',
      action: 'UPDATE',
      page: 1,
      pageSize: 25,
    });

    assert.equal(capturedWhere.entityType, 'tasks');
    assert.equal(capturedWhere.action, 'UPDATE');
    assert.equal(result.total, 1);
    assert.equal(result.items[0].id, '42');
    assert.equal(typeof result.items[0].id, 'string');
  });

  it('findByEntity returns chronological history for a specific record', async () => {
    let capturedOrderBy: any = null;
    const prismaMock = {
      auditLog: {
        findMany: async (args: any) => {
          capturedOrderBy = args.orderBy;
          return [
            {
              id: 1n,
              entityType: 'users',
              entityId: '33333333-3333-3333-3333-333333333333',
              action: 'CREATE',
              actorId: null,
              fieldName: null,
              oldValue: null,
              newValue: { email: 'user@acme.com' },
              ipAddress: null,
              createdAt: new Date('2026-11-16T19:00:00.000Z'),
              actor: null,
            },
          ];
        },
      },
    } as any;

    const service = new AuditService(prismaMock);
    const history = await service.findByEntity('users', '33333333-3333-3333-3333-333333333333');
    assert.equal(history.length, 1);
    assert.equal(history[0].id, '1');
    assert.deepEqual(capturedOrderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('AuditController exposes only GET endpoints (immutable append-only)', () => {
    const methods = Object.getOwnPropertyNames(AuditController.prototype).filter(
      (m) => m !== 'constructor',
    );
    assert.ok(methods.length >= 2);
    for (const methodName of methods) {
      const fn = (AuditController.prototype as any)[methodName];
      const httpMethod = Reflect.getMetadata(METHOD_METADATA, fn);
      assert.equal(httpMethod, RequestMethod.GET, `${methodName} must be GET-only`);
    }
  });
});
