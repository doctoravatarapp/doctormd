import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppTestText } from "@/lib/integrations/whatsapp/send-test-text";

type Outbound = {
  id: string; organization_id: string; patient_id: string;
  conversation_id: string; message_id: string;
  recipient_wa_id: string; provider_phone_number_id: string;
};

export async function processWhatsAppOutboundBatch() {
  if (process.env.WHATSAPP_OUTBOUND_ENABLED !== "true") return { disabled: true };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_whatsapp_outbound_batch" as never, { batch_size: 5 } as never);
  if (error) throw new Error("outbound_claim_failed");
  const batch: Outbound[] = Array.isArray(data) ? (data as Outbound[]) : [];
  let sent = 0;
  let failed = 0;
  for (const item of batch) {
    try {
      if (item.provider_phone_number_id !== process.env.META_WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error("phone_id_mismatch");
      }
      const { data: links, error: linkError } = await admin.from("whatsapp_patient_links" as "messages")
        .select("id")
        .eq("organization_id", item.organization_id)
        .eq("patient_id" as "id", item.patient_id)
        .eq("provider_phone_number_id" as "id", item.provider_phone_number_id)
        .eq("sender_wa_id" as "id", item.recipient_wa_id)
        .is("revoked_at" as "created_at", null)
        .limit(1);
      if (linkError || !links?.length) throw new Error("link_revoked");
      // Plain text replies are allowed only inside the 24-hour customer service window.
      const { data: inbound, error: inboundError } = await admin.from("whatsapp_inbound_events" as "messages")
        .select("received_at")
        .eq("sender_wa_id" as "id", item.recipient_wa_id)
        .eq("provider_phone_number_id" as "id", item.provider_phone_number_id)
        .gte("received_at" as "created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
      if (inboundError || !inbound?.length) throw new Error("outside_customer_service_window");
      const { data: message, error: messageError } = await admin.from("messages")
        .select("content,sender_type")
        .eq("id", item.message_id)
        .eq("conversation_id", item.conversation_id)
        .eq("organization_id", item.organization_id)
        .single();
      if (messageError || !message || !["doctor", "system"].includes(message.sender_type)) {
        throw new Error("message_not_approved");
      }
      const result = await sendWhatsAppTestText({ recipientWaId: item.recipient_wa_id, text: message.content });
      await admin.from("whatsapp_outbound_events" as "messages")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.messageId } as never)
        .eq("id", item.id);
      sent++;
    } catch {
      // No automatic retry: network failures may have delivered the message.
      await admin.from("whatsapp_outbound_events" as "messages")
        .update({ status: "failed", error_code: "send_unconfirmed" } as never)
        .eq("id", item.id);
      failed++;
    }
  }
  return { claimed: batch.length, sent, failed };
}
