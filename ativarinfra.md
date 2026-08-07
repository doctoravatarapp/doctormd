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

Resultado esperado: identidade associada a `lucianoterresrosa@gmail.com`, team `luciano-terres-projects` acessível e o projeto APolloMD listado quando ele existir.

Se o scope não existir para a sessão, execute `vercel login` e conclua o device authorization usando a conta `lucianoterresrosa@gmail.com`; depois repita a validação. Não crie um projeto duplicado. O repositório ainda não possui vínculo `.vercel` nem projeto Vercel confirmado.

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

### Server-side / secrets

- `OPENAI_API_KEY`
- `OPENAI_PROJECT_ID` — opcional, quando a seleção explícita de projeto for necessária
- `OPENAI_ORG_ID` — opcional, quando a seleção explícita de organização for necessária
- `SUPABASE_SERVICE_ROLE_KEY` — somente se uma operação server-side realmente exigir bypass de RLS

Não adicionar `SUPABASE_DB_PASSWORD` ao runtime web; ela deve ser restrita ao fluxo seguro de administração/migrations quando necessária. Atualize esta lista quando o contrato real for criado.

## Secrets

- Produção/Preview web: armazenar como Environment Variables protegidas no projeto Vercel correto, separadas por ambiente.
- Supabase: credenciais administrativas permanecem no provedor e no armazenamento seguro da CLI/operador autorizado.
- GCP: usar Secret Manager e service accounts de menor privilégio somente quando surgir um workload concreto no GCP.
- Desenvolvimento cloud: usar secrets do ambiente remoto, nunca arquivos `.env` versionados.
- GitHub/Vercel/Supabase/GCP CLI: credenciais ficam nos keychains/configurações do usuário, fora do repositório.

Valores nunca devem aparecer neste arquivo, em `.env.example`, logs, issues ou pull requests.

## Deploy

**PENDENTE POR AUTENTICAÇÃO VERCEL:** a aplicação existe e o build foi validado, mas ainda não há projeto Vercel vinculado, workflow CI/CD ou deployment confirmado. Antes do primeiro deploy:

1. recuperar acesso ao team `luciano-terres-projects`;
2. verificar se já existe projeto APolloMD no team;
3. vincular o repositório oficial ao projeto existente ou criar um somente se a inexistência for confirmada;
4. configurar as variáveis por ambiente;
5. registrar aqui o comando/processo efetivamente testado, URL, branch e rollback.

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
- Aplicação/Vercel: **PENDENTE**, pois nenhuma URL de deployment foi confirmada. Após o deploy, validar `https://<dominio>/` e `https://<dominio>/api/health`.
- OpenAI: **PENDENTE** até existir endpoint server-side; não validar expondo ou imprimindo a chave.

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
- **ENCONTRADO — repositório:** `origin` oficial configurado; branch local `main`; nenhum histórico remoto ou CI/CD existente antes desta fase.
- **VALIDADO — GitHub:** conta ativa `g4trader`; repositório `doctoravatarapp/doctormd`; permissão `WRITE`. A consulta direta de membership da organização retornou 404, mas o acesso ao repositório foi confirmado.
- **CONFIGURADO/VALIDADO — Supabase:** CLI vinculada a `bscpfutlmsvbwgtkdudv`; projeto `doctormd`, região `us-east-1`, estado `ACTIVE_HEALTHY`; conexão remota de inventário validada. Não existem migrations, Edge Functions ou tabelas de aplicação visíveis em `table-stats`. Schema/RLS/Auth/Storage detalhados permanecem sem inventário completo porque o dump da CLI depende de Docker; nenhuma estrutura foi criada ou modificada.
- **AÇÃO HUMANA NECESSÁRIA — Vercel:** sessão anterior autenticada como `iatronedtech-4883`, com acesso apenas ao team `IATRON`. Fluxo `vercel login` iniciado e aguardando device authorization na conta correta. Nenhum recurso do team IATRON foi tocado.
- **CONFIGURADO/VALIDADO — GCP:** conta ativa `easywayconsultoria@gmail.com`; acesso ao `avatar-504818` validado; contexto local alterado de `staging-503122` para `avatar-504818`; conta possui `roles/owner` (permissão ampla, revisar menor privilégio futuramente). Nenhum recurso GCP adicional foi criado.
- **PENDENTE — OpenAI:** `OPENAI_API_KEY` não está configurada nesta sessão; boundary server-side e estratégia de secrets foram documentados, mas projeto/modelo/limites ainda não foram definidos.
- **CRIADO:** documentação operacional e de arquitetura/segurança, aplicação inicial e proteções de Git.
- **SEGURANÇA:** nenhum arquivo `.env`, secret versionado ou código foi encontrado. O repositório vazio limita a auditoria ao estado atual.

### AÇÃO HUMANA NECESSÁRIA — Vercel

- Serviço: Vercel
- Conta esperada: `lucianoterresrosa@gmail.com`
- Projeto/team esperado: `luciano-terres-projects`
- Motivo: a sessão atual pertence a outra conta/team e o scope esperado não existe para ela.
- Ação necessária: concluir o device authorization iniciado por `vercel login` usando a conta esperada e garantir acesso ao team; não criar projeto duplicado.
- Como validar depois: repetir `vercel whoami`, `vercel teams list` e `vercel project list --scope luciano-terres-projects`.

### AÇÃO HUMANA NECESSÁRIA — OpenAI

- Serviço: OpenAI
- Conta esperada: conta autorizada do APolloMD
- Projeto esperado: projeto OpenAI do APolloMD a confirmar
- Motivo: nenhum secret OpenAI está configurado e ainda não existe runtime server-side.
- Ação necessária: definir o projeto/conta OpenAI e, quando houver projeto Vercel, cadastrar `OPENAI_API_KEY` como secret server-side no ambiente correto.
- Como validar depois: verificar somente presença e executar um health check server-side sem registrar a chave ou dados clínicos.

### DECISÃO DE COMPLIANCE PENDENTE

Antes de dados reais de pacientes: definir bases legais/consentimentos LGPD, retenção e exclusão, residência/transferência de dados, política de logs, backups, resposta a incidentes, operadores/controladores e uso de dados por provedores. Opções técnicas devem ser avaliadas com assessoria jurídica; nenhuma presunção clínica ou jurídica foi implementada.

## Última validação

- Data: 2026-08-07 (America/Sao_Paulo)
- Codex/session: bootstrap inicial do APolloMD
- Resultado: parcial — GitHub, Supabase e GCP validados; Supabase vinculado; aplicação e build validados; Vercel aguarda device authorization e OpenAI aguarda credencial/projeto; nenhum recurso cloud criado ou removido.
