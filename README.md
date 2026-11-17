# Desafio Técnico ioasys — Plataforma ITSM

> Plataforma de Gestão de Serviços de TI (**ITSM**) dedicada (*single-tenant*), inspirada no **ServiceNow ITSM**, construída com arquitetura modular em **TypeScript ponta a ponta**, modelo unificado em `TASK`, auditoria imutável, RBAC, SSO/MFA, i18n (`pt-BR` / `en` / `es`), Portal de Autoatendimento e Workspace operacional.

---

## 1. Visão Geral & Arquitetura

O projeto foi estruturado como um monorepo `pnpm` com separação clara entre contratos compartilhados, backend modular e frontend moderno:

```text
servicenow/
├── packages/shared/       # Schemas Zod, matriz de prioridade, dicionário i18n (pt-BR/en/es)
├── apps/api/              # Backend NestJS 11 + Prisma ORM 6 + PostgreSQL 16 + Swagger
├── apps/web/              # Frontend Next.js 15 (App Router) + React 19 + Tailwind CSS v4
├── Control/               # Painéis visuais vivos (status.html, banco.html, mapping.html)
├── Plan/                  # Especificação Waterfall (plano_itsm.md, modelo_dados_e_apis.md, criterios_aceite_mvp.md)
├── Soul/                  # Governança do agente (AGENTS.md, skills.md, memory.md)
├── documentação.md        # Documentação técnica viva do que já foi implementado e testado
└── docker-compose.yml     # Infraestrutura local (PostgreSQL 16, Redis 7, MinIO)
```

### Decisões Técnicas Principais
- **Herança lógica `TASK`:** Todo registro de trabalho (`INC`, `REQ`, `RITM`, `SCTASK`) nasce em `tasks` e estende em tabelas filhas (`incidents`, etc.), evitando duplicação de comentários, anexos, SLAs e auditoria.
- **Auditoria Imutável (`audit_logs`):** Trilha *append-only* sem endpoints de `UPDATE` ou `DELETE`, com conversão explícita de `BigInt` (`id.toString()`) na serialização JSON.
- **Segurança & Identidade:** Hash de senhas com **Argon2id**, bloqueio temporário por tentativas (`HTTP 429`), **MFA TOTP** (`otplib` v13), **RBAC** com guards globais (`JwtAuthGuard` + `RolesGuard`), **SSO Corporativo (OIDC / SAML)** com *Just-In-Time provisioning* e **SCIM 2.0**.
- **UI/UX Corporativa:** Design System inspirado no **ServiceNow Next Experience** (`AppShell` com Application Navigator recolhível, `Filtrar menu`, Favoritos/Histórico, gráficos Donut e Light/Dark Mode).

---

## 2. O que já foi Implementado e Validado

- **Épico E01 — Plataforma Base (100% no MVP):**
  - `US-001` Setup inicial da empresa (`/setup` + `OrganizationModule`)
  - `US-002` Login com e-mail/senha, bloqueio por tentativas e MFA TOTP (`/login`)
  - `US-003` SSO Corporativo (OIDC / SAML) com JIT provisioning (`/workspace/settings/sso`)
  - `US-004` Importação de usuários/grupos via CSV (`dryRun`) e SCIM 2.0 (`/workspace/users/import`, `/api/v1/scim/v2/Users`)
  - `US-005` RBAC (`end_user`, `agent`, `manager`, `admin`) e guards globais
  - `US-006` Auditoria imutável (`GET /api/v1/audit-logs`, `/workspace/audit`)
  - `US-008` Internacionalização completa (`pt-BR`, `en`, `es`) sem recarregar dados
- **Épico E02 — Gestão de Incidentes (Núcleo):**
  - Criação (`INC0000001+`), matriz 3×3 Impacto × Urgência (`P1`–`P5`), ciclo de estados, atribuição, notas internas vs. comentários públicos, resolução obrigatória, reabertura e vínculo Pai/Filho.
- **Épico E06 — Portal de Autoatendimento (`/portal`):**
  - Branding dinâmico da organização, busca em tempo real, abertura de incidentes com deflexão por artigos sugeridos, acompanhamento, comentários públicos e reabertura.
- **Central Control (`/control`):**
  - Acesso unificado no navegador aos painéis `Control/status.html` (Jira/Gantt), `Control/banco.html` (DER PostgreSQL) e `Control/mapping.html` (fluxo de governança estilo n8n).

---

## 3. Como Rodar Localmente

### Pré-requisitos
- **Node.js** `>= 22.0.0`
- **pnpm** `>= 10.0.0`
- **PostgreSQL 16** (via `docker compose up -d` ou instância local na porta `5432`)

### Passo a Passo

```powershell
# 1. Instalar dependências
pnpm install

# 2. Subir infraestrutura (PostgreSQL, Redis, MinIO)
docker compose up -d

# 3. Gerar Prisma Client, aplicar migrações e popular dados de demonstração
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. Rodar API (porta 3001) e Web (porta 3000) em paralelo
pnpm dev
```

### Acessos & Credenciais Demo
- **Web App:** `http://localhost:3000`
- **Swagger / OpenAPI:** `http://localhost:3001/api/docs` (ou `/api/v1`)
- **Central Control (Painéis HTML):** `http://localhost:3000/control`
- **Usuários criados pelo `pnpm db:seed` (senha padrão `Itsm@2026`):**
  - `ana.n1@itsm.local` (`agent`)
  - `carlos.infra@itsm.local` (`agent`)
  - `mariana.gestora@itsm.local` (`manager`)
  - `joao.usuario@itsm.local` (`end_user`)

---

## 4. Testes & Qualidade

```powershell
# Build completo do monorepo
pnpm build

# Testes unitários da API (26/26 passando)
pnpm --filter @itsm/api test

# Type-check do frontend
pnpm --filter @itsm/web lint
```

---

## 5. Documentação Complementar

- [documentação.md](documentação.md) — Registro técnico vivo de tudo que foi construído e testado
- [Plan/plano_itsm.md](Plan/plano_itsm.md) — Plano completo do produto (27 épicos, fases Waterfall)
- [Plan/modelo_dados_e_apis.md](Plan/modelo_dados_e_apis.md) — Modelo de dados PostgreSQL e especificação de APIs
- [Plan/criterios_aceite_mvp.md](Plan/criterios_aceite_mvp.md) — Critérios de aceite das 71 histórias do MVP
