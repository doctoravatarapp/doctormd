export function EmptyState({ icon = "◇", title, description }: { icon?: string; title: string; description: string }) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
