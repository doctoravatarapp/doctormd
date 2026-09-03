import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "PATIENT_EMAIL", "PATIENT_PASSWORD"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: process.env.PATIENT_EMAIL.trim().toLowerCase(),
  password: process.env.PATIENT_PASSWORD,
});
if (error || !data.user) throw error ?? new Error("Patient login failed");

const { data: patient, error: patientError } = await client
  .from("patients")
  .select("full_name,status")
  .eq("auth_user_id", data.user.id)
  .eq("status", "active")
  .single();
if (patientError) throw patientError;

await client.auth.signOut();
console.log(JSON.stringify({ email: process.env.PATIENT_EMAIL, patient: patient.full_name, login: "valid" }));
