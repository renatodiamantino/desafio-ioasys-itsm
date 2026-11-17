import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { SsoService } from './sso.service';

describe('SsoService (US-003)', () => {
  it('saves IdP config, masks clientSecret on response, and writes audit log', async () => {
    let savedConfig: any = null;
    let auditAction = '';

    const prismaMock = {
      organizationSettings: {
        findFirst: async () => ({
          id: 'org-1',
          ssoConfig: savedConfig,
        }),
      },
      $transaction: async (cb: any) =>
        cb({
          organizationSettings: {
            update: async (args: any) => {
              savedConfig = args.data.ssoConfig;
              return { id: 'org-1', ssoConfig: savedConfig };
            },
          },
          auditLog: {
            create: async (args: any) => {
              auditAction = args.data.action;
            },
          },
        }),
    } as any;

    const authService = new AuthService(prismaMock, new JwtService({}));
    const ssoService = new SsoService(prismaMock, authService);

    const res = await ssoService.saveConfig(
      {
        enabled: true,
        protocol: 'OIDC',
        providerName: 'Azure AD',
        issuerUrl: 'https://login.microsoftonline.com/tenant/v2.0',
        clientId: 'client-123',
        clientSecret: 'super-secret-value',
        jitProvisioning: true,
      },
      'admin-1',
    );

    assert.equal(res.enabled, true);
    assert.equal(res.providerName, 'Azure AD');
    assert.equal(res.hasClientSecret, true);
    assert.equal((res as any).clientSecret, undefined);
    assert.equal(auditAction, 'SSO_CONFIG_UPDATE');
  });

  it('rejects SSO callback when SSO is disabled', async () => {
    const prismaMock = {
      organizationSettings: {
        findFirst: async () => ({ id: 'org-1', ssoConfig: { enabled: false } }),
      },
    } as any;
    const authService = new AuthService(prismaMock, new JwtService({}));
    const ssoService = new SsoService(prismaMock, authService);

    await assert.rejects(
      () => ssoService.authenticateViaSso({ email: 'user@acme.com' }),
      ForbiddenException,
    );
  });

  it('JIT provisions new user on first SSO login and issues JWT tokens', async () => {
    let jitAudit = false;
    let loginAudit = false;

    const createdUser = {
      id: 'u-jit',
      email: 'maria@acme.com',
      name: 'Maria Silva',
      locale: 'pt-BR',
      isActive: true,
      roles: [{ role: { code: 'end_user' } }],
    };

    const prismaMock = {
      organizationSettings: {
        findFirst: async () => ({
          id: 'org-1',
          ssoConfig: { enabled: true, protocol: 'OIDC', jitProvisioning: true },
        }),
      },
      user: {
        findUnique: async () => null,
      },
      role: {
        findUnique: async () => ({ id: 'role-end-user', code: 'end_user' }),
      },
      auditLog: {
        create: async (args: any) => {
          if (args.data.action === 'LOGIN_SSO') loginAudit = true;
        },
      },
      $transaction: async (cb: any) =>
        cb({
          user: {
            create: async () => createdUser,
            findUniqueOrThrow: async () => createdUser,
          },
          userRole: { create: async () => ({}) },
          auditLog: {
            create: async (args: any) => {
              if (args.data.action === 'SSO_JIT_CREATE') jitAudit = true;
            },
          },
        }),
    } as any;

    const authService = new AuthService(prismaMock, new JwtService({}));
    const ssoService = new SsoService(prismaMock, authService);

    const tokens = await ssoService.authenticateViaSso({
      email: 'maria@acme.com',
      name: 'Maria Silva',
      externalId: 'aad-999',
    });

    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);
    assert.equal(tokens.user.email, 'maria@acme.com');
    assert.equal(jitAudit, true);
    assert.equal(loginAudit, true);
  });

  it('rejects unknown user when jitProvisioning is disabled', async () => {
    const prismaMock = {
      organizationSettings: {
        findFirst: async () => ({
          id: 'org-1',
          ssoConfig: { enabled: true, protocol: 'SAML', jitProvisioning: false },
        }),
      },
      user: {
        findUnique: async () => null,
      },
    } as any;
    const authService = new AuthService(prismaMock, new JwtService({}));
    const ssoService = new SsoService(prismaMock, authService);

    await assert.rejects(
      () => ssoService.authenticateViaSso({ email: 'unknown@acme.com' }),
      UnauthorizedException,
    );
  });
});
