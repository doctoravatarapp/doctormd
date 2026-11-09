import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only doctor alert inbox. Supabase RLS independently restricts results
 * to alerts assigned to the signed-in doctor in an active organization.
 * No patient content is logged or cached.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  const statuses = ["open", "acknowledged", "escalated", "resolved"] as const;
  if (requestedStatus && !statuses.includes(requestedStatus as typeof statuses[number])) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  let query = supabase
    .from("clinical_alerts" as "messages")
    .select("id,organization_id,care_episode_id,conversation_id,patient_id,severity,status,source,reason_code,created_at,acknowledged_at,resolved_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (requestedStatus) query = query.eq("status" as "sender_type", requestedStatus as never);
  else query = query.in("status" as "sender_type", ["open", "escalated", "acknowledged"] as never);

  const { data, error } = await query;
  if (error) {
    console.error("clinical_alerts_inbox_query_failed", { code: error.code });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  return NextResponse.json({ alerts: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
