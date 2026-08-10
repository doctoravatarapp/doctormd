import Link from "next/link";
import { getPatientContext } from "@/lib/auth/patient-context";
import { createClient } from "@/lib/supabase/server";
import { PatientShell } from "@/components/patient/patient-shell";

export default async function PatientHome() {
  const { patient } = await getPatientContext(); const db = await createClient();
  const { data: episodes } = await db.from("care_episodes").select("id,procedure_name,procedure_date,status").eq("patient_id", patient.id).in("status", ["planned", "preoperative", "postoperative"]).order("created_at", { ascending: false });
  const episodeIds = episodes?.map((episode) => episode.id) ?? [];
  const { data: conversations } = episodeIds.length ? await db.from("conversations").select("id,care_episode_id").in("care_episode_id", episodeIds).eq("status", "open") : { data: [] };
  const items = episodes?.flatMap((episode) => { const conversation = conversations?.find((row) => row.care_episode_id === episode.id); return conversation ? [{ href: `/patient/chat/${conversation.id}`, title: episode.procedure_name, subtitle: episode.status }] : []; }) ?? [];
  const name = patient.preferred_name || patient.full_name;
  return <PatientShell patientName={name} currentTitle="Acompanhamentos" conversations={items}><main className="patient-home-content"><p className="patient-eyebrow">OLÁ, {name}</p><h1>Seus acompanhamentos</h1><p>Escolha uma conversa para continuar.</p>{items.length ? <div className="episode-list">{items.map((item) => <Link href={item.href} key={item.href}><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><span>›</span></Link>)}</div> : <div className="patient-empty"><strong>Nenhum acompanhamento ativo</strong><p>Quando sua equipe iniciar um acompanhamento, ele aparecerá aqui.</p></div>}</main></PatientShell>;
}
