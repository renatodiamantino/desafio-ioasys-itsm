import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { calculatePriority } from '@itsm/shared';
import { IncidentsService } from './incidents.service';

describe('IncidentsService (E02)', () => {
  it('calculates priority using 3x3 Impact x Urgency matrix (US-021)', () => {
    assert.equal(calculatePriority(1, 1), 1);
    assert.equal(calculatePriority(1, 2), 2);
    assert.equal(calculatePriority(2, 2), 3);
    assert.equal(calculatePriority(2, 3), 4);
    assert.equal(calculatePriority(3, 3), 5);
  });

  it('requires holdReasonId when moving to ON_HOLD (US-022)', async () => {
    const prismaMock = {
      task: {
        findFirst: async () => ({
          id: 'inc-1',
          state: 'IN_PROGRESS',
          impact: 2,
          urgency: 2,
          priority: 3,
          incident: { holdReasonId: null },
        }),
      },
    } as any;

    const service = new IncidentsService(prismaMock);
    await assert.rejects(
      () => service.update('inc-1', { state: 'ON_HOLD' }, 'u-1'),
      BadRequestException,
    );
  });

  it('forces isInternal=false when an end_user posts a comment (US-025)', async () => {
    let savedInternal: boolean | undefined;
    const prismaMock = {
      task: {
        findFirst: async () => ({ id: 'inc-1', requesterId: 'u-end' }),
      },
      taskComment: {
        create: async ({ data }: any) => {
          savedInternal = data.isInternal;
          return { id: 'c-1', ...data };
        },
      },
    } as any;

    const service = new IncidentsService(prismaMock);
    await service.addComment('inc-1', { body: 'Oi', isInternal: true }, 'u-end', true);
    assert.equal(savedInternal, false);
  });

  it('resolves parent and open child incidents together (US-029)', async () => {
    const updatedIds: string[] = [];
    const txMock = {
      task: {
        update: async ({ where }: any) => {
          updatedIds.push(where.id);
          return { id: where.id, state: 'RESOLVED' };
        },
      },
      auditLog: {
        create: async () => ({ id: 1n }),
      },
    };
    const prismaMock = {
      task: {
        findFirst: async () => ({
          id: 'parent-1',
          number: 'INC0000001',
          incident: {
            childIncidents: [
              { taskId: 'child-open', task: { state: 'NEW' } },
              { taskId: 'child-closed', task: { state: 'CLOSED' } },
            ],
          },
        }),
      },
      $transaction: async (fn: any) => fn(txMock),
    } as any;

    const service = new IncidentsService(prismaMock);
    const res = await service.resolve(
      'parent-1',
      { resolutionCodeId: 'code-1', resolutionNotes: 'Patch aplicado' },
      'agent-1',
    );

    assert.equal(res.resolvedChildrenCount, 1);
    assert.deepEqual(updatedIds, ['parent-1', 'child-open']);
  });

  it('scopes findAll to requesterId/openedById for Portal end_user (US-082)', async () => {
    let capturedWhere: any = null;
    const prismaMock = {
      task: {
        findMany: async (args: any) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    } as any;

    const service = new IncidentsService(prismaMock);
    await service.findAll({ requesterOrOpenedById: 'user-99', q: 'VPN' });

    assert.equal(capturedWhere.taskType, 'INCIDENT');
    assert.equal(capturedWhere.AND.length, 2);
    assert.deepEqual(capturedWhere.AND[0], {
      OR: [{ requesterId: 'user-99' }, { openedById: 'user-99' }],
    });
  });

  it('findOne serializes BigInt timeline ids to strings so JSON.stringify never fails', async () => {
    const prismaMock = {
      task: {
        findFirst: async () => ({
          id: 'inc-1',
          number: 'INC0000001',
          comments: [],
          incident: null,
        }),
      },
      auditLog: {
        findMany: async () => [
          { id: 10n, action: 'CREATE', createdAt: new Date(), actor: { id: 'u1', name: 'Admin' } },
        ],
      },
    } as any;

    const service = new IncidentsService(prismaMock);
    const detail = await service.findOne('inc-1', false);
    const json = JSON.stringify(detail);
    assert.ok(json.includes('"id":"10"'));
  });
});
