import Link from "next/link";
import { redirect } from "next/navigation";
import { getPatientContext } from "@/lib/auth/patient-context";
import { createClient } from "@/lib/supabase/server";
import { patientLogout } from "./login/actions";

export default async function PatientHome() {
  const { patient } = await getPatientContext(); const supabase = await createClient();
  const { data: episodes } = await supabase.from("care_episodes").select("id, procedure_name, procedure_date, status").eq("patient_id", patient.id).in("status", ["planned", "preoperative", "postoperative"]).order("created_at", { ascending: false });
  if (episodes?.length === 1) {
    const { data: conversation } = await supabase.from("conversations").select("id").eq("care_episode_id", episodes[0].id).eq("status", "open").order("created_at").limit(1).maybeSingle();
    if (conversation) redirect(`/patient/chat/${conversation.id}`);
  }
  return <main className="patient-home"><header><span className="patient-logo"><b>A</b> APolloMD</span><form action={patientLogout}><button>Sair</button></form></header><section><p className="patient-eyebrow">OLÁ, {patient.preferred_name || patient.full_name}</p><h1>Escolha seu acompanhamento</h1>{episodes?.length ? <div className="episode-list">{episodes.map((episode) => <EpisodeLink key={episode.id} episode={episode} />)}</div> : <div className="patient-empty"><strong>Nenhum acompanhamento ativo</strong><p>Quando sua equipe iniciar um acompanhamento, ele aparecerá aqui.</p></div>}</section></main>;
}

async function EpisodeLink({ episode }: { episode: { id: string; procedure_name: string; procedure_date: string | null; status: string } }) {
  const supabase = await createClient(); const { data } = await supabase.from("conversations").select("id").eq("care_episode_id", episode.id).eq("status", "open").order("created_at").limit(1).maybeSingle();
  return data ? <Link href={`/patient/chat/${data.id}`}><strong>{episode.procedure_name}</strong><span>{episode.status} →</span></Link> : null;
}
