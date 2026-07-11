import { useStore } from '../store/useStore'

export function EmptyFilter() {
  const clearFilters = useStore((s) => s.clearFilters)
  return (
    <div className="empty-filter">
      <div className="empty-filter-title">Nothing here.</div>
      <p>No tasks match the current filters.</p>
      <button className="empty-filter-clear" onClick={clearFilters}>
        clear filters
      </button>
    </div>
  )
}
