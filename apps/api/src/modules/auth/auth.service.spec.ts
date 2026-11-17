import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { generateSecret, generateSync } from 'otplib';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';

describe('AuthService & RolesGuard (US-002, US-005)', () => {
  it('locks account after 5 failed login attempts', async () => {
    const prismaMock = {
      user: {
        findUnique: async () => null,
      },
    } as any;

    const service = new AuthService(prismaMock, new JwtService());
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        () => service.login({ email: 'lock@empresa.com', password: 'wrong' }),
        UnauthorizedException,
      );
    }

    await assert.rejects(
      () => service.login({ email: 'lock@empresa.com', password: 'wrong' }),
      (err: unknown) => err instanceof HttpException && err.getStatus() === 429,
    );
  });

  it('logs in user without MFA and issues access + refresh tokens', async () => {
    const passwordHash = await argon2.hash('CorrectPass123', { type: argon2.argon2id });
    const prismaMock = {
      user: {
        findUnique: async () => ({
          id: 'u-1',
          email: 'agente@empresa.com',
          name: 'Agente Um',
          locale: 'pt-BR',
          passwordHash,
          isActive: true,
          mfaEnabled: false,
          mfaSecretEnc: null,
          roles: [{ role: { code: 'agent' } }],
        }),
      },
      auditLog: {
        create: async () => ({ id: 1n }),
      },
    } as any;

    const service = new AuthService(prismaMock, new JwtService());
    const res = await service.login({ email: 'agente@empresa.com', password: 'CorrectPass123' });

    assert.equal(res.mfaRequired, false);
    assert.ok('accessToken' in res && res.accessToken);
    assert.ok('refreshToken' in res && res.refreshToken);
    assert.deepEqual((res as any).user.roles, ['agent']);
  });

  it('requires and verifies TOTP code when MFA is enabled', async () => {
    const passwordHash = await argon2.hash('CorrectPass123', { type: argon2.argon2id });
    const secret = generateSecret();
    const prismaMock = {
      user: {
        findUnique: async () => ({
          id: 'u-2',
          email: 'admin@empresa.com',
          name: 'Admin',
          locale: 'pt-BR',
          passwordHash,
          isActive: true,
          mfaEnabled: true,
          mfaSecretEnc: secret,
          roles: [{ role: { code: 'admin' } }],
        }),
      },
      auditLog: {
        create: async () => ({ id: 2n }),
      },
    } as any;

    const service = new AuthService(prismaMock, new JwtService());
    const loginRes = await service.login({ email: 'admin@empresa.com', password: 'CorrectPass123' });
    assert.equal(loginRes.mfaRequired, true);
    assert.ok('mfaToken' in loginRes);

    const code = generateSync({ secret });
    const verified = await service.verifyMfa({
      mfaToken: (loginRes as any).mfaToken,
      code,
    });
    assert.ok(verified.accessToken);
    assert.deepEqual(verified.user.roles, ['admin']);
  });

  it('RolesGuard blocks end_user from admin/agent routes with 403', () => {
    const reflectorMock = {
      getAllAndOverride: () => ['agent', 'admin'],
    } as any;
    const guard = new RolesGuard(reflectorMock);

    const ctxEndUser = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u-3', email: 'u@e.com', roles: ['end_user'] } }),
      }),
    } as any;

    assert.throws(() => guard.canActivate(ctxEndUser), ForbiddenException);

    const ctxAgent = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u-1', email: 'a@e.com', roles: ['agent'] } }),
      }),
    } as any;

    assert.equal(guard.canActivate(ctxAgent), true);
  });

  it('updates user locale and translates UI labels across pt-BR, en and es (US-008)', async () => {
    const { translate } = await import('@itsm/shared');
    let auditCreated = false;
    let updatedLocale = '';

    const prismaMock = {
      user: {
        findUnique: async () => ({ id: 'u1', locale: 'pt-BR' }),
      },
      $transaction: async (cb: any) =>
        cb({
          user: {
            update: async (args: any) => {
              updatedLocale = args.data.locale;
              return { id: 'u1', locale: updatedLocale };
            },
          },
          auditLog: {
            create: async () => {
              auditCreated = true;
            },
          },
        }),
    } as any;

    const service = new AuthService(prismaMock, {} as any);
    const res = await service.updateLocale('u1', 'en');
    assert.deepEqual(res, { userId: 'u1', locale: 'en' });
    assert.equal(updatedLocale, 'en');
    assert.equal(auditCreated, true);
    assert.equal(translate('pt-BR', 'state.NEW'), 'Novo');
    assert.equal(translate('en', 'state.NEW'), 'New');
    assert.equal(translate('es', 'state.IN_PROGRESS'), 'En Curso');
  });
});
