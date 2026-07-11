import { useStore } from '../store/useStore'

export function Toast() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className="toast" role="status">
      <span className="toast-msg">{toast.msg}</span>
      {toast.onUndo && (
        <button className="toast-undo" onClick={() => toast.onUndo?.()}>
          Undo
        </button>
      )}
    </div>
  )
}
