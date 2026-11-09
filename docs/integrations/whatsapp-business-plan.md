# ApolloMD — WhatsApp Business integration plan

Status: preparation only; integration NOT active in production.
Existing number: +55 51 99360-6942, currently active in the WhatsApp Business mobile app.
Infrastructure: GitHub doctoravatarapp/doctormd, Supabase bscpfutlmsvbwgtkdudv, Vercel apollomd.
Goal: add official Meta WhatsApp Cloud API as a patient-facing channel without removing the existing patient portal chat.

## Meta onboarding prerequisite
Check eligibility for official WhatsApp Business App / Cloud API coexistence before touching the live number. Confirm ownership and permissions of Meta Business Portfolio, WhatsApp Business Account (WABA), phone number ID, app and webhook subscription. Never deregister or migrate the live number without explicit approval. Do not use unofficial WhatsApp Web automation.

## Core architecture
Meta webhook (GET challenge / POST signed events) -> durable, deduplicated event inbox -> verified organization-scoped patient link -> shared conversation orchestration -> existing Supabase messages, AI, red flags, automations, doctor takeover -> outbound queue -> Meta Cloud API.

The current app/api/patient/chat/route.ts authenticates portal users and contains clinical orchestration. Extract reusable orchestration into a server-only service; do not invoke the portal route from the webhook or duplicate clinical logic.

The current app/admin/conversations/[id]/actions.ts calls send_doctor_message RPC. Ensure doctor and system messages produce outbound jobs for WhatsApp-linked conversations without changing portal behavior.

## Safety and security
- Phone possession is insufficient for patient identity. Require an authenticated and revocable patient-to-WhatsApp linking flow and explicit opt-in before sending clinical details.
- Verify X-Hub-Signature-256 using the Meta App Secret; use constant-time comparison. Verify GET challenge token. Keep all secrets server-side.
- Store Meta event/message IDs for deduplication; handle retries, out-of-order events and delivery status updates.
- Scope all reads/writes by organization and patient; RLS and least privilege. No PHI, tokens, phone numbers or message bodies in logs.
- Use an outbox and retry strategy for outbound messages; handle the customer service window and approved templates outside it.
- Preserve red-flag escalation, human takeover, audit logs and patient portal availability.
- Clinical communications require LGPD review, patient consent and clear emergency limitations.
- Text-only pilot recommended; defer media and voice.

## Proposed data model (migration pending review)
- whatsapp_accounts (organization_id, waba_id, phone_number_id, status)
- whatsapp_patient_links (organization_id, patient_id, wa_id, verified_at, consent_at, revoked_at)
- whatsapp_webhook_events (provider_event_id, organization_id, kind, processing_state, timestamps)
- whatsapp_outbox (organization_id, message_id, recipient_link_id, status, attempts, next_attempt_at, idempotency_key)
- whatsapp_message_status (message_id, provider_message_id, status, timestamps, error_code)
- Explicit message channel metadata; maintain canonical conversations/messages.

## Implementation phases
0. Meta Business account and coexistence eligibility, consent and security decisions.
1. Feature flag default OFF, database migration, signed webhook verification, durable idempotent inbox and tests.
2. Shared clinical conversation service for portal and verified WhatsApp adapter; regression tests for red flags and automations.
3. Meta outbound sender with outbox, doctor replies, statuses, approved templates and retry.
4. Test with consenting test patients, including duplicate events, unverified senders, takeover, opt-out, failures and isolation.
5. Launch only after explicit approval; rollback via feature flag.

## Environment variables (names only; never commit values)
WHATSAPP_ENABLED=false
META_WHATSAPP_VERIFY_TOKEN
META_WHATSAPP_APP_SECRET
META_WHATSAPP_ACCESS_TOKEN
META_WHATSAPP_PHONE_NUMBER_ID
META_WHATSAPP_WABA_ID
META_GRAPH_API_VERSION

## Acceptance criteria
- Portal and admin chats continue functioning.
- Verified patients can use WhatsApp; unknown numbers receive no medical details.
- All channels share one canonical message history and existing clinical rules.
- Webhook replay cannot duplicate messages, alerts or automation actions.
- Doctor takeover stops AI responses; doctor replies reach the patient via the chosen channel.
- Failed outbound deliveries are visible and retryable.
- No live-number interruption during preparation and pilot.

No production deployment, database mutation, Meta number migration or credential change is part of this plan.
