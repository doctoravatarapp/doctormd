import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PATIENT_EMAIL", "PATIENT_PASSWORD", "PATIENT_FULL_NAME"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const email = process.env.PATIENT_EMAIL.trim().toLowerCase();

const { data: organization, error: organizationError } = await admin
  .from("organizations")
  .select("id")
  .eq("slug", "apollomd-demo")
  .single();
if (organizationError) throw organizationError;

const { data: patient, error: patientError } = await admin
  .from("patients")
  .select("id,auth_user_id")
  .eq("organization_id", organization.id)
  .eq("full_name", process.env.PATIENT_FULL_NAME)
  .single();
if (patientError) throw patientError;

const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
let authUser = listed.users.find((user) => user.email?.toLowerCase() === email);

if (authUser) {
  const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
    password: process.env.PATIENT_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: process.env.PATIENT_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  authUser = data.user;
}

if (patient.auth_user_id && patient.auth_user_id !== authUser.id) {
  throw new Error("Patient is already linked to another authentication account");
}
const { error: linkError } = await admin
  .from("patients")
  .update({ auth_user_id: authUser.id, email })
  .eq("id", patient.id)
  .eq("organization_id", organization.id);
if (linkError) throw linkError;

console.log(JSON.stringify({ patient: process.env.PATIENT_FULL_NAME, email, auth: "confirmed", linked: true }));
