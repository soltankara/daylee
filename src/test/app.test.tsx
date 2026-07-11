import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { useStore } from '../store/useStore'
import { MemoryStorage } from '../storage/memory'

function resetStore() {
  useStore.setState({
    tasks: [],
    loaded: false,
    view: 'list',
    filterStatus: 'all',
    filterCat: null,
    search: '',
    selId: null,
    editingId: null,
    expandedId: null,
    showAllDone: false,
    toast: null,
    popId: null,
    paletteOpen: false
  })
}

async function setup() {
  const storage = new MemoryStorage()
  render(<App storage={storage} />)
  await waitFor(() => expect(useStore.getState().loaded).toBe(true))
  return { storage, user: userEvent.setup() }
}

beforeEach(resetStore)

describe('create', () => {
  it('shows the first-run empty state when there are no tasks', async () => {
    await setup()
    expect(screen.getByText('A quiet page for your tasks.')).toBeInTheDocument()
  })

  it('creates a task on Enter, clears the input, keeps focus', async () => {
    const { storage, user } = await setup()
    const input = screen.getByLabelText('Add a task')
    await user.click(input)
    await user.keyboard('Buy milk{Enter}')
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    await waitFor(async () => {
      const stored = await storage.listTasks()
      expect(stored.map((t) => t.title)).toEqual(['Buy milk'])
    })
  })

  it('applies quick-entry syntax and strips tokens from the title', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Pay rent #home @2030-08-01 !{Enter}')
    const todoGroup = screen.getByRole('region', { name: 'To do' })
    expect(within(todoGroup).getByText('Pay rent')).toBeInTheDocument()
    expect(within(todoGroup).getByText('#home')).toBeInTheDocument()
    const t = useStore.getState().tasks[0]
    expect(t).toMatchObject({
      title: 'Pay rent',
      category: 'home',
      priority: 'high',
      dueDate: '2030-08-01'
    })
  })
})

describe('status cycle', () => {
  it('cycles todo → doing → done → todo and persists', async () => {
    const { storage, user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Water plants{Enter}')

    await user.click(screen.getByRole('button', { name: /todo — click to mark doing/ }))
    expect(screen.getByRole('region', { name: 'Doing' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /doing — click to mark done/ }))
    expect(screen.getByRole('region', { name: 'Done' })).toBeInTheDocument()
    expect(useStore.getState().tasks[0].completedAt).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /done — click to mark to do/ }))
    expect(screen.getByRole('region', { name: 'To do' })).toBeInTheDocument()
    expect(useStore.getState().tasks[0].completedAt).toBeNull()

    await waitFor(async () => {
      const stored = await storage.listTasks()
      expect(stored[0].status).toBe('todo')
    })
  })
})

describe('edit', () => {
  it('edits the title inline; Enter commits', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Call bank{Enter}')
    await user.click(screen.getByText('Call bank'))
    const edit = screen.getByLabelText('Edit task title')
    await user.clear(edit)
    await user.type(edit, 'Call the bank{Enter}')
    expect(screen.getByText('Call the bank')).toBeInTheDocument()
    expect(useStore.getState().tasks[0].title).toBe('Call the bank')
  })

  it('Escape cancels an edit without saving', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Original{Enter}')
    await user.click(screen.getByText('Original'))
    await user.type(screen.getByLabelText('Edit task title'), ' changed{Escape}')
    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(useStore.getState().tasks[0].title).toBe('Original')
  })

  it('edits note, category, due and priority in the side-peek panel', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Plan trip{Enter}')
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    const peek = screen.getByRole('dialog', { name: 'Task details' })
    await user.type(within(peek).getByLabelText('Task note'), 'check flights')
    await user.click(within(peek).getByRole('button', { name: 'High' }))
    expect(useStore.getState().tasks[0]).toMatchObject({
      note: 'check flights',
      priority: 'high'
    })
    await user.click(within(peek).getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('dialog', { name: 'Task details' })).not.toBeInTheDocument()
  })

  it('changes status from the side-peek and moves the task between groups', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Someday thing{Enter}')
    await user.keyboard('{Escape}')

    await user.keyboard('j')
    await user.keyboard('e') // open side-peek for the selection
    const peek = screen.getByRole('dialog', { name: 'Task details' })
    await user.selectOptions(within(peek).getByLabelText('Task status'), 'backlog')
    const backlogGroup = screen.getByRole('region', { name: 'Backlog' })
    expect(within(backlogGroup).getByText('Someday thing')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Task details' })).not.toBeInTheDocument()
  })

  it('opens the side-peek by clicking a task row and closes it on outside click', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Read book{Enter}')

    const row = screen.getByText('Read book').closest('.task-row') as HTMLElement
    await user.click(row)
    expect(screen.getByRole('dialog', { name: 'Task details' })).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('dialog', { name: 'Task details' })).not.toBeInTheDocument()
  })

  it('switches the side-peek when clicking another row while open', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Task A{Enter}')
    await user.keyboard('Task B{Enter}')

    await user.click(screen.getByText('Task A').closest('.task-row') as HTMLElement)
    let peek = screen.getByRole('dialog', { name: 'Task details' })
    expect(within(peek).getByText('Task A')).toBeInTheDocument()

    await user.click(screen.getByText('Task B').closest('.task-row') as HTMLElement)
    peek = screen.getByRole('dialog', { name: 'Task details' })
    expect(within(peek).getByText('Task B')).toBeInTheDocument()
  })

  it('opens the side-peek by clicking a board card', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Ship it{Enter}')
    act(() => useStore.getState().setView('board'))

    await user.click(screen.getByText('Ship it'))
    expect(screen.getByRole('dialog', { name: 'Task details' })).toBeInTheDocument()
  })
})

describe('delete & undo', () => {
  it('deletes with an undo toast; undo restores the task', async () => {
    const { storage, user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Oops task{Enter}')
    await user.click(screen.getByRole('button', { name: 'Delete task' }))

    expect(screen.queryByText('Oops task')).not.toBeInTheDocument()
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent('Deleted “Oops task”')
    await waitFor(async () => expect(await storage.listTasks()).toHaveLength(0))

    await user.click(within(toast).getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Oops task')).toBeInTheDocument()
    await waitFor(async () => expect(await storage.listTasks()).toHaveLength(1))
  })
})

describe('filters & search', () => {
  it('combines status, category and search filters', async () => {
    const { user } = await setup()
    const input = screen.getByLabelText('Add a task')
    await user.click(input)
    await user.keyboard('Buy milk #errands{Enter}')
    await user.keyboard('Buy stamps #home{Enter}')
    await user.keyboard('Sell bike #errands{Enter}')

    await user.click(screen.getByRole('button', { name: '#errands' }))
    expect(screen.queryByText('Buy stamps')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Search tasks'), 'buy')
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.queryByText('Sell bike')).not.toBeInTheDocument()
  })

  it('shows the empty-filter state and clears it', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Something{Enter}')
    await user.type(screen.getByLabelText('Search tasks'), 'zzz-no-match')
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'clear filters' }))
    expect(screen.getByText('Something')).toBeInTheDocument()
  })
})

describe('keyboard shortcuts', () => {
  it('space cycles the selected task, x deletes it', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Task A{Enter}')
    await user.keyboard('{Escape}') // blur the quick-add input

    await user.keyboard('j') // select first task
    await user.keyboard(' ')
    expect(screen.getByRole('region', { name: 'Doing' })).toBeInTheDocument()

    await user.keyboard('x')
    expect(screen.queryByText('Task A')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “Task A”')
  })

  it('1/2/3/0 switch status filters', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Task B{Enter}')
    await user.keyboard('{Escape}')

    await user.keyboard('3')
    expect(useStore.getState().filterStatus).toBe('done')
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
    await user.keyboard('0')
    expect(screen.getByText('Task B')).toBeInTheDocument()
  })
})

describe('done log & archive', () => {
  it('shows completed tasks grouped under Today and reopens them', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Finish report{Enter}')
    await user.click(screen.getByRole('button', { name: /todo — click to mark doing/ }))
    await user.click(screen.getByRole('button', { name: /doing — click to mark done/ }))

    await user.click(screen.getByRole('link', { name: 'Done log' }))
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Finish report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'reopen' }))
    expect(useStore.getState().tasks[0].status).toBe('todo')
  })

  it('archives done tasks out of the main list but keeps them in the log', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Old chore{Enter}')
    await user.click(screen.getByRole('button', { name: /todo — click to mark doing/ }))
    await user.click(screen.getByRole('button', { name: /doing — click to mark done/ }))

    await user.click(screen.getByRole('link', { name: 'Export & data' }))
    await user.click(screen.getByRole('button', { name: 'archive all done tasks' }))
    await user.click(screen.getByRole('link', { name: '← back' }))
    expect(screen.queryByText('Old chore')).not.toBeInTheDocument()

    useStore.getState().setView('log')
    expect(await screen.findByText('Old chore')).toBeInTheDocument()
  })
})

describe('backlog & canceled', () => {
  it('shows backlog tasks in their own group and via the 4 filter key', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Someday project{Enter}')
    await user.keyboard('Active task{Enter}')
    await user.keyboard('{Escape}')

    const backlogId = useStore.getState().tasks.find((t) => t.title === 'Someday project')!.id
    act(() => useStore.getState().setStatus(backlogId, 'backlog'))

    const backlogGroup = screen.getByRole('region', { name: 'Backlog' })
    expect(within(backlogGroup).getByText('Someday project')).toBeInTheDocument()

    await user.keyboard('4')
    expect(screen.getByText('Someday project')).toBeInTheDocument()
    expect(screen.queryByText('Active task')).not.toBeInTheDocument()
  })

  it('hides canceled tasks from the list but logs them with canceled styling', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Bad idea{Enter}')
    const id = useStore.getState().tasks[0].id
    act(() => useStore.getState().setStatus(id, 'canceled'))

    expect(screen.queryByText('Bad idea')).not.toBeInTheDocument()
    expect(useStore.getState().tasks[0].completedAt).not.toBeNull()

    await user.click(screen.getByRole('link', { name: 'Done log' }))
    const title = screen.getByText('Bad idea')
    expect(title).toHaveClass('canceled')
    expect(screen.getByText(/1 canceled/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'reopen' }))
    expect(useStore.getState().tasks[0]).toMatchObject({ status: 'todo', completedAt: null })
  })

  it('renders priority icons from quick-entry tokens', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Server down !!{Enter}')
    await user.keyboard('Tidy desk !low{Enter}')
    expect(screen.getByRole('img', { name: 'Urgent priority' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Low priority' })).toBeInTheDocument()
  })
})

describe('command palette', () => {
  it('opens with Cmd+K even while typing in a field, and Escape closes it', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('{Meta>}k{/Meta}')
    const palette = screen.getByRole('dialog', { name: 'Command palette' })
    expect(within(palette).getByLabelText('Command palette input')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
  })

  it('runs a task-scoped command: mark the selected task as canceled', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Doomed task{Enter}')
    await user.keyboard('{Escape}')
    await user.keyboard('j') // select it

    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('mark as canceled')
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument()
    expect(useStore.getState().tasks[0].status).toBe('canceled')
    expect(screen.queryByText('Doomed task')).not.toBeInTheDocument()
  })

  it('creates a task with quick-entry syntax from the fallback row', async () => {
    const { user } = await setup()
    await user.keyboard('{Meta>}k{/Meta}')
    await user.keyboard('zzz Buy stamps #errands')
    const palette = screen.getByRole('dialog', { name: 'Command palette' })
    await user.click(within(palette).getByText(/Create task:/))
    const t = useStore.getState().tasks.find((x) => x.title.includes('Buy stamps'))
    expect(t).toMatchObject({ category: 'errands' })
  })

  it('navigates views from the palette', async () => {
    const { user } = await setup()
    await user.keyboard('{Meta>}k{/Meta}')
    await user.keyboard('done log')
    await user.keyboard('{Enter}')
    expect(useStore.getState().view).toBe('log')
    expect(screen.getByText('Done log')).toBeInTheDocument()
  })
})

describe('board view', () => {
  it('b toggles the board; columns render with their tasks', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Board task{Enter}')
    await user.keyboard('{Escape}')

    await user.keyboard('b')
    expect(useStore.getState().view).toBe('board')
    const todoCol = screen.getByRole('region', { name: 'To do' })
    expect(within(todoCol).getByText('Board task')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Backlog' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Doing' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Done' })).toBeInTheDocument()

    await user.keyboard('b')
    expect(useStore.getState().view).toBe('list')
  })

  it('moveTask reorders within a column via sortIndex', async () => {
    const { user } = await setup()
    const input = screen.getByLabelText('Add a task')
    await user.click(input)
    await user.keyboard('First{Enter}')
    await user.keyboard('Second{Enter}')
    await user.keyboard('Third{Enter}')
    // newest-added tasks get the smallest sortIndex: Third, Second, First
    const byTitle = (title: string) =>
      useStore.getState().tasks.find((t) => t.title === title)!

    act(() => useStore.getState().moveTask(byTitle('First').id, 'todo', 0))
    const ordered = [...useStore.getState().tasks]
      .filter((t) => t.status === 'todo')
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((t) => t.title)
    expect(ordered).toEqual(['First', 'Third', 'Second'])
  })

  it('moveTask across columns changes status and sets completedAt for done', async () => {
    const { user, storage } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Ship it{Enter}')
    const id = useStore.getState().tasks[0].id

    act(() => useStore.getState().moveTask(id, 'done', 0))
    expect(useStore.getState().tasks[0]).toMatchObject({ status: 'done' })
    expect(useStore.getState().tasks[0].completedAt).not.toBeNull()

    act(() => useStore.getState().moveTask(id, 'backlog', 0))
    expect(useStore.getState().tasks[0]).toMatchObject({ status: 'backlog', completedAt: null })
    await waitFor(async () => {
      const stored = await storage.listTasks()
      expect(stored[0].status).toBe('backlog')
    })
  })
})

describe('this week', () => {
  it('adds a task to the week from the palette and shows progress', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Weekly goal{Enter}')
    await user.keyboard('{Escape}')
    await user.keyboard('j')

    await user.keyboard('{Meta>}k{/Meta}')
    await user.keyboard('add to this week')
    await user.keyboard('{Enter}')
    expect(useStore.getState().tasks[0].plannedWeek).not.toBeNull()

    await user.keyboard('w')
    expect(useStore.getState().view).toBe('week')
    expect(screen.getByText('Weekly goal')).toBeInTheDocument()
    expect(screen.getByText('0 / 1 done')).toBeInTheDocument()
  })

  it('rolls stale planned weeks forward on init', async () => {
    const storage = new MemoryStorage()
    await storage.saveTask({
      id: 'w1',
      title: 'Left behind',
      note: '',
      status: 'todo' as const,
      priority: 'none' as const,
      category: null,
      dueDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      sortIndex: 1024,
      recurrence: null,
      archived: false,
      plannedWeek: '2026-01-05'
    })
    render(<App storage={storage} />)
    await waitFor(() => expect(useStore.getState().loaded).toBe(true))

    const t = useStore.getState().tasks[0]
    expect(t.plannedWeek).not.toBe('2026-01-05')
    expect(screen.getByRole('status')).toHaveTextContent('Rolled 1 task into this week')
    const stored = await storage.listTasks()
    expect(stored[0].plannedWeek).toBe(t.plannedWeek)
  })
})

describe('import round-trip', () => {
  it('imports an export payload, merging by id', async () => {
    const { user } = await setup()
    await user.click(screen.getByLabelText('Add a task'))
    await user.keyboard('Existing{Enter}')
    const existing = useStore.getState().tasks[0]

    const payload = {
      app: 'daybook',
      version: 1,
      tasks: [
        { ...existing, title: 'Existing (newer)', updatedAt: '2099-01-01T00:00:00.000Z' },
        {
          id: 'imported-1',
          title: 'From backup',
          status: 'todo',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    }
    const n = await useStore.getState().importTasks(JSON.stringify(payload))
    expect(n).toBe(2)
    const titles = useStore
      .getState()
      .tasks.map((t) => t.title)
      .sort()
    expect(titles).toEqual(['Existing (newer)', 'From backup'])
  })

  it('rejects a non-Daybook file', async () => {
    await setup()
    await expect(useStore.getState().importTasks('{"foo": 1}')).rejects.toThrow()
  })
})
