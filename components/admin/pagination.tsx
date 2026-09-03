import Link from "next/link";

export const ADMIN_PAGE_SIZE = 20;

export function pageNumber(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type PaginationProps = {
  page: number;
  total: number;
  pathname: string;
  params?: Record<string, string | undefined>;
  pageSize?: number;
};

export function Pagination({ page, total, pathname, params = {}, pageSize = ADMIN_PAGE_SIZE }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (target > 1) query.set("page", String(target));
    return `${pathname}${query.size ? `?${query}` : ""}`;
  };
  return <nav className="pagination" aria-label="Paginação">
    <Link aria-disabled={current === 1} href={href(Math.max(1, current - 1))}>Anterior</Link>
    <span>Página {current} de {pages} · {total} itens</span>
    <Link aria-disabled={current === pages} href={href(Math.min(pages, current + 1))}>Próxima</Link>
  </nav>;
}
