import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PATIENT_EMAIL", "PATIENT_PASSWORD"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = process.env.PATIENT_EMAIL.toLowerCase();
const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (listError) throw listError;
let authUser = listed.users.find((user) => user.email?.toLowerCase() === email);
if (authUser) { const { data, error } = await admin.auth.admin.updateUserById(authUser.id, { password: process.env.PATIENT_PASSWORD, email_confirm: true }); if (error) throw error; authUser = data.user; }
else { const { data, error } = await admin.auth.admin.createUser({ email, password: process.env.PATIENT_PASSWORD, email_confirm: true }); if (error) throw error; authUser = data.user; }
const { data: organization, error: orgError } = await admin.from("organizations").select("id, name").eq("slug", "apollomd-demo").single(); if (orgError) throw orgError;
let { data: patient } = await admin.from("patients").select("id").eq("organization_id", organization.id).eq("auth_user_id", authUser.id).maybeSingle();
if (!patient) { const { data, error } = await admin.from("patients").insert({ organization_id: organization.id, auth_user_id: authUser.id, full_name: "Paciente Teste APolloMD", preferred_name: "Paciente Teste", email }).select("id").single(); if (error) throw error; patient = data; }
let { data: doctor } = await admin.from("doctors").select("id").eq("organization_id", organization.id).eq("display_name", "Dr. Teste APolloMD").maybeSingle();
if (!doctor) { const { data, error } = await admin.from("doctors").insert({ organization_id: organization.id, display_name: "Dr. Teste APolloMD", specialty: "Ambiente de validação", professional_registration: "TESTE" }).select("id").single(); if (error) throw error; doctor = data; }
let { data: episode } = await admin.from("care_episodes").select("id").eq("organization_id", organization.id).eq("patient_id", patient.id).eq("procedure_name", "Procedimento de teste APolloMD").maybeSingle();
if (!episode) { const { data, error } = await admin.from("care_episodes").insert({ organization_id: organization.id, patient_id: patient.id, doctor_id: doctor.id, procedure_name: "Procedimento de teste APolloMD", status: "postoperative" }).select("id").single(); if (error) throw error; episode = data; }
let { data: conversation } = await admin.from("conversations").select("id").eq("care_episode_id", episode.id).eq("status", "open").maybeSingle();
if (!conversation) { const { data, error } = await admin.from("conversations").insert({ organization_id: organization.id, patient_id: patient.id, care_episode_id: episode.id, status: "open", mode: "ai" }).select("id").single(); if (error) throw error; conversation = data; }
console.log(JSON.stringify({ patient: "Paciente Teste APolloMD", email, organization: organization.name, episode: "ready", conversation: "ready", auth: "confirmed" }));
