import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { extractWhatsAppMessages, verifyWhatsAppSignature } from "../lib/integrations/whatsapp/webhook.ts";

test("verifies signed raw body and rejects tampering", () => {
  const body = '{"object":"whatsapp_business_account"}';
  const signature = "sha256=" + createHmac("sha256", "test-secret").update(body).digest("hex");
  assert.equal(verifyWhatsAppSignature(body, signature, "test-secret"), true);
  assert.equal(verifyWhatsAppSignature(body + " ", signature, "test-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, "sha256=bad", "test-secret"), false);
  assert.equal(verifyWhatsAppSignature(body, null, "test-secret"), false);
});

test("extracts text events without assuming a patient identity", () => {
  const payload = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "wamid.1", from: "15550000000", type: "text", text: { body: "Olá" }, timestamp: "123" }, { id: "wamid.2", from: "15550000000", type: "image" }] } }] }] };
  assert.deepEqual(extractWhatsAppMessages(payload), [{ id: "wamid.1", from: "15550000000", type: "text", text: "Olá", timestamp: "123" }, { id: "wamid.2", from: "15550000000", type: "image", text: undefined, timestamp: undefined }]);
  assert.deepEqual(extractWhatsAppMessages({ object: "other", entry: [] }), []);
});
