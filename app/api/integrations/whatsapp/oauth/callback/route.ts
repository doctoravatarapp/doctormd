// Reserved endpoint for a future Meta-hosted Embedded Signup OAuth callback.
// IMPORTANT: This is deliberately NOT an active OAuth implementation.
// Do not exchange codes, register phone numbers, or attach a WABA until
// the signup flow supports verified state, user authorization, and tenant binding.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
};

export async function GET(request: Request) {
  // Discard all OAuth query parameters, including authorization codes.
  // Never log or persist credentials while the flow is disabled.
  void request;
  return new Response(JSON.stringify({
    error: "oauth_not_configured",
    message: "WhatsApp Embedded Signup is not enabled for this application.",
  }), { status: 503, headers });
}
