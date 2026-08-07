import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { assignAutomation, controlAutomation } from "./actions";

export default async function EpisodePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ assigned?: string; error?: string }> }) {
  const { id } = await params; const q = await searchParams; const context = await getAdminContext(); if (!context.organization) notFound();
  const supabase = await createClient();
  const { data: episode } = await supabase.from("care_episodes").select("id,patient_id,doctor_id,procedure_name,procedure_date,status").eq("organization_id", context.organization.id).eq("id", id).maybeSingle(); if (!episode) notFound();
  const [{ data: patient }, { data: doctor }, { data: conversations }, { data: flows }, { data: assignments }] = await Promise.all([
    supabase.from("patients").select("id,full_name,preferred_name").eq("id", episode.patient_id).single(),
    supabase.from("doctors").select("display_name,specialty").eq("id", episode.doctor_id).single(),
    supabase.from("conversations").select("id,status,mode").eq("care_episode_id", id),
    supabase.from("automation_flows").select("id,name,version").eq("organization_id", context.organization.id).eq("status", "active").order("name"),
    supabase.from("episode_automations").select("id,flow_id,flow_version,status").eq("care_episode_id", id).order("created_at", { ascending: false }),
  ]);
  const assignmentIds = assignments?.map((item) => item.id) ?? []; const flowIds = assignments?.map((item) => item.flow_id) ?? [];
  const [{ data: actions }, { data: usedFlows }] = assignmentIds.length ? await Promise.all([
    supabase.from("scheduled_actions").select("id,episode_automation_id,step_position,step_name,scheduled_for,status").in("episode_automation_id", assignmentIds).order("step_position"),
    supabase.from("automation_flows").select("id,name").in("id", flowIds),
  ]) : [{ data: [] }, { data: [] }];
  const flowNames = new Map(usedFlows?.map((flow) => [flow.id, flow.name]));
  const format = (date: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(date));

  return <main className="admin-content"><PageHeader eyebrow="ACOMPANHAMENTO" title={episode.procedure_name} description={`${patient?.preferred_name || patient?.full_name || "Paciente"} · ${episode.status}`} />
    {q.assigned ? <p className="success-message">Automação associada e agendada.</p> : null}{q.error ? <p className="form-error">Não foi possível alterar a automação. Confira âncora e permissões.</p> : null}
    <section className="detail-grid"><article className="panel info-card"><h2>Dados do episódio</h2><dl><div><dt>Paciente</dt><dd><Link href={`/admin/patients/${episode.patient_id}`}>{patient?.full_name}</Link></dd></div><div><dt>Médico</dt><dd>{doctor?.display_name || "Não encontrado"}</dd></div><div><dt>Especialidade</dt><dd>{doctor?.specialty || "Não informada"}</dd></div><div><dt>Procedimento</dt><dd>{episode.procedure_name}</dd></div><div><dt>Data</dt><dd>{episode.procedure_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${episode.procedure_date}T12:00:00`)) : "Não informada"}</dd></div></dl></article>
      <article className="panel"><h2>Conversa principal</h2>{conversations?.map((conversation) => <div className="compact-row" key={conversation.id}><strong>{conversation.mode}</strong><span>{conversation.status}</span></div>)}</article>
      <article className="panel automation-episode"><h2>Automação</h2>{assignments?.map((assignment) => { const own = actions?.filter((action) => action.episode_automation_id === assignment.id) ?? []; const done = own.filter((action) => action.status === "completed").length; const next = own.find((action) => action.status === "pending" || action.status === "failed"); return <section key={assignment.id}><strong>{flowNames.get(assignment.flow_id) || "Fluxo"} · v{assignment.flow_version}</strong><p>{assignment.status} · {done} de {own.length} etapas</p>{next ? <small>Próxima: {format(next.scheduled_for)}</small> : null}<div className="automation-controls">{assignment.status === "active" ? <Control assignment={assignment.id} episode={id} status="paused" label="Pausar" /> : assignment.status === "paused" ? <Control assignment={assignment.id} episode={id} status="active" label="Retomar" /> : null}{assignment.status !== "completed" && assignment.status !== "cancelled" ? <Control assignment={assignment.id} episode={id} status="cancelled" label="Cancelar" /> : null}</div>{own.map((action) => <div className="compact-row" key={action.id}><strong>{action.step_position}. {action.step_name}</strong><span>{action.status} · {format(action.scheduled_for)}</span></div>)}</section>; })}
        {!assignments?.some((assignment) => assignment.status === "active" || assignment.status === "paused") && flows?.length ? <form action={assignAutomation} className="stack-form"><input type="hidden" name="episode_id" value={id} /><select name="flow_id" required defaultValue=""><option value="" disabled>Selecionar fluxo ativo</option>{flows.map((flow) => <option value={flow.id} key={flow.id}>{flow.name} · v{flow.version}</option>)}</select><button>Adicionar automação</button></form> : null}</article>
    </section></main>;
}

function Control({ assignment, episode, status, label }: { assignment: string; episode: string; status: "active" | "paused" | "cancelled"; label: string }) {
  return <form action={controlAutomation}><input type="hidden" name="assignment_id" value={assignment} /><input type="hidden" name="episode_id" value={episode} /><input type="hidden" name="status" value={status} /><button className="text-button">{label}</button></form>;
}
