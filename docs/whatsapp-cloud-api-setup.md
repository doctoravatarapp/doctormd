# WhatsApp Cloud API — ApolloMD (fase de transporte)

## Estado
A branch implementa webhook Meta com verificação HMAC, challenge e inbox durável no Supabase. **Não envia respostas e não associa telefones a pacientes.** A interface web existente permanece inalterada.

## Pré-requisitos antes de conectar na Meta
1. Revisar PR e executar `pnpm typecheck`, `pnpm lint` e `node --experimental-strip-types --test tests/whatsapp-webhook.test.ts` em CI cloud.
2. Aplicar e conferir a migration `20261109141000_whatsapp_inbound_events.sql` no Supabase oficial `bscpfutlmsvbwgtkdudv` por fluxo de deploy revisado.
3. Configurar **somente no servidor Vercel do projeto correto**:
   - `WHATSAPP_ENABLED=true` (somente após banco pronto);
   - `META_WHATSAPP_VERIFY_TOKEN` (segredo aleatório definido pelo operador, igual ao usado na Meta);
   - `META_WHATSAPP_APP_SECRET` (App Secret da Meta, nunca enviar por chat/GitHub);
   - `META_WHATSAPP_PHONE_NUMBER_ID` (ID do número selecionado, não WABA ID).
4. Fazer deploy da branch para ambiente de preview isolado e validar HTTPS e challenge, com token armazenado em ambiente seguro.
5. URL de callback: `https://<dominio-implantado>/api/integrations/whatsapp/webhook`. Na Meta, assinar campo `messages` para o aplicativo e a conta WABA corretos.
6. Validar webhook com eventos de teste. Respostas HTTP 503 indicam falha de persistência e devem ser corrigidas antes de usar dados reais.
7. Publicação do aplicativo Meta e coexistência com WhatsApp Business exigem validação separada; **não migrar ou remover o número do aplicativo**.

## Limites clínicos
Eventos recebidos ficam pendentes, sem IA ou automações. Antes de processar mensagens reais: implementar vinculação de identidade comprovada, consentimento, isolamento por organização, processamento idempotente, auditoria, retenção LGPD, fluxo de urgência e entrega de respostas pelo canal. Não presumir identidade pelo telefone. Não compartilhar tokens ou dados de saúde em logs.
