# Regras Obrigatórias do Workspace — Plataforma ITSM

Estas regras são carregadas automaticamente em todas as sessões e trocas de modelo. Siga-as **sempre** antes de encerrar qualquer tarefa:

## 1. Alinhamento Inicial
- Leia `Soul/memory.md` e `Soul/skills.md` ao iniciar uma nova sessão para recuperar decisões, convenções e o ponto exato de parada.
- Consulte `Plan/plano_itsm.md`, `Plan/modelo_dados_e_apis.md` e `Plan/criterios_aceite_mvp.md` antes de implementar qualquer história.

## 2. Padrões Técnicos Críticos
- **Herança lógica `TASK`:** Todo registro de trabalho (`INC`, `REQ`, `RITM`, `SCTASK`) nasce em `tasks` e estende em tabelas filhas (`incidents`, etc.).
- **Separação Interno vs. Público:** `is_internal = true` em comentários nunca pode ser exposto no `/portal` ou a `end_user`.
- **`BigInt` em `audit_logs`:** Sempre converter `id.toString()` ao retornar registros de `audit_logs` em JSON para evitar `500 Internal Server Error` (`Do not know how to serialize a BigInt`).
- **Padrão UI/UX Corporativo:** Toda tela do `/workspace` deve usar o `AppShell` (Sidebar + Topbar limpa, nunca amontoar botões no header); usar badges semânticos por prioridade/estado, ícones SVG, Master-Detail com abas e consistência em Light/Dark Mode.
- **PowerShell 5.1:** Usar `;` (não `&&`) ao encadear comandos no terminal.

## 3. QA Gate Obrigatório (Antes de Concluir História ou Épico)
1. **Build & Type-check:** `pnpm --filter @itsm/api build` e `pnpm --filter @itsm/web lint` (`tsc --noEmit`) sem erros.
2. **Testes unitários:** `pnpm --filter @itsm/api test` com 100% de aprovação.
3. **Teste de Integração / Smoke HTTP:** Validar endpoints novos/alterados contra a API/PostgreSQL quando acessíveis e revisar serialização JSON e permissões (`403` para `end_user`).
4. **Conferência de UI:** Verificar rotas afetadas e consistência de Light/Dark Mode e i18n (`pt-BR`/`en`/`es`).

## 4. Documentação Viva Obrigatória (Definition of Done)
Após aprovação no QA Gate, **sempre** atualizar antes de responder ao usuário:
- `documentação.md` — apenas o que foi implementado e testado.
- `Control/status.html` — status da história (`done`/`partial`/`progress`), evidências e `#last-updated`.
- `Control/banco.html` — sempre que `apps/api/prisma/schema.prisma` tiver novas tabelas, colunas ou FKs.
- `Soul/memory.md` — aprendizado, armadilha resolvida, contagem de testes e próximo passo.
