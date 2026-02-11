import { useTranslation } from '../i18n';

const DEFAULT_PAGE_SIZE = 25;

type Props = {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
};

export function paginate<T>(list: T[], page: number, pageSize: number): T[] {
  return list.slice((page - 1) * pageSize, page * pageSize);
}

export function usePagination(totalItems: number, pageSize = DEFAULT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return { totalPages, pageSize };
}

export default function Pagination({ page, totalItems, pageSize = DEFAULT_PAGE_SIZE, onPageChange }: Props) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        className="rd-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('pagination.prev')}
      </button>
      <span className="rd-muted" style={{ fontSize: '0.9rem' }}>
        {t('pagination.page', { current: page, total: totalPages })}
      </span>
      <button
        type="button"
        className="rd-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('pagination.next')}
      </button>
    </div>
  );
}

export { DEFAULT_PAGE_SIZE };
