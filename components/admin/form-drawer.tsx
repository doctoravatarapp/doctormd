"use client";
import { useState } from "react";

export function FormDrawer({ label, title, description, children }: { label: string; title: string; description?: string; children: React.ReactNode }) {
  const [open,setOpen]=useState(false);
  return <div className={`form-drawer ${open?"open":""}`}><button className="primary-fab" onClick={()=>setOpen(true)}><span>+</span>{label}</button>{open?<><button className="drawer-scrim" aria-label="Fechar formulário" onClick={()=>setOpen(false)}/><section className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}><div className="drawer-heading"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><button onClick={()=>setOpen(false)} aria-label="Fechar formulário">×</button></div>{children}</section></>:null}</div>;
}
