# Critérios de Aceite Detalhados — Backlog MVP

Este documento detalha os critérios de aceite testáveis de todas as **71 histórias do MVP**, divididas por épico. Uma história só é considerada concluída quando todos os seus critérios passam nos testes automatizados e na validação funcional.

---

## E01 — Plataforma Base

- **US-001 (Setup inicial da empresa):**
  - Dado o primeiro acesso sem organização configurada, quando o administrador preencher nome, domínio de e-mail, fuso horário e logo, então o registro em `organization_settings` é criado e o wizard é bloqueado para usuários comuns.
  - Alterações posteriores refletem imediatamente no cabeçalho do Portal e do Workspace.
- **US-002 (Login e MFA):**
  - Senhas são armazenadas com Argon2id; após 5 tentativas inválidas em 15 min, a conta sofre bloqueio temporário.
  - Se `mfa_enabled = true`, o login exige código TOTP válido de 6 dígitos antes de emitir o JWT.
- **US-003 (SSO SAML/OIDC):**
  - Administrador consegue cadastrar IdP (Client ID, Secret, Issuer/Metadata XML) e ativar login corporativo.
  - Usuário autenticado no IdP é logado automaticamente (ou criado no primeiro acesso se habilitado *Just-In-Time provisioning*).
- **US-004 (Importação CSV e SCIM):**
  - Upload de CSV valida e-mails duplicados/inválidos e exibe relatório de linhas criadas, atualizadas e com erro antes/depois da importação.
  - Endpoints SCIM `/scim/v2/Users` permitem criar, atualizar e desativar usuários via token de integração.
- **US-005 (RBAC — Papéis e Permissões):**
  - Usuário com papel `end_user` recebe HTTP `403` ao acessar qualquer rota de `/workspace` ou `/admin`.
  - Permissões de múltiplos papéis atribuídos a um usuário são somadas; alterações de papel geram entrada em `audit_logs`.
- **US-006 (Auditoria Imutável):**
  - Toda criação, alteração ou exclusão em `tasks`, `users`, `roles`, `slas` e configurações no-code grava `actor_id`, `field_name`, `old_value`, `new_value` e `created_at` em `audit_logs`.
  - Não existem endpoints de `UPDATE` ou `DELETE` para `audit_logs`.
- **US-008 (Internacionalização pt-BR / en / es):**
  - Usuário pode alternar idioma no perfil; textos de interface, menus, estados e mensagens de erro exibem no idioma escolhido sem recarregar dados do servidor.

---

## E02 — Gestão de Incidentes

- **US-020 (Registrar incidente):**
  - Formulário permite selecionar solicitante, categoria/subcategoria, CI afetado, descrição rica e múltiplos anexos (até limite configurável, ex.: 25 MB/arquivo).
  - Ao salvar, sistema gera número sequencial único `INC0000001+` e registra estado inicial `NEW`.
- **US-021 (Matriz Impacto × Urgência):**
  - Matriz 3×3 configurável calcula `priority` (P1–P5) automaticamente no frontend (prévia) e no backend (fonte de verdade).
  - Sobrescrita manual exige permissão específica e preenchimento obrigatório do campo de motivo, gravado em auditoria.
- **US-022 (Ciclo de vida de estados):**
  - Transições válidas: `NEW` → `IN_PROGRESS` / `ON_HOLD` / `RESOLVED` / `CANCELLED`; `ON_HOLD` exige seleção de `hold_reason_id` e pausa SLA se configurado.
  - Estados finais (`CLOSED`, `CANCELLED`) bloqueiam edição de campos operacionais.
- **US-023 (Atribuição e reatribuição):**
  - Ao atribuir a um usuário, o sistema valida se ele pertence ao grupo selecionado (ou permite filtrar apenas membros do grupo).
  - Reatribuir um incidente já atribuído registra evento na linha do tempo e exige justificativa configurável.
- **US-024 (Regras de atribuição automática):**
  - Na criação/atualização, regras ativas são avaliadas por `priority_order`; a primeira que casar define `assigned_group_id` (e `assigned_to_id` se informado) se ainda estiverem vazios.
- **US-025 (Notas de trabalho vs. Comentários):**
  - `is_internal = true` (Nota de Trabalho) aparece com destaque visual (ex.: fundo âmbar) no Workspace e **nunca** é retornado nas APIs do Portal nem enviado ao solicitante por e-mail.
  - `is_internal = false` (Comentário) aparece no Portal e dispara notificação ao solicitante.
- **US-026 (Reabertura pelo usuário):**
  - Enquanto `now() - resolved_at <= reopen_window_days`, o usuário vê o botão "Reabrir" no Portal; ao reabrir, estado volta para `IN_PROGRESS`, `reopen_count` incrementa e o agente/grupo é notificado.
  - Após o prazo, o botão não é exibido e a API rejeita a reabertura.
- **US-027 (Fechamento automático):**
  - Job agendado diário localiza incidentes em `RESOLVED` com `resolved_at` anterior a `auto_close_days`, altera para `CLOSED`, define `closed_at` e dispara pesquisa CSAT.
- **US-028 (Código e nota de resolução obrigatórios):**
  - API e UI impedem transição para `RESOLVED` sem `resolution_code_id` e `resolution_notes` preenchidos.
- **US-029 (Incidente Pai e Filhos):**
  - Agente pode vincular N incidentes a um Pai (vedado criar ciclos ou vincular Pai já filho).
  - Ao resolver o Pai com código/nota de resolução, todos os filhos abertos são resolvidos automaticamente herdando os mesmos dados e notificando seus solicitantes.
- **US-032 (Regras de escalonamento):**
  - Worker verifica periodicamente incidentes abertos que atingiram `threshold_minutes` sem atualização/resolução e executa ações da regra (notificar gestor, reatribuir grupo).
- **US-033 (Templates de incidente):**
  - Selecionar um template pré-preenche categoria, impacto, urgência, grupo e descrições no formulário sem salvar automaticamente até a confirmação do agente.

---

## E03 — Workspace do Agente (SOW)

- **US-040 (Home do Workspace):**
  - Exibe 4 blocos em tempo real: *Meu Trabalho*, *Fila do Meu Grupo*, *Não Atribuídos* e medidor circular de *Incident SLAs* destacando chamados com `< 1h` para violação.
- **US-041 (Listas avançadas):**
  - Suporta filtros combinados (AND/OR), ordenação por qualquer coluna, escolha de colunas visíveis e salvamento de visões pessoais ("Minhas views").
- **US-042 (Abas múltiplas):**
  - Clicar em registros na lista abre novas abas dentro do Workspace sem perder o estado de formulários não salvos de outras abas; suporta fechar e alternar abas.
- **US-043 (Painel lateral de contexto):**
  - Ao abrir um incidente, o painel direito mostra dados do solicitante (departamento, local, VIP), últimos 5 chamados dele e resumo do CI afetado.
- **US-044 (Sugestão de similares e KB):**
  - Painel de *Investigation* busca automaticamente por similaridade textual (`pg_trgm`) os 5 artigos publicados e 5 incidentes resolvidos mais parecidos com o título/descrição.
- **US-045 (Linha do tempo unificada):**
  - Aba/seção cronológica exibe comentários, notas internas, e-mails enviados/recebidos, mudanças de campo auditadas e eventos de SLA com filtro por tipo.
- **US-046 (Edição em massa):**
  - Na lista, selecionar ≥ 2 registros habilita ação em lote para alterar estado, prioridade, grupo ou responsável em uma única transação (validando permissões por registro).
- **US-047 (Atalhos e ações rápidas):**
  - Botões de 1 clique no topo do registro: *Atribuir a mim*, *Colocar em espera*, *Resolver*; atalhos de teclado documentados (`?` abre guia) funcionam sem conflitar com campos de texto.
- **US-048 (Tempo real e presença):**
  - Via WebSocket, quando dois agentes abrem o mesmo registro, ambos veem o avatar do colega ("Fulano está visualizando/editando"); atualizações salvas atualizam a tela sem `F5`.
- **US-051 (Busca global):**
  - Barra no topo do Workspace busca simultaneamente por número exato (`INC...`, `REQ...`, `KB...`), texto em tarefas, usuários e CIs, agrupando resultados por tipo em `< 500 ms`.

---

## E04 — SLA / OLA e Calendários

- **US-060 (Definição de SLAs):**
  - Admin cria SLAs de `RESPONSE` ou `RESOLUTION` definindo tempo alvo e regras JSON de *Início*, *Pausa*, *Parada* e *Reinício*.
- **US-061 (Calendários comerciais e feriados):**
  - Cálculo de `target_end_at` considera apenas minutos dentro da janela configurada por dia da semana e pula datas cadastradas em `calendar_holidays` no fuso do calendário.
- **US-062 (Cronômetro e semáforo de SLA):**
  - Lista e registro exibem barra/badge com tempo restante e percentual consumido: verde (`< 50%`), amarelo (`50–74%`), laranja (`75–99%`), vermelho (`>= 100% / Violado`).
- **US-063 (Alertas 50%, 75%, 100%):**
  - Worker dispara notificação ao agente/grupo exatamente uma vez por marco (`notified_50`, `notified_75`, `notified_100`).
- **US-065 (Relatório de cumprimento de SLA):**
  - Exibe % de SLAs cumpridos vs. violados filtrável por período, grupo e prioridade, com exportação.
- **US-066 (Recálculo ao mudar prioridade):**
  - Se a prioridade mudar e a nova condição casar com outra definição de SLA, o SLA antigo é cancelado e o novo é iniciado (preservando ou reiniciando tempo conforme configuração da definição).

---

## E05 — Notificações e E-mail

- **US-070 (Notificações de ciclo de vida):**
  - Usuário recebe e-mail formatado na abertura, novo comentário público, solicitação de aprovação e resolução/fechamento do chamado.
- **US-071 (Abertura de chamado por e-mail):**
  - Worker IMAP/Graph lê caixa configurada a cada ≤ 1 min; e-mail sem referência a chamado existente cria novo Incidente vinculando remetente (se cadastrado) e anexos do e-mail.
- **US-072 (Resposta por e-mail vira comentário):**
  - E-mail contendo número do chamado no assunto (ex.: `[INC0000042]`) ou `In-Reply-To` válido adiciona o corpo limpo (sem assinatura/histórico citado quando possível) como comentário público no registro.
- **US-073 (Modelos de notificação):**
  - Admin edita assunto e corpo HTML com variáveis (`{{task.number}}`, `{{requester.name}}`, `{{portal_url}}`) e pré-visualiza com dados reais antes de salvar.
- **US-075 (Notificações in-app):**
  - Ícone de sininho no Workspace/Portal mostra badge de não lidas atualizado via WebSocket; clicar marca como lida e navega direto ao registro.

---

## E06 — Portal de Autoatendimento

- **US-080 (Home do Portal):**
  - Layout limpo com barra de busca central, cartões rápidos (*Preciso de ajuda*, *Quero pedir algo*, *Base de Conhecimento*) e resumo de *Meus chamados abertos* / *Aprovações pendentes*.
- **US-081 (Abertura com deflexão por KB):**
  - Ao digitar o título do problema no formulário de incidente do Portal, até 5 artigos publicados relevantes aparecem ao lado; usuário pode clicar em "Isso resolveu meu problema" para encerrar sem abrir chamado.
- **US-082 (Acompanhar e comentar):**
  - Usuário vê apenas seus próprios chamados (ou onde é `requested_for`), acompanha linha do tempo pública, adiciona comentários e envia novos anexos.
- **US-083 (Aprovar/rejeitar no Portal):**
  - Aba/lista de aprovações pendentes permite aprovar ou rejeitar (exigindo motivo na rejeição) com atualização imediata do fluxo.
- **US-084 (Personalização visual):**
  - Portal aplica logo, título e cor primária definidos em `organization_settings` sem necessidade de deploy.

---

## E07 — Catálogo de Serviços e Requisições

- **US-090 (Itens de catálogo):**
  - Admin cria itens vinculados a categorias com descrição rica, imagem, custo informativo, prazo estimado e workflow associado.
- **US-091 (Construtor de formulários do catálogo):**
  - Admin arrasta/adiciona perguntas (`text`, `textarea`, `select`, `date`, `user_ref`, `ci_ref`, `checkbox`, `file`) e configura regras condicionais ("mostrar campo B se campo A = X").
  - Portal valida obrigatoriedade e exibe campos condicionais dinamicamente.
- **US-092 (Carrinho e pedido para terceiros):**
  - Usuário pode adicionar múltiplos itens ao carrinho, definir "Para quem é o pedido" (padrão: ele mesmo) e finalizar gerando uma única `REQ`.
- **US-093 (Hierarquia REQ → RITM → SCTASK):**
  - Checkout cria 1 `REQ`, 1 `RITM` por item do carrinho e dispara o workflow de cada `RITM`, que cria as `SCTASK`s para os grupos executores; fechar todas as `SCTASK`s fecha o `RITM`, e fechar todos os `RITM`s fecha a `REQ`.
- **US-094 (Aprovação via Portal ou E-mail):**
  - E-mail de aprovação contém links assinados com token único de uso único ("Aprovar" / "Rejeitar") que validam expiração e registram decisão sem exigir preenchimento manual complexo.

---

## E08 — Base de Conhecimento

- **US-100 (Editor rico de artigos):**
  - Suporta títulos, listas, tabelas, blocos de código e upload de imagens embutidas.
- **US-101 (Fluxo editorial):**
  - Artigo segue `DRAFT` → `IN_REVIEW` → `PUBLISHED` → `RETIRED`; apenas artigos `PUBLISHED` aparecem para usuários finais no Portal.
- **US-102 (Múltiplas bases e permissões):**
  - Admin cria bases separadas (ex.: "TI Usuários", "Interna Service Desk") definindo quais papéis podem ler e quais podem escrever.
- **US-103 (Busca tolerante a erros):**
  - Busca usa PostgreSQL Full-Text + `pg_trgm` encontrando resultados mesmo com acentuação omitida ou pequenos erros de digitação (ex.: "impresora" encontra "Impressora").
- **US-104 (Avaliação de artigo):**
  - Usuário logado pode votar Útil / Não útil (1 voto por usuário/artigo, editável) e deixar comentário de melhoria.
- **US-105 (Criar artigo a partir de incidente):**
  - Em incidente resolvido, botão "Gerar Artigo de Conhecimento" abre rascunho pré-preenchido com título, descrição e nota de resolução estruturada (inspirado no vídeo: *Issue*, *Resolution*).
- **US-106 (Vincular artigo como solução):**
  - Ao resolver incidente usando sugestão da KB, `resolved_by_kb_id` é gravado permitindo contar quantos incidentes cada artigo resolveu.

---

## E12 — CMDB Mínima

- **US-170 (Cadastro de CIs por classe):**
  - Admin gerencia CIs com atributos específicos por classe (ex.: Servidor: IP, SO, CPU/RAM; Notebook: Serial, Patrimônio, Usuário dono).
- **US-171 (Importação CSV de CIs):**
  - Importação valida classe existente e chave única (`name` ou `serial_number`), permitindo criar ou atualizar CIs em lote com relatório de erros.

---

## E13 — Motor de Workflow e Regras No-Code

- **US-190 (Editor visual básico de fluxos):**
  - Admin monta fluxos com nós: *Início/Gatilho*, *Condição (If/Else)*, *Solicitar Aprovação*, *Criar Tarefa (SCTASK)*, *Enviar Notificação*, *Aguardar Condição/Tempo* e *Atualizar Registro*.
  - Motor BullMQ executa o grafo de forma assíncrona e resiliente a reinícios.
- **US-191 (Regras de negócio sem código):**
  - Admin cria regras `WHEN [entidade + evento] IF [condições] THEN [ações]` (ex.: se Categoria = Rede e VIP = true, definir Urgência = 1 e notificar gestor).

---

## E14 — Relatórios e Dashboards

- **US-200 (Dashboards prontos):**
  - Dashboard padrão do Service Desk com: Chamados abertos por estado, por prioridade, por grupo, Backlog dos últimos 30 dias e % de SLA cumprido.
- **US-201 (Construtor de relatórios no-code):**
  - Gestor escolhe entidade (`Incident`, `RITM`, `SLA`), filtros, agrupamento e tipo de gráfico (`Lista`, `Barra`, `Pizza`, `Linha`, `Indicador`), salva e fixa no dashboard.
- **US-203 (Exportação CSV/Excel/PDF):**
  - Qualquer lista ou relatório salvo pode ser exportado respeitando exatamente os filtros ativos na tela e as permissões do usuário.

---

## E24 — Pesquisas de Satisfação (CSAT)

- **US-300 (Responder CSAT):**
  - Ao fechar incidente/requisição, usuário recebe link no e-mail e aviso no Portal para avaliar de 1 a 5 estrelas + comentário opcional; aceita apenas 1 resposta por chamado.
- **US-301 (Relatório de CSAT):**
  - Gestor visualiza média geral, distribuição de notas e média por grupo/agente em um período selecionado.

---

## E26 — Integrações e API

- **US-320 (API REST + OpenAPI + Tokens):**
  - Documentação interativa Swagger/OpenAPI acessível; Admin gera/revoga tokens com escopos (`read:incidents`, `write:incidents`, etc.) armazenados como hash no banco.
- **US-321 (Webhooks de eventos):**
  - Admin cadastra URL e eventos (`incident.created`, `incident.updated`, `incident.resolved`); sistema envia POST assinado com HMAC-SHA256 e realiza até 3 retentativas com backoff em caso de falha.

---

## E27 — Administração e Configuração No-Code

- **US-330 (Tabelas auxiliares):**
  - CRUD completo de categorias/subcategorias em árvore, códigos de resolução e motivos de espera, com opção de desativar sem quebrar histórico.
- **US-331 (Gestão de grupos):**
  - CRUD de grupos, definição de gestor, e-mail do grupo e adição/remoção de membros.
- **US-332 (Locais e departamentos):**
  - CRUD de localidades (com fuso horário) e departamentos (com gestor).
- **US-333 (Campos personalizados e layout no-code):**
  - Admin cria novos campos (`TEXT`, `NUMBER`, `SELECT`, `DATE`, `USER_REF`, `CI_REF`, `BOOLEAN`) para Incidentes ou CIs e reorganiza seções/colunas do formulário via arrastar e soltar.
  - Campos criados aparecem automaticamente no formulário do Workspace (e Portal se marcado), são persistidos em `custom_fields` e podem ser usados em filtros de listas e relatórios.
- **US-334 (Políticas de UI — campos condicionais):**
  - Admin cria regras no-code no formulário (ex.: "Se `Categoria == Hardware`, tornar campo `Patrimônio` obrigatório e visível"); aplicadas reativamente no frontend e validadas no backend.
