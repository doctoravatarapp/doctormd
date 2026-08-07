# Arquitetura inicial

APolloMD começa como aplicação full-stack Next.js hospedada na Vercel, com Supabase para PostgreSQL/Auth/RLS e OpenAI acessada somente por rotas server-side. GCP permanece reservado para workloads que tenham necessidade concreta.

## Ambientes cloud

- **Preview:** deployments automáticos de branches/PRs. Não podem receber dados reais de pacientes. Até existir um projeto Supabase isolado, previews usarão apenas interface estática/mocks sem dados clínicos.
- **Staging:** branch e deployment persistentes a definir. Exigirá dados sintéticos e isolamento de produção.
- **Production:** branch `main`, Vercel Production e Supabase de produção somente após revisão de RLS, segurança e compliance.

**DECISÃO ARQUITETURAL PENDENTE:** definir se Staging receberá um segundo projeto Supabase quando a primeira funcionalidade persistente for implementada. Não serão criados três bancos antecipadamente.

## Limites

- UI em `app/` e `components/`.
- Integrações OpenAI em `lib/ai/`, exclusivamente server-side.
- Integração Supabase em `lib/supabase/`.
- Orquestrações de domínio em `services/`.
- Tipos compartilhados em `types/`.

Não há backend Python separado. Os recursos server-side do Next.js são o primeiro backend.
