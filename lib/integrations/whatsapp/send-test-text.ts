import "server-only";

type SendResult = { messageId: string };

export async function sendWhatsAppTestText(args: {
  recipientWaId: string;
  text: string;
}): Promise<SendResult> {
  if (process.env.WHATSAPP_OUTBOUND_ENABLED !== "true") {
    throw new Error("whatsapp_outbound_disabled");
  }
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("whatsapp_outbound_not_configured");
  if (!/^\d{8,20}$/.test(args.recipientWaId) || !args.text.trim() || args.text.length > 4096) {
    throw new Error("invalid_whatsapp_message");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://graph.facebook.com/v27.0/${encodeURIComponent(phoneId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: args.recipientWaId,
        type: "text",
        text: { preview_url: false, body: args.text },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      // Extract numeric Meta error identifiers only; never log or store raw provider text.
      let code = 0;
      let subcode = 0;
      try {
        const failure: unknown = await response.json();
        const error = (failure as { error?: { code?: unknown; error_subcode?: unknown } })?.error;
        if (Number.isSafeInteger(error?.code) && Number(error?.code) >= 0) code = Number(error?.code);
        if (Number.isSafeInteger(error?.error_subcode) && Number(error?.error_subcode) >= 0) subcode = Number(error?.error_subcode);
      } catch { /* preserve HTTP status */ }
      throw new Error(`whatsapp_provider_http_${response.status}_meta_${code}_${subcode}`);
    }
    const payload: unknown = await response.json();
    const id = (payload as { messages?: Array<{ id?: unknown }> })?.messages?.[0]?.id;
    if (typeof id !== "string" || !id) throw new Error("whatsapp_provider_missing_message_id");
    return { messageId: id };
  } finally {
    clearTimeout(timeout);
  }
}
