export function FirstRun() {
  return (
    <div className="first-run">
      <div className="first-run-title">A quiet page for your tasks.</div>
      <p className="first-run-intro">
        Type above and press Enter — that's it. A few characters add structure, only when you
        want it:
      </p>
      <div className="first-run-grid">
        <span>
          Pay rent <strong>#home</strong>
        </span>
        <span className="hint">→ sets a category</span>
        <span>
          Call the bank <strong>!</strong>
        </span>
        <span className="hint">→ high priority (!! urgent, !low, !med)</span>
        <span>
          Water plants <strong>@tomorrow</strong>
        </span>
        <span className="hint">→ due tomorrow</span>
        <span>
          Renew passport <strong>@2026-08-01</strong>
        </span>
        <span className="hint">→ due on a date</span>
      </div>
      <p className="first-run-note">
        Everything stays in this browser. Export anytime from Export &amp; data.
      </p>
    </div>
  )
}
