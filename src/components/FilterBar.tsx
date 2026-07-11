import type { RefObject } from 'react'
import { useStore } from '../store/useStore'
import type { StatusFilter } from '../types'
import { deriveCategories } from '../lib/sort'

const STATUS_CHIPS: Array<[StatusFilter, string]> = [
  ['today', 'Today'],
  ['all', 'All'],
  ['todo', 'To do'],
  ['doing', 'Doing'],
  ['backlog', 'Backlog'],
  ['done', 'Done']
]

export function FilterBar({ searchRef }: { searchRef: RefObject<HTMLInputElement> }) {
  const tasks = useStore((s) => s.tasks)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterCat = useStore((s) => s.filterCat)
  const search = useStore((s) => s.search)
  const setFilterStatus = useStore((s) => s.setFilterStatus)
  const toggleFilterCat = useStore((s) => s.toggleFilterCat)
  const setSearch = useStore((s) => s.setSearch)

  const cats = deriveCategories(tasks)

  return (
    <div className="filter-bar">
      {STATUS_CHIPS.map(([id, label]) => (
        <button
          key={id}
          className={'chip' + (filterStatus === id ? ' active' : '')}
          aria-pressed={filterStatus === id}
          onClick={() => setFilterStatus(id)}
        >
          {label}
        </button>
      ))}
      {cats.length > 0 && <span className="chip-sep">·</span>}
      {cats.map((c) => (
        <button
          key={c}
          className={'chip' + (filterCat === c ? ' active' : '')}
          aria-pressed={filterCat === c}
          onClick={() => toggleFilterCat(c)}
        >
          #{c}
        </button>
      ))}
      <span className="filter-spacer" />
      <input
        ref={searchRef}
        className="search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="search  /"
        aria-label="Search tasks"
      />
    </div>
  )
}
