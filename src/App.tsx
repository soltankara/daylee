import { useEffect, useMemo, useRef } from 'react'
import { useStore } from './store/useStore'
import { DexieStorage } from './storage/dexie'
import type { TaskStorage } from './storage/storage'
import { todayISO } from './lib/dates'
import { initBackup } from './lib/backup'
import { groupTasks, orderForBoard } from './lib/sort'
import { groupWeekTasks, weekStartISO } from './lib/week'
import { useKeyboard } from './hooks/useKeyboard'
import { Header } from './components/Header'
import { QuickAdd } from './components/QuickAdd'
import { FilterBar } from './components/FilterBar'
import { FirstRun } from './components/FirstRun'
import { EmptyFilter } from './components/EmptyFilter'
import { TaskGroup } from './components/TaskGroup'
import { Footer } from './components/Footer'
import { Toast } from './components/Toast'
import { DoneLog } from './components/DoneLog'
import { Settings } from './components/Settings'
import { SidePeek } from './components/SidePeek'
import { CommandPalette } from './components/CommandPalette'
import { Board } from './components/Board'
import { WeekView } from './components/WeekView'

const DONE_COLLAPSE_AT = 5

export default function App({ storage }: { storage?: TaskStorage } = {}) {
  const tasks = useStore((s) => s.tasks)
  const loaded = useStore((s) => s.loaded)
  const view = useStore((s) => s.view)
  const expandedId = useStore((s) => s.expandedId)
  const paletteOpen = useStore((s) => s.paletteOpen)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterCat = useStore((s) => s.filterCat)
  const search = useStore((s) => s.search)
  const showAllDone = useStore((s) => s.showAllDone)
  const init = useStore((s) => s.init)
  const setShowAllDone = useStore((s) => s.setShowAllDone)

  const addRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void init(storage ?? new DexieStorage())
    void initBackup()
    // storage is fixed for the app's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init])

  const today = todayISO()
  const groups = useMemo(
    () => groupTasks(tasks, { status: filterStatus, category: filterCat, search }, today),
    [tasks, filterStatus, filterCat, search, today]
  )

  const doneCollapsed = !showAllDone && groups.done.length > DONE_COLLAPSE_AT
  const doneShown = doneCollapsed ? groups.done.slice(0, DONE_COLLAPSE_AT) : groups.done

  const flatIds = useMemo(() => {
    if (view === 'week') {
      const wg = groupWeekTasks(tasks, weekStartISO(), today)
      return [...wg.doing, ...wg.todo, ...wg.backlog, ...wg.done].map((t) => t.id)
    }
    if (view === 'board') {
      // column-major, matching the board's visual order
      return [
        ...orderForBoard(groups.backlog, today),
        ...orderForBoard(groups.todo, today),
        ...orderForBoard(groups.doing, today),
        ...orderForBoard(groups.done, today)
      ].map((t) => t.id)
    }
    return [...groups.doing, ...groups.todo, ...groups.backlog, ...doneShown].map((t) => t.id)
  }, [view, tasks, groups, doneShown, today])

  useKeyboard(flatIds, addRef, searchRef)

  const peekTask =
    view === 'log' || view === 'settings'
      ? undefined
      : tasks.find((t) => t.id === expandedId)

  const showFirstRun = loaded && tasks.filter((t) => !t.archived).length === 0
  const showEmptyFilter =
    loaded &&
    !showFirstRun &&
    groups.doing.length + groups.todo.length + groups.backlog.length + groups.done.length === 0

  return (
    <div className="app">
      <div className="container">
        {view === 'list' && (
          <>
            <Header />
            <QuickAdd inputRef={addRef} />
            <FilterBar searchRef={searchRef} />
            {!loaded && <div className="loading">loading…</div>}
            {showFirstRun && <FirstRun />}
            <TaskGroup label="Doing" kind="doing" tasks={groups.doing} today={today} />
            <TaskGroup label="To do" kind="todo" tasks={groups.todo} today={today} />
            <TaskGroup label="Backlog" kind="backlog" tasks={groups.backlog} today={today} />
            <TaskGroup
              label="Done"
              kind="done"
              tasks={doneShown}
              today={today}
              totalCount={groups.done.length}
              moreLabel={doneCollapsed ? `show all ${groups.done.length}` : undefined}
              onShowAll={() => setShowAllDone(true)}
            />
            {showEmptyFilter && <EmptyFilter />}
            <Footer />
          </>
        )}
        {view === 'board' && (
          <>
            <Header />
            <QuickAdd inputRef={addRef} />
            <FilterBar searchRef={searchRef} />
            {!loaded && <div className="loading">loading…</div>}
            {showFirstRun && <FirstRun />}
            {!showFirstRun && <Board groups={groups} today={today} />}
            <Footer />
          </>
        )}
        {view === 'week' && <WeekView />}
        {view === 'log' && <DoneLog />}
        {view === 'settings' && <Settings />}
      </div>
      {peekTask && <SidePeek task={peekTask} />}
      {paletteOpen && <CommandPalette addRef={addRef} />}
      <Toast />
    </div>
  )
}
