# APolloMD

SaaS web AI First para atendimento e acompanhamento conversacional de pacientes de cirurgiões.

## Estado atual

Bootstrap cloud com Next.js, React, TypeScript, Tailwind CSS e endpoint `GET /api/health`. Funcionalidades clínicas ainda não estão implementadas.

APolloMD é **Cloud Only**. Leia [ativarinfra.md](./ativarinfra.md) antes de qualquer operação de infraestrutura, banco ou deploy.

## Validação de build

Use Node.js 22 e pnpm 11. O build validado é:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

Esses comandos validam o artefato; desenvolvimento, execução oficial, integrações e testes funcionais acontecem em ambientes cloud.
