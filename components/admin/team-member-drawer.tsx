"use client";

import { useState } from "react";
import { removeTeamMember, sendTeamAccessLink, updateTeamMember } from "@/app/admin/team/actions";

type Member = {
  id: string;
  email: string | null;
  name: string;
  role: "organization_admin" | "doctor" | "staff";
  status: "active" | "invited" | "inactive";
  isCurrentUser: boolean;
};

export function TeamMemberDrawer({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="row-action" onClick={() => setOpen(true)} aria-label={`Gerenciar ${member.name}`}>⋮</button>
    {open ? <>
      <button className="drawer-scrim" aria-label="Fechar edição" onClick={() => setOpen(false)} />
      <section className="drawer-panel" role="dialog" aria-modal="true" aria-label={`Editar acesso de ${member.name}`}>
        <div className="drawer-heading"><div><h2>Editar acesso</h2><p>Atualize o perfil e as permissões deste usuário.</p></div><button onClick={() => setOpen(false)} aria-label="Fechar edição">×</button></div>
        <form action={updateTeamMember} className="drawer-form">
          <input type="hidden" name="membership_id" value={member.id} />
          <label>Nome<input name="full_name" defaultValue={member.name} required /></label>
          <label>Papel<select name="role" defaultValue={member.role} disabled={member.isCurrentUser}><option value="organization_admin">Administrador</option><option value="doctor">Médico</option><option value="staff">Equipe</option></select>{member.isCurrentUser ? <input type="hidden" name="role" value={member.role} /> : null}</label>
          <label>Status<select name="status" defaultValue={member.status === "invited" ? "inactive" : member.status} disabled={member.isCurrentUser}><option value="active">Ativo</option><option value="inactive">Inativo</option></select>{member.isCurrentUser ? <input type="hidden" name="status" value={member.status} /> : null}</label>
          <button>Salvar alterações</button>
        </form>
        {member.email ? <div className="drawer-secondary-zone"><strong>Link de acesso</strong><p>Envie um novo link seguro para este usuário definir ou recuperar a senha.</p><form action={sendTeamAccessLink}><input type="hidden" name="membership_id" value={member.id} /><button>Enviar novo link de acesso</button></form></div> : null}
        {!member.isCurrentUser ? <div className="drawer-danger-zone"><strong>Remover da organização</strong><p>O usuário perde o acesso a este ambiente, mas sua conta global não é apagada.</p><form action={removeTeamMember}><input type="hidden" name="membership_id" value={member.id} /><button className="danger-action">Remover acesso</button></form></div> : null}
      </section>
    </> : null}
  </>;
}
