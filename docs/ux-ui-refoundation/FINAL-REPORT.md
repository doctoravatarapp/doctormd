# APolloMD — Relatório final UX/UI Refoundation

Data: 2026-08-11 (America/Sao_Paulo)  
Baseline auditada: `b37e1c9`  
Produção: https://apollomd.vercel.app

## Escopo validado

- Patient: home, conversa, topbar, sidebar e drawer.
- Admin: visão geral, doctors, settings, sidebar mobile e drawer de cadastro.
- Viewports: 375×812, 390×844, 768×1024, 1366×768, 1440×900 e 1920×1080.

## Achados e correções

### 1. Composer do patient comprimido

**Impacto:** o campo de mensagem ocupava aproximadamente 205 px dentro de um viewport de 390 px e o disclaimer era posicionado ao lado do campo. O problema também ocorria em desktop.

**Causa:** seletores globais da landing page (`footer` e `.chat-composer`) vazavam para o portal autenticado.

**Correção:** os estilos da landing foram limitados a `.page-shell > footer` e `.chat-card .chat-composer`; o composer do patient recebeu `width: 100%` e o textarea, `min-width: 0`.

**Resultado em produção:** largura útil do composer em 390×844 passou para 369 px e o disclaimer voltou para sua linha própria.

### 2. Topbar desktop do patient desalinhada

**Impacto:** título/subtítulo ficavam encostados à esquerda e o indicador “Seguro” ocupava a coluna central.

**Causa:** o botão mobile oculto saía do grid e deslocava os demais filhos para colunas incorretas.

**Correção:** atribuição explícita de colunas para botão, título e indicador seguro.

**Resultado em produção:** título centralizado e indicador alinhado à direita em desktop, sem regressão móvel.

## Resultado por superfície

| Superfície | Desktop | Mobile/tablet | Resultado |
|---|---:|---:|---|
| Patient home | 1440×900 | 375×812 | Aprovado |
| Patient chat | 1366×768 | 390×844 | Aprovado após correções |
| Patient drawer | — | 390×844 | Aprovado |
| Admin dashboard | 1440×900 | 375×812 | Aprovado |
| Doctors | 1920×1080 | 375×812 | Aprovado |
| Settings | 1366×768 | 768×1024 | Aprovado |
| Admin form drawer | — | 375×812 e 390×844 | Aprovado |

## Evidências

As capturas estão em [`screenshots/`](./screenshots/). Os arquivos `*-after.png` registram a validação pós-deploy dos reparos no patient.

## Verificações técnicas

- `corepack pnpm lint`: passou.
- `corepack pnpm typecheck`: passou.
- `corepack pnpm build`: passou com Next.js 16.3.0/webpack.
- `GET /api/health`: HTTP 200, `status: ok`.
- `GET /`: HTTP 200.
- Deploy de produção Vercel concluído no projeto `luciano-terres-projects/apollomd`.

## Conclusão

A UX/UI Refoundation está aprovada para o escopo auditado. Os fluxos autenticados de patient e admin permanecem responsivos nos seis viewports solicitados, os drawers preservam leitura e área de toque, e os dois vazamentos de layout encontrados foram corrigidos e revalidados em produção.
