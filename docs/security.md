# Estratégia inicial de segurança e secrets

| Variável | Finalidade | Ambiente | Armazenamento |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto | Preview/Staging/Production | Vercel Environment Variables |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente público protegido por RLS | Preview/Staging/Production | Vercel Environment Variables |
| `OPENAI_API_KEY` | Chamadas server-side à OpenAI | Ambiente que executar IA | Secret da Vercel; Secret Manager se workload GCP |
| `OPENAI_PROJECT_ID` | Seleção explícita do projeto, se necessária | Server-side | Vercel Environment Variables |
| `OPENAI_ORG_ID` | Seleção explícita da organização, se necessária | Server-side | Vercel Environment Variables |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações administrativas estritamente justificadas | Server-side Production | Secret da Vercel, somente se necessário |

Não duplicar `OPENAI_API_KEY` no GCP enquanto nenhuma workload GCP chamar a API. Senhas de banco ficam restritas a administração/migrations e não entram no runtime web.

Previews não recebem secrets de Production nem acesso a dados reais de pacientes. Variáveis são separadas por escopo Vercel; qualquer acesso persistente exige projeto/dataset não produtivo e RLS revisada.

Seguindo a documentação oficial OpenAI, chaves devem ser carregadas por variável de ambiente ou gerenciador de secrets no servidor e nunca expostas no navegador.
