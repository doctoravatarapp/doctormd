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

## Procedimento de ativação

Execute a partir da raiz do repositório. Os comandos desta seção foram testados nesta máquina em 2026-08-07.

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
- `SUPABASE_SERVICE_ROLE_KEY` — necessária no runtime server-side do chat para persistir respostas da IA e controlar concorrência após validação do paciente sob RLS; nunca exposta ao browser
- `NEXT_PUBLIC_SITE_URL` — URL canônica usada nos convites administrativos (`https://apollomd.vercel.app`); quando ausente, o runtime usa `VERCEL_PROJECT_PRODUCTION_URL` e, por último, a URL canônica de produção

Não adicionar `SUPABASE_DB_PASSWORD` ao runtime web; ela deve ser restrita ao fluxo seguro de administração/migrations quando necessária. Atualize esta lista quando o contrato real for criado.

## Secrets

- Produção/Preview web: armazenar como Environment Variables protegidas no projeto Vercel correto, separadas por ambiente.
- Supabase: credenciais administrativas permanecem no provedor e no armazenamento seguro da CLI/operador autorizado.
- GCP: usar Secret Manager e service accounts de menor privilégio somente quando surgir um workload concreto no GCP.
- Automations scheduler: GCP Cloud Scheduler no projeto `avatar-504818`, chamando a cada minuto o endpoint Vercel protegido por `CRON_SECRET`.
- Desenvolvimento cloud: usar secrets do ambiente remoto, nunca arquivos `.env` versionados.
- GitHub/Vercel/Supabase/GCP CLI: credenciais ficam nos keychains/configurações do usuário, fora do repositório.

Valores nunca devem aparecer neste arquivo, em `.env.example`, logs, issues ou pull requests.

## Deploy

Deploy de produção testado:

```bash
vercel link --yes --project apollomd --scope luciano-terres-projects
vercel deploy --prod --yes --scope luciano-terres-projects
```

Pushes para `main` também disparam deploy pelo vínculo GitHub.

Build de produção validado com Node 22 e pnpm 11:

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

Classificação em 2026-08-07:

- **CRIADO — aplicação:** Next.js 16.3.0, React 19.2.8, TypeScript 6.0.3, Tailwind CSS 4.3.3, Node 22 e pnpm 11.20.0; home responsiva e endpoint server-side `/api/health`.
- **VALIDADO — aplicação:** lint, typecheck e build de produção passaram. Rotas geradas: `/` estática e `/api/health` dinâmica.
- **CONFIGURADO/VALIDADO — GitHub:** `origin` oficial; branch `main`; commit inicial `2f8b2eb` enviado com sucesso para `doctoravatarapp/doctormd`. Não existe CI/CD além da futura integração Vercel.
- **VALIDADO — GitHub:** conta ativa `g4trader`; repositório `doctoravatarapp/doctormd`; permissão `WRITE`. A consulta direta de membership da organização retornou 404, mas o acesso ao repositório foi confirmado.
- **CONFIGURADO/VALIDADO — Supabase:** CLI vinculada a `bscpfutlmsvbwgtkdudv`; migration `20260807193000_product_foundation.sql` aplicada; 12 tabelas de fundação criadas com RLS; lint remoto sem erros; leitura e escrita anônimas em `patients` retornam HTTP 401.
- **CONFIGURADO/VALIDADO — Vercel:** conta `lucianoterresrosa@gmail.com`, team `luciano-terres-projects`, projeto `apollomd`, GitHub conectado, deployment Production Ready e URL pública `https://apollomd.vercel.app`; home e health retornam HTTP 200.
- **CONFIGURADO/VALIDADO — GCP:** conta ativa `easywayconsultoria@gmail.com`; acesso ao `avatar-504818` validado; contexto local alterado de `staging-503122` para `avatar-504818`; conta possui `roles/owner` (permissão ampla, revisar menor privilégio futuramente). Nenhum recurso GCP adicional foi criado.
- **CONFIGURADO/VALIDADO — OpenAI:** `OPENAI_API_KEY` armazenada como variável `Encrypted`, exclusivamente em Production na Vercel. Valor não exibido.
- **CRIADO — gestão de acessos:** CRUD de memberships em `/admin/team`, convite por Supabase Auth, ativação segura de senha, trilha de auditoria e proteções contra autoexclusão/remoção do último administrador.
- **CRIADO:** documentação operacional e de arquitetura/segurança, aplicação inicial e proteções de Git.
- **SEGURANÇA:** nenhum arquivo `.env`, secret versionado ou código foi encontrado. O repositório vazio limita a auditoria ao estado atual.

### DECISÃO DE COMPLIANCE PENDENTE

Antes de dados reais de pacientes: definir bases legais/consentimentos LGPD, retenção e exclusão, residência/transferência de dados, política de logs, backups, resposta a incidentes, operadores/controladores e uso de dados por provedores. Opções técnicas devem ser avaliadas com assessoria jurídica; nenhuma presunção clínica ou jurídica foi implementada.

## Última validação

- Data: 2026-08-07 (America/Sao_Paulo)
- Codex/session: bootstrap inicial do APolloMD
- Resultado: infraestrutura ativa — GitHub, Supabase, Vercel, GCP, OpenAI, deployment público e health check validados.
