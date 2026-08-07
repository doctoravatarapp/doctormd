import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceRoleKey || !publishableKey) throw new Error("Supabase test environment is required.");

const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomBytes(6).toString("hex");
const password = `Rls-${randomBytes(18).toString("base64url")}!`;
const emailA = `rls-a-${suffix}@example.invalid`;
const emailB = `rls-b-${suffix}@example.invalid`;
const cleanup = { users: [], organizations: [] };

try {
  const [createdA, createdB] = await Promise.all([
    service.auth.admin.createUser({ email: emailA, password, email_confirm: true }),
    service.auth.admin.createUser({ email: emailB, password, email_confirm: true }),
  ]);
  if (createdA.error) throw createdA.error;
  if (createdB.error) throw createdB.error;
  cleanup.users.push(createdA.data.user.id, createdB.data.user.id);

  const { data: organizations, error: organizationError } = await service
    .from("organizations")
    .insert([
      { name: `RLS A ${suffix}`, slug: `rls-a-${suffix}` },
      { name: `RLS B ${suffix}`, slug: `rls-b-${suffix}` },
    ])
    .select("id, slug");
  if (organizationError) throw organizationError;
  const orgA = organizations.find((item) => item.slug.startsWith("rls-a-"));
  const orgB = organizations.find((item) => item.slug.startsWith("rls-b-"));
  cleanup.organizations.push(orgA.id, orgB.id);

  const { error: membershipsError } = await service.from("organization_memberships").insert([
    { organization_id: orgA.id, user_id: createdA.data.user.id, role: "organization_admin" },
    { organization_id: orgB.id, user_id: createdB.data.user.id, role: "organization_admin" },
  ]);
  if (membershipsError) throw membershipsError;

  const { data: doctors, error: doctorsError } = await service.from("doctors").insert([
    { organization_id: orgA.id, display_name: "RLS Doctor A" },
    { organization_id: orgB.id, display_name: "RLS Doctor B" },
  ]).select("id, organization_id");
  if (doctorsError) throw doctorsError;
  const doctorA = doctors.find((item) => item.organization_id === orgA.id);
  const doctorB = doctors.find((item) => item.organization_id === orgB.id);

  const { data: patients, error: patientsError } = await service.from("patients").insert([
    { organization_id: orgA.id, full_name: "RLS Patient A" },
    { organization_id: orgB.id, full_name: "RLS Patient B" },
  ]).select("id, organization_id");
  if (patientsError) throw patientsError;
  const patientA = patients.find((item) => item.organization_id === orgA.id);
  const patientB = patients.find((item) => item.organization_id === orgB.id);

  const { data: episodes, error: episodesError } = await service.from("care_episodes").insert([
    { organization_id: orgA.id, patient_id: patientA.id, doctor_id: doctorA.id, procedure_name: "RLS Procedure A" },
    { organization_id: orgB.id, patient_id: patientB.id, doctor_id: doctorB.id, procedure_name: "RLS Procedure B" },
  ]).select("id, organization_id");
  if (episodesError) throw episodesError;
  const episodeA = episodes.find((item) => item.organization_id === orgA.id);

  const { error: conversationsError } = await service.from("conversations").insert([
    { organization_id: orgA.id, patient_id: patientA.id, care_episode_id: episodeA.id },
    { organization_id: orgB.id, patient_id: patientB.id, care_episode_id: episodes.find((item) => item.organization_id === orgB.id).id },
  ]);
  if (conversationsError) throw conversationsError;

  const userA = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: loginError } = await userA.auth.signInWithPassword({ email: emailA, password });
  if (loginError) throw loginError;

  const [ownPatients, foreignPatients, ownEpisodes, foreignEpisodes, ownConversations, foreignConversations] = await Promise.all([
    userA.from("patients").select("id").eq("organization_id", orgA.id),
    userA.from("patients").select("id").eq("organization_id", orgB.id),
    userA.from("care_episodes").select("id").eq("organization_id", orgA.id),
    userA.from("care_episodes").select("id").eq("organization_id", orgB.id),
    userA.from("conversations").select("id").eq("organization_id", orgA.id),
    userA.from("conversations").select("id").eq("organization_id", orgB.id),
  ]);
  if (ownPatients.data?.length !== 1 || ownEpisodes.data?.length !== 1 || ownConversations.data?.length !== 1) throw new Error("Tenant A could not read its own fixtures.");
  if (foreignPatients.data?.length || foreignEpisodes.data?.length || foreignConversations.data?.length) throw new Error("Tenant A read Tenant B fixtures.");

  const crossPatient = await userA.from("patients").insert({ organization_id: orgB.id, full_name: "Cross tenant" });
  const crossEpisode = await userA.from("care_episodes").insert({ organization_id: orgB.id, patient_id: patientB.id, doctor_id: doctorB.id, procedure_name: "Cross tenant" });
  if (!crossPatient.error || !crossEpisode.error) throw new Error("Cross-tenant insert was not denied by RLS.");

  console.log(JSON.stringify({
    tenantAOwnPatients: "allowed",
    tenantAToBPatients: "denied",
    tenantAToBEpisodes: "denied",
    tenantAToBConversations: "denied",
    crossTenantPatientInsert: "denied_by_database",
    crossTenantEpisodeInsert: "denied_by_database",
    cleanup: "pending",
  }));
} finally {
  for (const organizationId of cleanup.organizations) await service.from("organizations").delete().eq("id", organizationId);
  for (const userId of cleanup.users) await service.auth.admin.deleteUser(userId);
  console.log(JSON.stringify({ cleanup: "complete" }));
}
