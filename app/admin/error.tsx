"use client";
export default function AdminError({ reset }: { reset: () => void }) { return <main className="admin-content"><section className="panel error-state" role="alert"><h1>Não foi possível carregar esta tela</h1><p>Confira sua conexão e tente novamente. Nenhuma alteração foi perdida.</p><button onClick={reset}>Tentar novamente</button></section></main>; }
