export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="admin-page-header">
      <div>{eyebrow ? <span>{eyebrow}</span> : null}<h1>{title}</h1><p>{description}</p></div>
      {action}
    </header>
  );
}
