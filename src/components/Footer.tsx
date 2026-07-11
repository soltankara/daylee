import { useStore } from '../store/useStore'

export function Footer() {
  const setView = useStore((s) => s.setView)
  return (
    <footer className="footer">
      <div className="footer-links">
        <a
          href="#week"
          onClick={(e) => {
            e.preventDefault()
            setView('week')
          }}
        >
          This week
        </a>
        <a
          href="#log"
          onClick={(e) => {
            e.preventDefault()
            setView('log')
          }}
        >
          Done log
        </a>
        <a
          href="#settings"
          onClick={(e) => {
            e.preventDefault()
            setView('settings')
          }}
        >
          Export &amp; data
        </a>
      </div>
      <div className="footer-legend">
        ⌘k palette · n add · / search · j k move · space cycle · e edit · x delete · b board ·
        w week · 1 2 3 4 0 filter
      </div>
    </footer>
  )
}
