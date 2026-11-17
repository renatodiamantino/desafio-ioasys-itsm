const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed da Plataforma ITSM...');

  // 1. Papéis de sistema (caso ainda não existam)
  const roleDefs = [
    { code: 'end_user', name: 'Usuário Final', isSystem: true },
    { code: 'agent', name: 'Agente', isSystem: true },
    { code: 'manager', name: 'Gestor', isSystem: true },
    { code: 'admin', name: 'Administrador', isSystem: true },
  ];
  const roles = {};
  for (const r of roleDefs) {
    roles[r.code] = await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: r,
    });
  }

  // 2. Locais e Departamentos
  const locNames = [
    { name: 'Matriz São Paulo', country: 'Brasil', state: 'SP', city: 'São Paulo' },
    { name: 'Filial Belo Horizonte', country: 'Brasil', state: 'MG', city: 'Belo Horizonte' },
    { name: 'Remoto', country: 'Brasil', state: null, city: null },
  ];
  const locations = [];
  for (const l of locNames) {
    let found = await prisma.location.findFirst({ where: { name: l.name } });
    if (!found) found = await prisma.location.create({ data: l });
    locations.push(found);
  }

  const deptNames = ['Tecnologia da Informação', 'Recursos Humanos', 'Financeiro', 'Operações'];
  const departments = [];
  for (const name of deptNames) {
    let found = await prisma.department.findFirst({ where: { name } });
    if (!found) found = await prisma.department.create({ data: { name } });
    departments.push(found);
  }

  // 3. Categorias, Códigos de Resolução e Motivos de Espera
  const catNames = ['Rede / VPN', 'Hardware', 'Software / Licenças', 'Acessos & Senhas', 'Banco de Dados'];
  const categories = {};
  for (let i = 0; i < catNames.length; i++) {
    const name = catNames[i];
    let found = await prisma.category.findFirst({ where: { name } });
    if (!found) found = await prisma.category.create({ data: { name, sortOrder: i + 1 } });
    categories[name] = found;
  }

  const resNames = ['Solução definitiva', 'Solução de contorno', 'Reinício / Reset', 'Erro do usuário'];
  const resCodes = {};
  for (const name of resNames) {
    resCodes[name] = await prisma.resolutionCode.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const holdNames = ['Aguardando usuário', 'Aguardando fornecedor', 'Janela de manutenção'];
  const holdReasons = {};
  for (const name of holdNames) {
    holdReasons[name] = await prisma.holdReason.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 4. Usuários de demonstração (senha padrão: Itsm@2026)
  const passwordHash = await argon2.hash('Itsm@2026', { type: argon2.argon2id });
  const userDefs = [
    { email: 'ana.n1@itsm.local', name: 'Ana Paula (Agente N1)', role: 'agent', jobTitle: 'Analista Service Desk N1' },
    { email: 'carlos.infra@itsm.local', name: 'Carlos Eduardo (Infra)', role: 'agent', jobTitle: 'Especialista Redes & Infra' },
    { email: 'mariana.gestora@itsm.local', name: 'Mariana Costa (Gestora)', role: 'manager', jobTitle: 'Gestora de Service Desk' },
    { email: 'joao.usuario@itsm.local', name: 'João Pedro (Solicitante)', role: 'end_user', jobTitle: 'Analista Financeiro' },
  ];

  const users = {};
  for (const u of userDefs) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash,
          jobTitle: u.jobTitle,
          departmentId: departments[0].id,
          locationId: locations[0].id,
          isActive: true,
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: roles[u.role].id },
      });
    }
    users[u.email] = user;
  }

  // Também vincula o primeiro usuário existente (ex.: admin criado no /setup) para ele ver chamados no /portal
  const firstAdmin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  const portalUser = firstAdmin || users['joao.usuario@itsm.local'];

  // 5. Grupos resolvedores
  const groupDefs = [
    { name: 'Service Desk N1', email: 'n1@itsm.local', member: users['ana.n1@itsm.local'] },
    { name: 'Infraestrutura & Redes', email: 'infra@itsm.local', member: users['carlos.infra@itsm.local'] },
    { name: 'Sustentação Sistemas', email: 'sistemas@itsm.local', member: users['ana.n1@itsm.local'] },
  ];
  const groups = {};
  for (const g of groupDefs) {
    const grp = await prisma.group.upsert({
      where: { name: g.name },
      update: {},
      create: {
        name: g.name,
        email: g.email,
        managerId: users['mariana.gestora@itsm.local'].id,
      },
    });
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: grp.id, userId: g.member.id } },
      update: {},
      create: { groupId: grp.id, userId: g.member.id },
    });
    groups[g.name] = grp;
  }

  // 6. Incidentes de demonstração (idempotente por number)
  const incidents = [
    {
      number: 'INC0000010',
      shortDescription: 'VPN corporativa fora do ar para equipe remota',
      description: 'Usuários em home office recebem timeout ao autenticar no gateway VPN principal.',
      state: 'NEW',
      impact: 1,
      urgency: 1,
      priority: 1,
      channel: 'PORTAL',
      requesterId: portalUser.id,
      openedById: portalUser.id,
      assignedGroupId: groups['Infraestrutura & Redes'].id,
      assignedToId: null,
      categoryId: categories['Rede / VPN'].id,
      comment: { body: 'Relatado por 8 colaboradores desde 08:30.', isInternal: false, authorId: portalUser.id },
    },
    {
      number: 'INC0000011',
      shortDescription: 'Lentidão crítica no ERP financeiro durante fechamento',
      description: 'Tela de conciliação bancária demorando mais de 45 segundos para responder.',
      state: 'IN_PROGRESS',
      impact: 1,
      urgency: 2,
      priority: 2,
      channel: 'PHONE',
      requesterId: users['joao.usuario@itsm.local'].id,
      openedById: users['ana.n1@itsm.local'].id,
      assignedGroupId: groups['Sustentação Sistemas'].id,
      assignedToId: users['carlos.infra@itsm.local'].id,
      categoryId: categories['Banco de Dados'].id,
      comment: { body: 'Verificando locks ativos no PostgreSQL de produção.', isInternal: true, authorId: users['carlos.infra@itsm.local'].id },
    },
    {
      number: 'INC0000012',
      shortDescription: 'Teclado do notebook com teclas falhando (Dell Latitude)',
      description: 'Teclas Enter e Backspace não respondem após atualização.',
      state: 'ON_HOLD',
      impact: 3,
      urgency: 2,
      priority: 4,
      channel: 'PORTAL',
      requesterId: portalUser.id,
      openedById: portalUser.id,
      assignedGroupId: groups['Service Desk N1'].id,
      assignedToId: users['ana.n1@itsm.local'].id,
      categoryId: categories['Hardware'].id,
      holdReasonId: holdReasons['Aguardando fornecedor'].id,
      comment: { body: 'Chamado de garantia aberto na Dell; peça prevista para sexta-feira.', isInternal: false, authorId: users['ana.n1@itsm.local'].id },
    },
    {
      number: 'INC0000013',
      shortDescription: 'Reset de MFA e liberação de acesso ao Microsoft Teams',
      description: 'Usuário trocou de celular e perdeu acesso ao aplicativo autenticador.',
      state: 'RESOLVED',
      impact: 3,
      urgency: 2,
      priority: 4,
      channel: 'EMAIL',
      requesterId: portalUser.id,
      openedById: portalUser.id,
      assignedGroupId: groups['Service Desk N1'].id,
      assignedToId: users['ana.n1@itsm.local'].id,
      categoryId: categories['Acessos & Senhas'].id,
      resolutionCodeId: resCodes['Reinício / Reset'].id,
      resolutionNotes: 'Token TOTP resetado e novo QR Code validado com o usuário.',
      resolvedAt: new Date(),
      comment: { body: 'Acesso normalizado, favor validar no seu dispositivo.', isInternal: false, authorId: users['ana.n1@itsm.local'].id },
    },
    {
      number: 'INC0000014',
      shortDescription: 'Solicitação de licença do Figma para novo designer',
      description: 'Novo colaborador precisa de acesso ao workspace de Design System.',
      state: 'NEW',
      impact: 3,
      urgency: 3,
      priority: 5,
      channel: 'PORTAL',
      requesterId: users['joao.usuario@itsm.local'].id,
      openedById: users['joao.usuario@itsm.local'].id,
      assignedGroupId: groups['Service Desk N1'].id,
      assignedToId: null,
      categoryId: categories['Software / Licenças'].id,
    },
  ];

  let createdIncidents = 0;
  for (const inc of incidents) {
    const exists = await prisma.task.findUnique({ where: { number: inc.number } });
    if (exists) continue;

    const task = await prisma.task.create({
      data: {
        number: inc.number,
        taskType: 'INCIDENT',
        shortDescription: inc.shortDescription,
        description: inc.description,
        state: inc.state,
        impact: inc.impact,
        urgency: inc.urgency,
        priority: inc.priority,
        requesterId: inc.requesterId,
        openedById: inc.openedById,
        assignedGroupId: inc.assignedGroupId,
        assignedToId: inc.assignedToId,
        locationId: locations[0].id,
        resolvedAt: inc.resolvedAt ?? null,
        incident: {
          create: {
            channel: inc.channel,
            categoryId: inc.categoryId,
            holdReasonId: inc.holdReasonId ?? null,
            resolutionCodeId: inc.resolutionCodeId ?? null,
            resolutionNotes: inc.resolutionNotes ?? null,
          },
        },
      },
    });

    if (inc.comment) {
      await prisma.taskComment.create({
        data: {
          taskId: task.id,
          authorId: inc.comment.authorId,
          body: inc.comment.body,
          isInternal: inc.comment.isInternal,
          source: 'SEED',
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'incident',
        entityId: task.id,
        action: 'CREATE',
        actorId: inc.openedById,
        newValue: { number: inc.number, state: inc.state, priority: inc.priority },
      },
    });
    createdIncidents++;
  }

  console.log(`Seed concluído! Incidentes criados: ${createdIncidents}. Senha padrão dos usuários demo: Itsm@2026`);
}

main()
  .catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
