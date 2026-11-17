# Cérebro do Agente (Memória Persistente / usar dentro do RAG)

> **Para qualquer LLM que assumir esta sessão:** este arquivo é a **sua memória de longo prazo**. Sempre que uma nova conversa começar ou o modelo for trocado, leia este arquivo antes de agir para recuperar o contexto completo, decisões, aprendizados, armadilhas e o ponto exato onde paramos. Mantenha-o enxuto, factual e vivo (atualize, corrija e remova o que ficou obsoleto).

---

## 1. Contexto & Relação com o Usuário
- **Projeto:** Construção de uma plataforma ITSM inspirada no módulo ITSM do ServiceNow.
- **Modo de trabalho:** Dupla direta (**usuário + você/agente**). Metodologia **Waterfall** (especificar e validar antes de construir).
  - Preferência do usuário:
    - Respostas objetivas, em português, sem inventar fatos (se não viu/testou algo, admitir explicitamente).
    - Documentação viva: só registrar em `documentação.md` o que já foi **efetivamente implementado e testado**.
    - `Soul/skills.md` define quem você é e onde estão os documentos; `Soul/memory.md` é o seu cérebro contínuo; `Control/status.html` é o painel visual com Gantt por história que **deve ser atualizado continuamente** a cada mudança de status; `Control/banco.html` é o diagrama DER (estilo Visual Paradigm) do PostgreSQL que **deve ser atualizado sempre** que `apps/api/prisma/schema.prisma` mudar; `Control/mapping.html` mapeia o processo.

---

## 2. O Que Já Aconteceu (Linha do Tempo de Memória)
1. **Referência visual/produto:** O usuário pediu para analisar o vídeo oficial do ServiceNow ITSM em `https://www.servicenow.com/products/itsm.html`.
   - *Lição aprendida:* Na primeira tentativa o Chrome não tinha depuração remota ativa; após o usuário habilitar `chrome://inspect/#remote-debugging` (`127.0.0.1:9222`), o subagente de navegador assistiu ao vídeo **ITSM Product Overview** (2m01s, Brightcove `6371180605112`) e extraiu a transcrição completa e os 8 segmentos visuais.
   - *Nota técnica:* O link direto do MP4 da Brightcove retorna `403 Missing Auth Token` via `curl` fora do navegador (precisa da sessão/token da página).
2. **Alinhamento de escopo (5 decisões fechadas):**
   - **Single-tenant** (instalado para uma única empresa, sem multi-tenancy/RLS).
   - **Stack:** TypeScript ponta a ponta (Next.js/React + Tailwind + shadcn/ui | NestJS monólito modular + Prisma | PostgreSQL + `pg_trgm` | Redis + BullMQ | MinIO/S3 | Docker Compose).
   - **Time:** 1 pessoa + IA (~18 semanas estimadas para o MVP).
   - **IA no MVP:** **Não entra no MVP** (fica para Release 3).
   - **No-Code no MVP:** **Obrigatório** (`US-091`, `US-190` básico, `US-191`, `US-333`, `US-334`).
3. **Artefatos F0/F1 produzidos:**
   - `Plan/plano_itsm.md`: Plano completo (27 épicos, ~165 histórias, ~71 no MVP, fases waterfall, análise do vídeo na seção 12).
   - `Plan/modelo_dados_e_apis.md`: Esquema PostgreSQL/Prisma completo baseado na tabela unificada `tasks` + especificações REST/WebSocket.
   - `Plan/criterios_aceite_mvp.md`: Critérios de aceite testáveis das 71 histórias do MVP.

---

## 3. Modelo Mental da Arquitetura (O Que Você Precisa Lembrar ao Codar)
- **Herança lógica `TASK`:** Tudo que é trabalho (`INC`, `REQ`, `RITM`, `SCTASK`) nasce em `tasks` e estende em `incidents` / `requests` / `request_items` / `catalog_tasks`. Nunca duplique SLA, anexos, comentários, auditoria ou aprovações por módulo — tudo aponta para `task_id`.
- **Separação estrita Interno vs. Público:** Em `task_comments`, `is_internal = true` é Nota de Trabalho (jamais expor no Portal ou e-mail do solicitante).
- **Motor No-Code:** Campos customizados (`custom_field_definitions`) salvam valores em `tasks.custom_fields` (`JSONB`), com validação dinâmica via Zod no backend e layout/regras guiados por `form_layouts` e `ui_policies`.
- **Workspace inspirado no SOW do vídeo:** Abas múltiplas de registros; dentro do incidente usar abas (`Overview`, `Investigation`, `Details`, `Communicate`, `Related records`, `Playbook`); na Home do agente destacar *Meu Trabalho*, *Fila do Grupo*, *Não Atribuídos* e medidor de *Incident SLAs* (`< 1h` para violar).

---

## 4. Ponto Atual & Próxima Ação
- **Onde paramos:** Fase **F2 (Construção do MVP)** em andamento:
  - Monorepo `pnpm` (`packages/shared`, `apps/api`, `apps/web`) compilando 100% (`pnpm build`) e com **26/26 testes unitários** passando (`pnpm --filter @itsm/api test`).
  - **E01 100% concluído no MVP:** **US-001**, **US-002**, **US-003**, **US-004**, **US-005**, **US-006**, **US-008**.
  - **E06 (Portal `/portal`):** **US-080, US-082, US-084** concluídas + **US-081** parcial (deflexão com guias iniciais até E08), conectadas a `GET /incidents/my`, abertura, comentários públicos e reabertura.
  - **E02 (Incidentes) & UI/UX ServiceNow:** núcleo (**US-021, US-022, US-023, US-025, US-028, além de US-020/026/029/040 parciais**) com `AppShell` (topo `#293e40`, menu lateral `#303a46`, `TopbarActions` sem engrenagem, `DonutChart`, `PriorityBadge`, `StateBadge`), i18n completo (`pt-BR`/`en`/`es`) e seed demo (`pnpm db:seed` em `apps/api/prisma/seed.js`).
  - Migrations `20261116234607_init` e `20261117001505_add_incidents_e02` aplicadas no PostgreSQL 16 portátil (`.local/pgsql`).
  - Painéis visuais atualizados em `Control/`: `Control/status.html` (Jira/Gantt), `Control/banco.html` (DER PostgreSQL) e `Control/mapping.html` (fluxo interativo de governança), acessíveis também direto na rota `/control` do frontend.
- **Nota técnica (`otplib` v13):** A versão instalada usa `generateSecret`, `generateSync`, `verifySync` e `generateURI` (não `authenticator`).
- **Armadilha resolvida (`AuditLog.id` é `BigInt`):** Sempre converter `id.toString()` ao retornar registros de `audit_logs` na API (evita erro 500 `Do not know how to serialize a BigInt`, como ocorreu em `IncidentsService.findOne`).
- **QA Gate obrigatório (`Soul/skills.md` & `Soul/AGENTS.md`):** `Soul/AGENTS.md` (referenciado pela rule global do workspace) carrega o checklist de QA Gate, regras técnicas (`BigInt` em `audit_logs`, herança `TASK`, padrão UI/UX corporativo com `AppShell`) e atualização obrigatória de `documentação.md`, `Control/status.html`, `Control/banco.html` e `Soul/memory.md`.
- **Descoberta de ambiente (Importante):**
  - `node v24.22.1`, `npm 11.19.1`, `pnpm 11.1.2` instalados.
  - `pnpm` v11 bloqueia scripts de build por padrão: já aprovado via `pnpm approve-builds --all` + `pnpm.onlyBuiltDependencies` no `package.json`.
  - **PostgreSQL 16 portátil rodando localmente:** como WSL2 estava desativado (`Wsl/0x80070422`) e o instalador EDB travava em GUI/UAC, baixamos os binários portáteis oficiais em `.local/pgsql` (ignorado no `.gitignore`) e inicializamos `.local/pgdata` (`itsm` / `itsm_dev_password` / `itsm_db`). Migration `20261116234607_init` aplicada com sucesso!
  - `pnpm dev` rodando (`apps/web` em `http://localhost:3000` e `apps/api` em `http://localhost:3001/api/v1`).
  - **Regra operacional:** Nunca rodar `next build` / `pnpm build` enquanto `next dev` está rodando sem limpar `.next` e reiniciar `pnpm dev` (senão `next dev` dá `ENOENT prerender-manifest.json` -> erro 500). Prefira `pnpm --filter @itsm/web lint` (`tsc --noEmit`) durante desenvolvimento ativo.
  - Em PowerShell 5.1, usar `;` em vez de `&&` ao encadear comandos.
- **Próximo passo:**
  1. Finalizar o restante de **E02** (`US-024` atribuição automática, `US-027` fechamento automático, `US-032` escalonamento, `US-033` templates, anexos) e **E06** (abertura/acompanhamento no `/portal`).
  2. Implementar **E03** completo (abas múltiplas no Workspace, painel lateral de contexto) e **E04** (SLAs & Calendários).
