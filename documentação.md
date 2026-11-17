# Documentação Técnica — Plataforma ITSM

## Stack Tecnológica

- **Runtime & Linguagem:** Node.js (`>= 22.0.0`), TypeScript (`^5.7.3`)
- **Monorepo & Pacotes:** `pnpm` (`11.1.2` / workspaces)
- **Backend (`apps/api`):** NestJS (`^11.0.0`), Express, Prisma ORM (`^6.3.0`), Swagger/OpenAPI (`@nestjs/swagger`), JWT (`@nestjs/jwt`), Argon2 (`argon2`), MFA TOTP (`otplib` `^13.6.0`), `node --test`
- **Frontend (`apps/web`):** Next.js (`^15.2.0`, App Router), React (`^19.0.0`), Tailwind CSS (`^4.0.0`)
- **Compartilhado (`packages/shared`):** Zod (`^3.24.2`)
- **Infraestrutura & Serviços (`docker-compose.yml`):** Docker Compose, PostgreSQL (`16-alpine`), Redis (`7-alpine`), MinIO

### Por que essas tecnologias?

- **TypeScript ponta a ponta (Node.js + `pnpm` monorepo):** Permite compartilhar tipos e schemas de validação (`@itsm/shared` com **Zod**) entre frontend e backend, reduzindo duplicação e erros de contrato em um projeto single-tenant desenvolvido com agilidade.
- **NestJS + Prisma ORM:** O NestJS oferece arquitetura modular (ideal para separar domínios ITSM como Organização, Autenticação, Incidentes, SLA e Catálogo), injeção de dependência, guards de RBAC e documentação automática via Swagger/OpenAPI. O Prisma entrega tipagem forte nas consultas ao banco e controle seguro de migrações.
- **Segurança nativa (Argon2, JWT, `otplib`):** Argon2id garante hash resistente para senhas; JWT viabiliza sessões stateless com `accessToken`/`refreshToken`; `otplib` implementa MFA TOTP padrão de mercado.
- **Next.js (App Router) + React + Tailwind CSS:** Unifica o Portal de Autoatendimento (`/portal`) e o Service Operations Workspace (`/workspace`) em uma aplicação moderna, com roteamento flexível, renderização rápida e estilização consistente baseada em utilitários.
- **PostgreSQL, Redis e MinIO (via Docker Compose):** PostgreSQL atende tanto dados relacionais (modelo unificado de `tasks` e auditoria) quanto extensões/campos dinâmicos (`JSONB` para o motor no-code); Redis dá suporte a cache, filas/jobs assíncronos e bloqueios temporários; MinIO provê armazenamento de anexos compatível com S3 em ambiente local; Docker Compose padroniza toda a infraestrutura em um único comando.

## Governança, Rules & Painéis Visuais do Projeto

Para garantir rastreabilidade de ponta a ponta entre especificação, código, QA e documentação:
- [Control/mapping.html](file:///c:/00_PROJETOS/servicenow/Control/mapping.html) — Mapa visual de como `Soul/AGENTS.md`, `Soul/skills.md`, `Soul/memory.md`, `Plan/` e os painéis vivos funcionam juntos na construção do produto.
- [Control/status.html](file:///c:/00_PROJETOS/servicenow/Control/status.html) — Painel estilo Jira/Gantt com progresso do MVP, roadmap pós-MVP e critérios de aceite por história.
- [Control/banco.html](file:///c:/00_PROJETOS/servicenow/Control/banco.html) — Diagrama DER interativo (estilo Visual Paradigm) sincronizado com `apps/api/prisma/schema.prisma`.
- [Soul/AGENTS.md](file:///c:/00_PROJETOS/servicenow/Soul/AGENTS.md) — Regras obrigatórias de governança (QA Gate + Definition of Done).

> **Regra:** Este documento registra exclusivamente o que já foi **implementado e verificado** a partir do zero.

## Índice de Histórias Implementadas

- **[US-001]** Setup inicial da empresa — Backend, Schema & UI `/setup` (2026-11-16) — *pendente apenas migração em PostgreSQL ativo*
- **[US-002]** Login com e-mail/senha, bloqueio por tentativas, MFA TOTP & UI `/login` (2026-11-16)
- **[US-003]** SSO Corporativo (OIDC / SAML, JIT Provisioning, Config `/workspace/settings/sso` & botão em `/login`) (2026-11-16)
- **[US-004]** Importação de Usuários & Grupos (CSV com `dryRun`, SCIM 2.0 `/scim/v2/Users` & UI `/workspace/users/import`) (2026-11-16)
- **[US-005]** RBAC (Papéis, Guards JWT/Roles, atribuição auditada & rotas `/workspace` e `/portal`) (2026-11-16)
- **[US-006]** Auditoria Imutável (Consulta paginada `GET /api/v1/audit-logs`, histórico por entidade & UI `/workspace/audit`) (2026-11-16)
- **[US-008]** Internacionalização (`pt-BR` / `en` / `es` via `@itsm/shared`, `PATCH /api/v1/auth/me/locale` & `LocaleSwitcher`) (2026-11-16)
- **[E06 — US-080, US-081 (parcial), US-082, US-084]** Portal de Autoatendimento (`/portal` conectado a `GET /api/v1/incidents/my`, abertura com deflexão, comentários públicos, reabertura e branding dinâmico) (2026-11-16)
- **[US-020, US-021, US-022, US-023, US-025, US-028, US-029]** Núcleo de Gestão de Incidentes (E02) + Workspace de Incidentes + Light/Dark Mode (2026-11-16)

---

### [US-001] Setup inicial da empresa (Backend & Modelo Base)
- **Épico:** E01 — Plataforma base
- **Data de conclusão (parcial — API/DB):** 2026-11-16
- **Resumo do que foi construído:**
  - Estrutura do monorepo `pnpm` (`packages/shared`, `apps/api`, `docker-compose.yml`).
  - Schemas Zod compartilhados (`organizationSetupSchema`, `organizationUpdateSchema`) em `@itsm/shared`.
  - Schema Prisma inicial (`apps/api/prisma/schema.prisma`) com tabelas `organization_settings`, `locations`, `departments`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `groups`, `group_members`, `audit_logs`, `tasks` e `incidents`.
  - Módulo NestJS `OrganizationModule` (`GET /api/v1/organization`, `POST /api/v1/organization/setup`, `PATCH /api/v1/organization`) que cria a organização, os 4 papéis de sistema (`end_user`, `agent`, `manager`, `admin`), o primeiro usuário administrador com hash Argon2id e o primeiro registro imutável em `audit_logs`.
- **Arquivos principais:**
  - [schema.prisma](file:///c:/00_PROJETOS/servicenow/apps/api/prisma/schema.prisma)
  - [organization.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/organization/organization.service.ts)
  - [organization.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/organization/organization.controller.ts)
  - [index.ts](file:///c:/00_PROJETOS/servicenow/packages/shared/src/index.ts)
- **Como testar / validar:**
  - Build completo: `pnpm build`
  - Testes unitários (4/4 passando com mock de Prisma): `node --test apps/api/dist/modules/organization/organization.service.spec.js`

---

### [US-002] Login, Refresh Token, Bloqueio e MFA TOTP (Backend)
- **Épico:** E01 — Plataforma base
- **Data de conclusão (Backend):** 2026-11-16
- **Resumo do que foi construído:**
  - Autenticação via Argon2id (`POST /api/v1/auth/login`), emissão de `accessToken` (15m) e `refreshToken` (7d) via JWT (`POST /api/v1/auth/refresh`), bloqueio temporário por 15 minutos após 5 tentativas inválidas (HTTP `429`), setup e verificação de MFA TOTP de 6 dígitos (`POST /api/v1/auth/mfa/setup`, `POST /api/v1/auth/mfa/verify`) com `otplib` v13, além de registro de `LOGIN` / `LOGIN_MFA` em `audit_logs`.
- **Arquivos principais:**
  - [auth.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/auth.service.ts)
  - [auth.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/auth.controller.ts)
  - [auth.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/auth.service.spec.ts)
- **Como testar / validar:**
  - `node --test apps/api/dist/modules/auth/auth.service.spec.js`

---

### [US-005] Controle de Acesso Baseado em Papéis — RBAC (Backend)
- **Épico:** E01 — Plataforma base
- **Data de conclusão (Backend):** 2026-11-16
- **Resumo do que foi construído:**
  - Guards globais `JwtAuthGuard` e `RolesGuard`, decorators `@Roles(...)` e `@CurrentUser()`.
  - Proteção de `PATCH /api/v1/organization` para exigir papel `admin`.
  - Endpoint `PUT /api/v1/auth/users/:id/roles` (somente `admin`) com registro imutável da alteração de papéis em `audit_logs`.
- **Arquivos principais:**
  - [jwt-auth.guard.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/guards/jwt-auth.guard.ts)
  - [roles.guard.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/guards/roles.guard.ts)
  - [roles.decorator.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/decorators/roles.decorator.ts)
  - [current-user.decorator.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/decorators/current-user.decorator.ts)
- **Como testar / validar:**
  - Validado no teste `RolesGuard blocks end_user from admin/agent routes with 403` em [auth.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/auth.service.spec.ts)

---

### Frontend Base (`apps/web` — Next.js 15 + Tailwind CSS + Design System ServiceNow)
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - Aplicação Next.js (App Router) com cliente API (`src/lib/api.ts`), `LocaleProvider` (`pt-BR` / `en` / `es` completo via `@itsm/shared`) e `ThemeToggle` (Light/Dark Mode).
  - **Design System ServiceNow (`AppShell`, `TopbarActions`, `DonutChart`, `badges.tsx`):**
    - Barra global `#293e40` com menu de perfil (`Avatar + Nome ▾` contendo seletor de idioma e Sair) + ícone Sol/Lua.
    - Application Navigator lateral `#303a46` com `Filtrar menu`, abas e seções recolhíveis (*Autoatendimento*, *Service Desk*, *Incidentes*, *Administração*).
    - **Workspace (`/workspace`):** *Ações Importantes*, 4 gráficos **Donut** (*Incidentes por Estado*, *Prioridade*, *Fila de Atribuição*, *Progresso de Resolução*) e lista padrão ServiceNow com `PriorityBadge`, `StateBadge` e `UserAvatar`.
    - **Portal (`/portal`):** Hero personalizado por organização, cartões de ação, gráfico Donut e lista/detalhes de chamados do solicitante.
  - **Rotas disponíveis:** `/` (redirecionamento), `/setup`, `/login`, `/workspace`, `/workspace/audit`, `/workspace/users/import`, `/workspace/settings/sso`, `/portal` e `/control` (menu simples servindo `Control/status.html`, `Control/banco.html` e `Control/mapping.html`).
  - **Seed de demonstração (`pnpm db:seed`):** [seed.js](file:///c:/00_PROJETOS/servicenow/apps/api/prisma/seed.js) popula locais, departamentos, categorias, códigos de resolução, motivos de espera, grupos, 4 usuários demo e 5 incidentes (`INC0000010`–`INC0000014`).
- **Como testar / validar:**
  - Build completo do monorepo: `pnpm build` (todos os 3 pacotes compilam sem erros).

---

### [US-006] Auditoria Imutável de Alterações (Backend & UI `/workspace/audit`)
- **Épico:** E01 — Plataforma base
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - Schema Zod `auditLogsQuerySchema` em `@itsm/shared` (filtros por `entityType`, `entityId`, `actorId`, `action`, `from`, `to` e paginação).
  - Módulo NestJS `AuditModule` (`AuditService`, `AuditController`) protegido por `JwtAuthGuard` + `RolesGuard` (`@Roles('admin', 'manager')`), expondo exclusivamente endpoints `GET` (`GET /api/v1/audit-logs` e `GET /api/v1/audit-logs/entity/:entityType/:entityId`), garantindo imutabilidade (*append-only*, sem `POST`/`PUT`/`PATCH`/`DELETE`).
  - Tela `/workspace/audit` no frontend Next.js com filtros por entidade e ação, paginação e link no cabeçalho do `/workspace` para `admin` e `manager`.
- **Arquivos principais:**
  - [audit.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/audit/audit.service.ts)
  - [audit.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/audit/audit.controller.ts)
  - [audit.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/audit/audit.service.spec.ts)
  - [page.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/app/workspace/audit/page.tsx)
- **Como testar / validar:**
  - Testes unitários (3/3 passando para `US-006`, 15/15 no total): `pnpm --filter @itsm/api test`
  - Build do frontend com rota `/workspace/audit`: `pnpm --filter @itsm/web build`

---

### [US-008] Internacionalização (`pt-BR` / `en` / `es`)
- **Épico:** E01 — Plataforma base
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - Dicionário compartilhado (`I18N_DICTIONARY` e helper `translate`) em `@itsm/shared` com suporte a `pt-BR`, `en` e `es` para menus, estados de incidente e mensagens comuns/erro, além de `updateLocaleSchema`.
  - Endpoint `PATCH /api/v1/auth/me/locale` em `AuthController` + `AuthService.updateLocale` para persistir o idioma preferido do usuário em `users.locale` com registro em `audit_logs`.
  - `LocaleProvider`, `useLocale()` e `<LocaleSwitcher />` no frontend (`apps/web`), alternando o idioma instantaneamente sem recarregar dados do servidor.
- **Arquivos principais:**
  - [i18n.ts](file:///c:/00_PROJETOS/servicenow/packages/shared/src/i18n.ts)
  - [auth.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/auth.service.ts)
  - [auth.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/auth.controller.ts)
  - [locale-provider.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/components/locale-provider.tsx)
- **Como testar / validar:**
  - `pnpm --filter @itsm/api test` (16/16 testes passando, incluindo o teste da `US-008`)
  - `pnpm --filter @itsm/web lint` (`tsc --noEmit` sem erros)

---

### [US-004] Importação de Usuários/Grupos (CSV e SCIM 2.0)
- **Épico:** E01 — Plataforma base
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - Schemas `csvImportUsersSchema` e `scimUserSchema` em `@itsm/shared`.
  - Módulo `UsersModule` (`UsersImportService`, `UsersImportController`, `ScimController`, `ScimTokenGuard`) com:
    - `POST /api/v1/users/import/csv` (somente `admin`), validando e-mails inválidos/duplicados, suportando `dryRun` (pré-visualização) e criação/atualização de usuários + grupos (`groups` separados por `|`), com registro em `audit_logs`.
    - Endpoints SCIM 2.0 `/api/v1/scim/v2/Users` (`GET`, `POST`, `PUT /:id`, `PATCH /:id`, `DELETE /:id` para desativação) protegidos por `ScimTokenGuard` (`Bearer` token via `SCIM_TOKEN`).
  - Tela `/workspace/users/import` para upload/colagem de CSV, pré-visualização (`dryRun`) e relatório de linhas criadas, atualizadas e com erro.
- **Arquivos principais:**
  - [users-import.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/users/users-import.service.ts)
  - [users-import.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/users/users-import.controller.ts)
  - [scim.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/users/scim.controller.ts)
  - [scim-token.guard.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/users/scim-token.guard.ts)
  - [users-import.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/users/users-import.service.spec.ts)
  - [page.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/app/workspace/users/import/page.tsx)
- **Como testar / validar:**
  - `pnpm --filter @itsm/api test` (20/20 testes passando, incluindo 4/4 da `US-004`)
  - `pnpm --filter @itsm/web lint` (`tsc --noEmit` sem erros)

---

### [US-003] SSO Corporativo (SAML / OIDC) e JIT Provisioning
- **Épico:** E01 — Plataforma base *(épico 100% concluído no MVP)*
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - Schemas `ssoConfigSchema` e `ssoCallbackSchema` em `@itsm/shared`.
  - `SsoService` e `SsoController` (`/api/v1/auth/sso/*`) com:
    - `GET /api/v1/auth/sso/config` (status público para `/login`, sem expor `clientSecret`).
    - `GET /api/v1/auth/sso/admin-config` e `PUT /api/v1/auth/sso/config` (somente `admin`, com mascaramento de secret e auditoria `SSO_CONFIG_UPDATE` em `audit_logs`).
    - `GET /api/v1/auth/sso/login` (URL de redirecionamento OIDC/SAML) e `POST /api/v1/auth/sso/callback` com *Just-In-Time provisioning* (criando usuário + papel `end_user` automaticamente no 1º login quando habilitado) e emissão de JWT.
  - Tela administrativa `/workspace/settings/sso` e botão dinâmico **"Entrar com {providerName}"** na tela `/login`.
- **Arquivos principais:**
  - [sso.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/sso.service.ts)
  - [sso.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/sso.controller.ts)
  - [sso.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/auth/sso.service.spec.ts)
  - [page.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/app/workspace/settings/sso/page.tsx)
- **Como testar / validar:**
  - `pnpm --filter @itsm/api test` (24/24 testes passando, incluindo 4/4 da `US-003`)
  - `pnpm --filter @itsm/web lint` (`tsc --noEmit` sem erros)

---

### [E06] Portal de Autoatendimento (`US-080`, `US-081` parcial, `US-082`, `US-084`)
- **Épico:** E06 — Portal de Autoatendimento
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - Endpoint `GET /api/v1/incidents/my` em `IncidentsController` + suporte a `requesterOrOpenedById` em `IncidentsService.findAll`, garantindo que o solicitante veja apenas os próprios chamados no Portal.
  - Portal `/portal` completo com:
    - **Branding dinâmico (`US-084`):** aplica `companyName`, `logoUrl` e `primaryColor` de `GET /api/v1/organization`.
    - **Home (`US-080`):** Hero com busca em tempo real e cartões rápidos (*Preciso de ajuda*, *Meus chamados abertos*, *Autoatendimento*).
    - **Abertura com deflexão (`US-081` parcial):** formulário `POST /api/v1/incidents` (canal `PORTAL`) com painel lateral de artigos sugeridos e botão *"Isso resolveu meu problema"* (aguardando módulo E08 para artigos dinâmicos do banco).
    - **Acompanhamento (`US-082`):** lista de chamados do usuário, comentários públicos (`isInternal = false`) e botão **Reabrir Chamado** (`POST /api/v1/incidents/:id/reopen`) quando `RESOLVED`.
- **Arquivos principais:**
  - [incidents.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/incidents/incidents.controller.ts)
  - [incidents.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/incidents/incidents.service.ts)
  - [incidents.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/incidents/incidents.service.spec.ts)
  - [page.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/app/portal/page.tsx)
- **Como testar / validar:**
  - `pnpm --filter @itsm/api test` (25/25 testes passando, incluindo o teste de isolamento da `US-082`)
  - `pnpm --filter @itsm/web lint` (`tsc --noEmit` sem erros)

---

### [E02: US-020, US-021, US-022, US-023, US-025, US-028, US-029] Gestão de Incidentes + Light/Dark Mode
- **Épico:** E02 — Gestão de Incidentes & E03 — Workspace
- **Data de conclusão:** 2026-11-16
- **Resumo do que foi construído:**
  - **Migration `20261117001505_add_incidents_e02`** adicionando `categories`, `resolution_codes`, `hold_reasons` e `task_comments`.
  - **Backend (`IncidentsModule`):** numeração sequencial `INC0000001+`, cálculo automático da matriz Impacto × Urgência (`calculatePriority`), ciclo de vida de estados (`ON_HOLD` exigindo motivo), notas internas vs. comentários públicos (`isInternal` forçado para `false` se usuário final), resolução obrigando código/nota e resolvendo filhos abertos automaticamente, reabertura dentro da janela configurada e seed automático de lookups padrão.
  - **Frontend (`/workspace` + `ThemeToggle`):** Light Mode padrão com alternância Claro/Escuro em todas as telas, KPIs em tempo real, tabela filtrável de incidentes, modal de criação com prévia automática de prioridade e painel lateral estilo SOW com abas `Overview`, `Communicate` e `Timeline`.
- **Arquivos principais:**
  - [incidents.service.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/incidents/incidents.service.ts)
  - [incidents.controller.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/incidents/incidents.controller.ts)
  - [incidents.service.spec.ts](file:///c:/00_PROJETOS/servicenow/apps/api/src/modules/incidents/incidents.service.spec.ts)
  - [workspace/page.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/app/workspace/page.tsx)
  - [theme-toggle.tsx](file:///c:/00_PROJETOS/servicenow/apps/web/src/components/theme-toggle.tsx)
- **Como testar / validar:**
  - `pnpm build` e `pnpm test` (12/12 testes unitários passando).
  - Testar na UI em `http://localhost:3000/workspace`: criar incidente, atribuir, adicionar nota interna vs. comentário público e resolver.
