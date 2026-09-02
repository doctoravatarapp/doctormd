# APolloMD — Ativação da Infraestrutura

## Identidade

- Produto: APolloMD
- Identificador preferencial: `apollomd`
- Modo de desenvolvimento: **Cloud Only**
- Repositório oficial: `doctoravatarapp/doctormd`

Este projeto não usa `localhost`, banco local, Docker Desktop, Supabase local nem emuladores locais. Antes de executar qualquer comando mutável, confirme todos os identificadores abaixo. Não use um contexto ativo apenas por ele já estar autenticado.

## Matriz de identidade

| Serviço | Conta esperada | Projeto/escopo esperado |
| --- | --- | --- |
| GitHub | `g4trader` | `doctoravatarapp/doctormd` |
| Supabase | conta com acesso ao projeto | `bscpfutlmsvbwgtkdudv` (`doctormd`) |
| Vercel | `lucianoterresrosa@gmail.com` | team `luciano-terres-projects` |
| Google Cloud | `easywayconsultoria@gmail.com` | `avatar-504818` (`avatar`) |
| OpenAI | conta autorizada do produto | API somente server-side |
| Resend | conta autorizada do produto | domínio `apollomd.com.br`; SMTP do Supabase Auth |

## Procedimento de ativação

Execute a partir da raiz do repositório. Os comandos desta seção foram novamente validados nesta máquina em 2026-08-12.

### 1. Repositório e GitHub

```bash
git remote -v
git status --short --branch
gh auth status
gh repo view doctoravatarapp/doctormd --json nameWithOwner,url,viewerPermission,defaultBranchRef
```

Resultado esperado: o `origin` deve ser `https://github.com/doctoravatarapp/doctormd.git`, a conta ativa deve ser `g4trader` e `viewerPermission` deve ser `WRITE` ou `ADMIN`.

Se a conta estiver errada ou o token estiver inválido, execute `gh auth login -h github.com` e autentique `g4trader`; depois repita todos os comandos. Não grave o token no repositório.

### 2. Supabase

```bash
supabase projects list --output json
```

Resultado esperado: deve existir o projeto `doctormd`, ref `bscpfutlmsvbwgtkdudv`, região `us-east-1`, com estado saudável. Ignore outros projetos da conta.

Vincule explicitamente a CLI deste repositório quando a configuração temporária não estiver presente:

```bash
supabase link --project-ref bscpfutlmsvbwgtkdudv
```

O vínculo testado em 2026-08-07 usou a autenticação da CLI e não solicitou senha. Se uma sessão futura solicitar, forneça-a apenas no prompt seguro; nunca a salve em Git ou neste documento. Valide repetindo `supabase projects list --output json` e confirmando que somente `bscpfutlmsvbwgtkdudv` aparece como `linked: true`. `supabase/.temp/` não é versionado. Não execute `db reset` e não aplique migrations sem revisão.

### 3. Vercel

```bash
vercel whoami
vercel teams list
vercel project list --scope luciano-terres-projects
```

Resultado esperado: identidade `lucianoterresrosa-6245` (conta `lucianoterresrosa@gmail.com`), team `luciano-terres-projects` e projeto `apollomd`.

Projeto ID: `prj_ZPagjWl1tpYe0Xc4jqc1BQRh8e6r`. Repositório conectado: `doctoravatarapp/doctormd`. URL pública: `https://apollomd.vercel.app`.

### 4. Google Cloud

```bash
gcloud auth list --filter=status:ACTIVE --format='table(account,status)'
gcloud config set project avatar-504818
gcloud config get-value project
gcloud projects describe avatar-504818 --format='yaml(projectId,name,projectNumber,lifecycleState)'
```

Resultado esperado: conta ativa `easywayconsultoria@gmail.com`, projeto ativo `avatar-504818`, nome `avatar`, lifecycle `ACTIVE`.

Se a conta estiver errada, use `gcloud auth login easywayconsultoria@gmail.com`, selecione novamente `avatar-504818` e repita a validação. O aviso de quota project das Application Default Credentials não deve ser corrigido automaticamente: configure ADC apenas quando um workload concreto exigir isso e use o projeto oficial.

### 5. OpenAI

A chave privada da OpenAI é usada exclusivamente server-side. Para conferir presença na sessão sem revelar o valor:

```bash
if [ -n "${OPENAI_API_KEY:-}" ]; then printf 'OPENAI_API_KEY=CONFIGURADA\n'; else printf 'OPENAI_API_KEY=NÃO CONFIGURADA\n'; fi
```

Resultado esperado no ambiente cloud que executará a orquestração de IA: `CONFIGURADA`. Nunca faça essa chave chegar ao browser, logs, banco ou Git. A [documentação oficial OpenAI](https://developers.openai.com/api/reference/overview#authentication) determina que a chave seja carregada no servidor por variável de ambiente ou serviço de gestão de secrets.

### 6. Resend / e-mails de autenticação

Os convites e demais mensagens do Supabase Auth usam o SMTP customizado do Resend configurado diretamente no projeto `bscpfutlmsvbwgtkdudv`:

- remetente: `APolloMD <doctor@apollomd.com.br>`
- host: `smtp.resend.com`
- porta: `587` (STARTTLS)
- usuário SMTP: `resend`
- senha SMTP: API key restrita do Resend, armazenada somente no cofre criptografado do Supabase
- intervalo mínimo por usuário: `60` segundos

**Estado em 2026-08-12:** o SMTP foi aceito pelo Supabase, mas o domínio `apollomd.com.br` ainda não foi instalado/verificado no DNS e a entrega real do convite permanece pendente. Até a verificação, use somente o remetente/endereço de teste permitido pelo Resend para ensaios controlados; não considere o fluxo de convite pronto para produção. Quando o DNS estiver configurado, valide SPF/DKIM no painel do Resend, envie um novo convite para um endereço controlado e confira entrega e logs sem registrar conteúdo sensível.

A API key não pertence ao runtime web e não deve ser adicionada à Vercel, a arquivos `.env` ou ao repositório.

## Procedimento de validação

Antes de migrations, deploys ou alterações cloud, a validação só passa se todos os itens aplicáveis forem verdadeiros:

1. `git remote -v` aponta exclusivamente para `doctoravatarapp/doctormd`.
2. `gh repo view` retorna o repositório correto e permissão suficiente.
3. A lista do Supabase contém `bscpfutlmsvbwgtkdudv`; se a operação exigir banco, esse é o projeto vinculado.
4. `vercel whoami` e `vercel teams list` confirmam a conta e o team esperados.
5. `gcloud config get-value project` retorna exatamente `avatar-504818`.
6. Secrets requeridos existem no ambiente cloud correto, verificados apenas por presença.
7. O health check do deployment correspondente passa, quando houver deployment documentado.

Falha em qualquer identidade interrompe somente a etapa daquele provedor. Não substitua o identificador esperado por outro recurso visível na sessão.

## Variáveis necessárias

Contrato inicial documentado em `docs/security.md`, sujeito à integração e revisão de menor privilégio:

### Públicas (browser, protegidas por RLS)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Ambas estão configuradas em Production no projeto Vercel `apollomd`.

### Server-side / secrets

- `OPENAI_API_KEY`
- `OPENAI_PROJECT_ID` — opcional, quando a seleção explícita de projeto for necessária
- `OPENAI_ORG_ID` — opcional, quando a seleção explícita de organização for necessária
- `AI_RESPONSE_MODEL`, `AI_CLASSIFIER_MODEL`, `AI_SUMMARY_MODEL` — opcionais; mantêm os defaults versionados quando ausentes
- `SEMANTIC_REVIEW_THRESHOLD` — opcional; limiar de encaminhamento semântico, com default versionado
- `SUPABASE_SERVICE_ROLE_KEY` — necessária no runtime server-side do chat para persistir respostas da IA e controlar concorrência após validação do paciente sob RLS; nunca exposta ao browser
- `NEXT_PUBLIC_SITE_URL` — URL canônica usada nos convites administrativos (`https://apollomd.vercel.app`); quando ausente, o runtime usa `VERCEL_PROJECT_PRODUCTION_URL` e, por último, a URL canônica de produção
- `CRON_SECRET` — obrigatória para proteger `/api/internal/automations/run`; deve coincidir com o Bearer token configurado no Cloud Scheduler

`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PATIENT_EMAIL`, `PATIENT_PASSWORD`, `APP_URL`, `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` são entradas de scripts operacionais/testes, não variáveis necessárias ao runtime web de produção.

Não adicionar `SUPABASE_DB_PASSWORD` ao runtime web; ela deve ser restrita ao fluxo seguro de administração/migrations quando necessária. Atualize esta lista quando o contrato real for criado.

## Secrets

- Produção/Preview web: armazenar como Environment Variables protegidas no projeto Vercel correto, separadas por ambiente.
- Supabase: credenciais administrativas permanecem no provedor e no armazenamento seguro da CLI/operador autorizado.
- Resend: a chave de envio usada pelo Supabase Auth permanece exclusivamente no campo de senha do SMTP customizado do Supabase; nunca no código ou nas variáveis públicas da aplicação.
- GCP: usar Secret Manager e service accounts de menor privilégio somente quando surgir um workload concreto no GCP.
- Automations scheduler: GCP Cloud Scheduler no projeto `avatar-504818`, chamando a cada minuto o endpoint Vercel protegido por `CRON_SECRET`.
- Desenvolvimento cloud: usar secrets do ambiente remoto, nunca arquivos `.env` versionados.
- GitHub/Vercel/Supabase/GCP CLI: credenciais ficam nos keychains/configurações do usuário, fora do repositório.

Valores nunca devem aparecer neste arquivo, em `.env.example`, logs, issues ou pull requests.

## Deploy

Toda alteração concluída deve ser registrada em commit. Alterações que afetem aplicação, banco, configuração ou infraestrutura devem passar pelo build oficial e por deploy no provedor cloud correto, seguido dos health checks documentados. Preserve arquivos e mudanças não relacionados ao escopo do commit.

Deploy de produção testado:

```bash
vercel link --yes --project apollomd --scope luciano-terres-projects
vercel deploy --prod --yes --scope luciano-terres-projects
```

Pushes para `main` também disparam deploy pelo vínculo GitHub.

Build local validado com Node 22 e pnpm 11. O projeto declara Node `>=22`; a configuração atual da Vercel foi observada usando Node 24.x, que também satisfaz o contrato:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

O script usa `next build --webpack`; o Turbopack não consegue abrir sua porta interna de IPC no sandbox atual. Isso não inicia servidor local e não altera a arquitetura cloud.

## Health checks

- Supabase: `supabase projects list --output json` deve mostrar `bscpfutlmsvbwgtkdudv` como `ACTIVE_HEALTHY`.
- GCP: `gcloud projects describe avatar-504818 --format='value(lifecycleState)'` deve retornar `ACTIVE`.
- GitHub: `gh repo view doctoravatarapp/doctormd --json viewerPermission` deve retornar acesso.
- Aplicação/Vercel: `https://apollomd.vercel.app/` deve retornar HTTP 200.
- Health: `https://apollomd.vercel.app/api/health` deve retornar HTTP 200 e `status: ok`.
- OpenAI: `vercel env ls --scope luciano-terres-projects` deve listar `OPENAI_API_KEY` como `Encrypted` em Production.

## Troubleshooting

### CLI Supabase falha ao gravar `~/.supabase/telemetry.json`

O sandbox pode impedir a escrita no diretório de configuração. Repita a consulta com autorização apropriada para o diretório do usuário; isso não significa, por si só, falha de autenticação.

### Supabase avisa `Cannot find project ref`

O repositório não está vinculado. Confirme primeiro a lista de projetos e só então use `supabase link --project-ref bscpfutlmsvbwgtkdudv` com a credencial correta.

### Vercel retorna `The specified scope does not exist`

A sessão está em conta/team incorreto ou sem permissão. Autentique a conta esperada e valide o team antes de criar ou alterar projetos.

### Next/Turbopack falha com `binding to a port`

O sandbox bloqueia a porta interna usada pelo worker PostCSS do Turbopack. O build oficial configurado usa `next build --webpack`, validado sem iniciar um servidor.

### `supabase db dump` pede Docker

A versão atual da CLI executa `pg_dump` por imagem Docker. Como APolloMD é Cloud Only, não instale ou inicie Docker para contornar isso. Use comandos remotos da CLI/Management API ou o SQL Editor do projeto para inventários futuros.

### GCP mostra outro projeto ativo

Execute `gcloud config set project avatar-504818` e valide novamente. Não altere recursos do projeto anterior.

### Aviso de ADC quota project

O projeto ativo da CLI e o quota project de ADC são configurações distintas. Não mude ADC sem necessidade de workload e revisão de impacto.

### Erro de rede (`ENOTFOUND`, `error connecting`)

Repita a consulta quando o ambiente tiver acesso de rede. Não conclua que a credencial é inválida apenas por falha de DNS.

## Estado atual

Classificação em 2026-08-20:

- **APLICAÇÃO:** Next.js 16.3.0, React 19.2.8, TypeScript 6.0.3, Tailwind CSS 4.3.3, pnpm 11.20.0 e Node `>=22`; portais de administrador e paciente, landing de conversão com captação de leads, chat com IA/handoff humano, médicos, pacientes, listagem e detalhe de acompanhamentos, alertas, automações, configurações, equipe e gestão comercial de leads.
- **VALIDADO — aplicação:** em 2026-09-02, o build remoto de produção passou após a implementação do catálogo e da confirmação de red flags; o deployment público e `/api/health` em `https://www.apollomd.com.br` retornaram HTTP 200 e `status: ok`.
- **ATENÇÃO — GitHub:** `origin` oficial e branch `main` estão corretos, mas, após o commit desta atualização documental, o repositório local fica **7 commits à frente** de `origin/main` (`2b52b6163424372b3930715eed4ae84ba66fe00c`). Os seis commits funcionais locais, do mais antigo ao mais novo, são `4b5849d`, `69da149`, `506ca3d`, `ab78be9`, `c76dd1d` e `5fb91f1`; o sétimo registra este estado de retomada. Não faça pull/reset/rebase para eliminar essa diferença; confirme o `HEAD` e envie os sete commits ao GitHub quando houver autorização explícita.
- **CONFIGURADO/VALIDADO — Supabase:** CLI vinculada exclusivamente a `bscpfutlmsvbwgtkdudv`, projeto `doctormd`, região `us-east-1`, estado `ACTIVE_HEALTHY`. Há 15 migrations versionadas, de `20260807193000_product_foundation.sql` a `20260902213000_red_flag_confirmation_flow.sql`, cobrindo fundação, identidade/acesso, chat, proteção contra spoofing, red flags/takeover, automações interativas, IA contextual, resumos, captação comercial isolada por organização, catálogo canônico de red flags pós-operatórias e confirmação explícita do paciente.
- **CONFIGURADO/VALIDADO — catálogo de red flags:** em 2026-09-02, a migration `20260902203000_install_canonical_red_flags.sql` removeu exclusivamente 16 regras sintéticas e seus 38 eventos de teste identificados por nomes/padrões explícitos. Foram instaladas 22 regras canônicas de `public/redflags.csv` em 8 categorias: 9 de emergência imediata, 9 de contato com o cirurgião e 4 de orientação domiciliar. A migration `20260902213000_red_flag_confirmation_flow.sql` tornou categoria, sinal, prioridade e ação campos próprios e criou `red_flag_confirmations`. Similaridade gera pergunta Sim/Não; somente a confirmação cria `red_flag_events` e entrega exatamente a ação recomendada. O detector normaliza português, aceita frases e grupos de alternativas, aplica exclusões e prioriza emergência; regras canônicas são semeadas para organizações atuais e futuras e só podem ser ativadas/inativadas pela interface.
- **CONFIGURADO/VALIDADO — conversas demo:** em 2026-09-02, `scripts/refresh-demo-conversations.sql` substituiu as conversas do paciente explicitamente sintético `Paciente Teste APolloMD`, exclusivamente na organização `apollomd-demo`, por seis cenários curados e idempotentes. Há três conversas autônomas e três aguardando médico: emergência confirmada, contato com cirurgião confirmado, suspeita rejeitada, decisão medicamentosa encaminhada ao médico, orientação domiciliar confirmada e evolução simples conduzida pela IA. A carga preserva paciente/login, médico, regras canônicas e quaisquer pacientes reais.
- **CONFIGURADO/VALIDADO — leads comerciais:** `public.sales_leads` recebe solicitações da landing exclusivamente pela ação server-side com `SUPABASE_SERVICE_ROLE_KEY`; RLS está ativa e todos os privilégios foram removidos de `anon` e `authenticated`. Cada lead pertence obrigatoriamente à organização resolvida pelo slug server-side `APOLLOMD_SALES_ORGANIZATION_SLUG` (default `apollomd-demo`). Administradores da organização e da plataforma tratam a fila em `/admin/leads` e `/admin/leads/[id]`, sempre com filtro por `organization_id`. Não armazenar dados clínicos nessa tabela. O formulário possui consentimento, honeypot e limitação de três envios por e-mail/hora e organização.
- **CONFIGURADO/VALIDADO — Vercel:** conta `lucianoterresrosa@gmail.com`, identidade CLI `lucianoterresrosa-6245`, team `luciano-terres-projects`, projeto `apollomd`; URLs públicas `https://www.apollomd.com.br` e `https://apollomd.vercel.app`. Em 2026-09-02, a produção recebeu via CLI o novo catálogo e fluxo de confirmação de red flags após Preview aprovado; `/api/health` retornou `status: ok`. Atenção: um deploy automático do `origin/main` antigo pode regredir a produção até que o GitHub seja sincronizado.
- **CONFIGURADO/VALIDADO — GCP:** conta ativa `easywayconsultoria@gmail.com`, projeto ativo `avatar-504818`. O Cloud Scheduler é o mecanismo documentado para chamar `/api/internal/automations/run` com `CRON_SECRET`; confirme o job antes de alterá-lo.
- **CONFIGURADO/VALIDADO — OpenAI:** chave somente server-side armazenada como variável protegida da Vercel; chat, classificação de risco e resumos usam a Responses API. Valor nunca foi documentado.
- **CRIADO — gestão de acessos:** CRUD de memberships em `/admin/team`, convite por Supabase Auth, ativação de senha, auditoria e proteções contra autoexclusão/remoção do último administrador.
- **PENDENTE — e-mail transacional:** SMTP Resend salvo no Supabase Auth, porém domínio/DNS `apollomd.com.br` ainda não verificado e convite real não confirmado. Este é o principal item operacional pendente.
- **UX/UI:** refoundation documentada em `docs/ux-ui-refoundation/FINAL-REPORT.md`; breadcrumbs globais, CRUDs por rotas, legibilidade, detalhe do paciente e preservação da rolagem do chat foram implementados após `b37e1c9`. Em 2026-08-20, foi criada a rota `/admin/episodes` que o breadcrumb já referenciava, o acesso à conversa no detalhe ganhou botão primário responsivo e o item duplicado “Organização” foi removido de Configurações.
- **WORKTREE:** existe o arquivo não versionado `app/admin/conversations/page 2.tsx`, anterior às mudanças recentes. Preserve-o e não o inclua em commits nem o remova sem investigação e autorização explícita.
- **SEGURANÇA:** não registrar ou imprimir secrets. Antes de dados reais, permanecem pendentes as decisões de compliance descritas abaixo.

### DECISÃO DE COMPLIANCE PENDENTE

Antes de dados reais de pacientes: definir bases legais/consentimentos LGPD, retenção e exclusão, residência/transferência de dados, política de logs, backups, resposta a incidentes, operadores/controladores e uso de dados por provedores. Opções técnicas devem ser avaliadas com assessoria jurídica; nenhuma presunção clínica ou jurídica foi implementada.

## Prompt de retomada para uma nova sessão

Use este texto ao retomar o projeto:

> Retome o APolloMD em `/Users/lucianoterres/Documents/GitHub/doctormd`. Leia integralmente `AGENTS.md` e `ativarinfra.md` antes de qualquer ação. O projeto é Cloud Only: não use localhost, Docker, Supabase local, banco local ou emuladores. Valide primeiro, sem expor secrets: GitHub `doctoravatarapp/doctormd`; Supabase `bscpfutlmsvbwgtkdudv`; Vercel team `luciano-terres-projects`, projeto `apollomd`; GCP `avatar-504818`; produção `https://www.apollomd.com.br` e `https://apollomd.vercel.app`. Preserve alterações existentes. Em 2026-08-20, o `main` local ficou 7 commits à frente de `origin/main` (`2b52b6163424372b3930715eed4ae84ba66fe00c`): seis commits funcionais até `5fb91f1` e um commit documental de retomada; confirme novamente o `HEAD`. Não use pull/reset/rebase para apagar essa diferença e não faça push sem autorização explícita. Preserve também o arquivo não versionado `app/admin/conversations/page 2.tsx`. Valide identidades das CLIs, migrations remotas, variáveis apenas por nome/presença e `/api/health`. Não revele valores. O SMTP Resend está salvo no Supabase, mas a entrega real de convites ainda precisa ser validada. Depois informe divergências e riscos antes de qualquer ação mutável.

## Checklist rápido de retomada

1. Ler `AGENTS.md`, este arquivo e `docs/ux-ui-refoundation/FINAL-REPORT.md`.
2. Executar as validações de identidade das seções 1 a 4, sem mudar recursos.
3. Executar `git status --short --branch` e `git log --oneline --decorate -12`; não presumir que GitHub e produção estejam sincronizados.
4. Conferir variáveis da Vercel apenas por nome/ambiente e nunca puxar ou imprimir seus valores.
5. Conferir o projeto Supabase vinculado e a lista de migrations antes de qualquer mudança de banco.
6. Verificar `https://apollomd.vercel.app/api/health`.
7. Rodar lint, typecheck e build antes de publicar alterações.
8. Resolver o domínio/DNS do Resend e validar um convite controlado antes de considerar e-mail pronto.

## Última validação

- Data: 2026-08-20 (America/Sao_Paulo)
- GitHub divergente: após esta atualização documental, `main` local está 7 commits à frente de `origin/main` em `2b52b6163424372b3930715eed4ae84ba66fe00c`; o último commit funcional é `5fb91f1d74ff84e27544e75001ead0f30b7d9362` e o `HEAD` seguinte documenta a retomada.
- Identidades confirmadas em modo somente leitura: GitHub correto com `WRITE`; Supabase correto vinculado e `ACTIVE_HEALTHY`; Vercel conta/team/projeto corretos; GCP conta/projeto corretos.
- Produção: projeto `apollomd` publicado em `https://www.apollomd.com.br` e `https://apollomd.vercel.app`; último health check funcional registrado em 2026-08-20 após o deploy do commit local `5fb91f1`.
- Alteração estrutural mais recente: migration `20260902213000_red_flag_confirmation_flow.sql`, que adicionou os campos explícitos da planilha e o estado persistente de confirmação antes da ação, aplicada ao projeto `bscpfutlmsvbwgtkdudv` em 2026-09-02 após dry-run exclusivo.
- Pendências principais: verificar DNS/domínio e entrega do Resend; definir processo interno de tratamento e retenção dos leads; concluir decisões de compliance antes de dados reais de pacientes.
