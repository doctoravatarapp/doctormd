import { createClient } from "@supabase/supabase-js";
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const suffix = crypto.randomUUID(); const password = `${crypto.randomUUID()}Aa1!`;
const createdUsers = []; const createdOrgs = [];
try {
  const fixtures = [];
  for (const label of ["A", "B"]) {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email: `patient-${label.toLowerCase()}-${suffix}@example.invalid`, password, email_confirm: true }); if (userError) throw userError; createdUsers.push(userData.user.id);
    const { data: org, error: orgError } = await admin.from("organizations").insert({ name: `Patient isolation ${label} ${suffix}`, slug: `patient-isolation-${label.toLowerCase()}-${suffix}` }).select("id").single(); if (orgError) throw orgError; createdOrgs.push(org.id);
    const { data: doctor, error: doctorError } = await admin.from("doctors").insert({ organization_id: org.id, display_name: `Doctor ${label}` }).select("id").single(); if (doctorError) throw doctorError;
    const { data: patient, error: patientError } = await admin.from("patients").insert({ organization_id: org.id, auth_user_id: userData.user.id, full_name: `Patient ${label}` }).select("id").single(); if (patientError) throw patientError;
    const { data: episode, error: episodeError } = await admin.from("care_episodes").insert({ organization_id: org.id, patient_id: patient.id, doctor_id: doctor.id, procedure_name: `Procedure ${label}` }).select("id").single(); if (episodeError) throw episodeError;
    const { data: conversation, error: conversationError } = await admin.from("conversations").insert({ organization_id: org.id, patient_id: patient.id, care_episode_id: episode.id }).select("id").single(); if (conversationError) throw conversationError;
    const { data: message, error: messageError } = await admin.from("messages").insert({ organization_id: org.id, conversation_id: conversation.id, sender_type: "ai", content: `Message ${label}` }).select("id").single(); if (messageError) throw messageError;
    fixtures.push({ user: userData.user, org, patient, episode, conversation, message });
  }
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } }); const { error: loginError } = await client.auth.signInWithPassword({ email: fixtures[0].user.email, password }); if (loginError) throw loginError;
  const checks = {};
  for (const [table, ownId, foreignId] of [["patients", fixtures[0].patient.id, fixtures[1].patient.id], ["care_episodes", fixtures[0].episode.id, fixtures[1].episode.id], ["conversations", fixtures[0].conversation.id, fixtures[1].conversation.id], ["messages", fixtures[0].message.id, fixtures[1].message.id]]) {
    const { data: own } = await client.from(table).select("id").eq("id", ownId); const { data: foreign } = await client.from(table).select("id").eq("id", foreignId); checks[table] = { own: own?.length === 1 ? "allowed" : "failed", foreign: foreign?.length === 0 ? "denied" : "failed" };
  }
  const { error: spoofError } = await client.from("messages").insert({ organization_id: fixtures[0].org.id, conversation_id: fixtures[0].conversation.id, sender_type: "doctor", sender_user_id: fixtures[0].user.id, content: "spoof" }); checks.senderSpoof = spoofError ? "denied" : "failed";
  const { error: crossError } = await client.from("messages").insert({ organization_id: fixtures[1].org.id, conversation_id: fixtures[1].conversation.id, sender_type: "patient", sender_user_id: fixtures[0].user.id, content: "cross" }); checks.crossPatientInsert = crossError ? "denied" : "failed";
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some((value) => typeof value === "string" ? value === "failed" : value.own === "failed" || value.foreign === "failed")) throw new Error("Isolation assertion failed");
} finally {
  for (const id of createdOrgs) await admin.from("organizations").delete().eq("id", id);
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  console.log(JSON.stringify({ cleanup: "complete" }));
}
