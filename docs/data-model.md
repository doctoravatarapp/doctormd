# Modelo de dados

## Entidades

- `organizations`: tenant SaaS.
- `profiles`: perfil do usuário do Supabase Auth.
- `organization_memberships`: vínculo usuário–organização e papel (`organization_admin`, `doctor`, `staff`).
- `platform_admins`: concessão global separada, administrada fora do cliente.
- `doctors`: perfil profissional, distinto do usuário administrativo.
- `patients`: identidade operacional do paciente.
- `care_episodes`: procedimento/acompanhamento específico do paciente e médico.
- `conversations` e `messages`: comunicação contextualizada por organização, paciente e episódio.
- `red_flag_rules` e `red_flag_events`: regra configurada e ocorrência detectada, sem critérios clínicos predefinidos.
- `audit_logs`: rastreabilidade administrativa sem conteúdo clínico desnecessário.

## Multi-tenancy e relações

Todas as tabelas de domínio possuem `organization_id`. Chaves estrangeiras compostas `(id, organization_id)` impedem relações cruzadas entre tenants no próprio banco. Um paciente pode possuir múltiplos episódios; conversas podem ser vinculadas a um episódio específico.

## RLS

RLS está ativa e forçada nas tabelas de domínio. Policies usam `auth.uid()` e funções `security definer` com `search_path` vazio para validar membership ativa e organização ativa. Usuários anônimos não recebem privilégios nas tabelas.

O frontend nunca escolhe livremente `organization_id`: ações server-side derivam a organização da sessão e da membership. RLS continua sendo a barreira definitiva.

## Papéis

- `organization_admin`: administração do tenant e equipe.
- `doctor`: pacientes, episódios, conversas e alertas da organização.
- `staff`: operação autorizada da organização.
- `platform_admin`: concessão independente em `platform_admins`; não pode ser obtida por membership criada pelo cliente.

O RBAC da interface está centralizado em `lib/auth/permissions.ts`; policies equivalentes permanecem no banco.
