import { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, createElement, useState } from 'react';
import { fill } from '../../app/core/i18n';
import { useText } from '../state/use-text';
import { Icon } from './primitives';
import { tablePage, sameRow } from './table-values';

export interface TableProps<T> {
  value: readonly T[];
  header: ReactNode;
  renderRow: (row: T, index: number, selectionProps: HTMLAttributes<HTMLTableRowElement>) => ReactNode;
  emptyMessage?: ReactNode;
  loading?: boolean;
  className?: string;
  tableStyle?: CSSProperties;
  paginator?: boolean;
  rows?: number;
  first?: number;
  totalRecords?: number;
  pageLinks?: number;
  showCurrentPageReport?: boolean;
  currentPageReportTemplate?: string;
  selection?: T | null;
  dataKey?: keyof T;
  onFirstChange?: (first: number) => void;
  onSelectionChange?: (selection: T | null) => void;
  onRowSelected?: (event: { data: T }) => void;
  onRowUnselected?: (event: { data: T }) => void;
}
export function Table<T>({ value, header, renderRow, emptyMessage, loading = false, className = '', tableStyle,
  paginator = false, rows = 10, first, totalRecords, pageLinks = 5, showCurrentPageReport = false,
  currentPageReportTemplate, selection, dataKey, onFirstChange,
  onSelectionChange, onRowSelected, onRowUnselected }: TableProps<T>) {
  const t = useText();
  const [localFirst, setLocalFirst] = useState(0);
  const [localSelection, setLocalSelection] = useState<T | null>(null);
  const chosen = selection === undefined ? localSelection : selection;
  const total = totalRecords ?? value.length;
  const { size, pageCount, page, start, displayed, pages } = tablePage(value, rows, first ?? localFirst, paginator, total, pageLinks);
  const fields: Record<string, number> = { totalRecords: total, currentPage: page + 1, totalPages: pageCount,
    first: total ? start + 1 : 0, last: Math.min(total, start + size), rows: size };
  const report = () => currentPageReportTemplate ? fill(currentPageReportTemplate, fields) : t('ui.table.currentPageReport', fields);
  const go = (next: number) => {
    const offset = Math.max(0, Math.min(pageCount - 1, next)) * size;
    setLocalFirst(offset); onFirstChange?.(offset);
  };
  const rowProps = (row: T): HTMLAttributes<HTMLTableRowElement> => {
    const selected = sameRow(chosen, row, dataKey);
    const choose = () => {
      const next = selected ? null : row;
      setLocalSelection(next); onSelectionChange?.(next);
      (selected ? onRowUnselected : onRowSelected)?.({ data: row });
    };
    const key = (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        (event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling as HTMLElement : event.currentTarget.previousElementSibling as HTMLElement)?.focus();
      }
    };
    return { className: `ui-selectable-row ${selected ? 'ui-highlight' : ''}`, tabIndex: 0, 'aria-selected': selected, onClick: choose, onKeyDown: key };
  };
  return createElement('app-ui-table', null, <div className={`ui-datatable ui-component ${className}`} aria-busy={loading}>
    <div className="ui-datatable-wrapper"><table className="ui-datatable-table" style={tableStyle}>
      <thead className="ui-datatable-thead">{header}</thead>
      <tbody className="ui-datatable-tbody">{displayed.map((row, index) => renderRow(row, start + index, rowProps(row)))}{!displayed.length && emptyMessage}</tbody>
    </table></div>
    {loading && <div className="ui-datatable-loading-overlay"><Icon name="spinner" label={t('ui.loading')} /></div>}
    {paginator && <nav className="ui-paginator ui-component" aria-label={t('ui.table.pagination')}>
      {showCurrentPageReport && <span className="ui-paginator-current">{report()}</span>}
      <button type="button" className="ui-paginator-first ui-paginator-element ui-link" disabled={page === 0} aria-label={t('ui.table.firstPage')} onClick={() => go(0)}><Icon name="angle-double-left" /></button>
      <button type="button" className="ui-paginator-prev ui-paginator-element ui-link" disabled={page === 0} aria-label={t('ui.table.previousPage')} onClick={() => go(page - 1)}><Icon name="chevron-left" /></button>
      <span className="ui-paginator-pages">{pages.map(number => <button key={number} type="button" className={`ui-paginator-page ui-paginator-element ui-link ${page === number ? 'ui-highlight' : ''}`}
        aria-current={page === number ? 'page' : undefined} aria-label={t('ui.table.page', { number: number + 1 })} onClick={() => go(number)}>{number + 1}</button>)}</span>
      <button type="button" className="ui-paginator-next ui-paginator-element ui-link" disabled={page >= pageCount - 1} aria-label={t('ui.table.nextPage')} onClick={() => go(page + 1)}><Icon name="chevron-right" /></button>
      <button type="button" className="ui-paginator-last ui-paginator-element ui-link" disabled={page >= pageCount - 1} aria-label={t('ui.table.lastPage')} onClick={() => go(pageCount - 1)}><Icon name="angle-double-right" /></button>
    </nav>}
  </div>);
}
