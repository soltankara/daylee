import { useState, type RefObject } from 'react'
import { useStore } from '../store/useStore'

export function QuickAdd({ inputRef }: { inputRef: RefObject<HTMLInputElement> }) {
  const addTask = useStore((s) => s.addTask)
  const [value, setValue] = useState('')

  return (
    <input
      ref={inputRef}
      className="quick-add"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) {
          addTask(value)
          setValue('')
        }
      }}
      placeholder="Add a task — try  “Pay rent #home @fri !”"
      aria-label="Add a task"
    />
  )
}
