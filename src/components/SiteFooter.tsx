import { Logo } from './Logo'

// Shown under every screen, signed in or not.
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div>
        <Logo />
        <span>© 2026 Family Birthdays</span>
        <span className="sep" aria-hidden="true">·</span>
        <a href="https://github.com/still-breathing" target="_blank" rel="noreferrer">
          github.com/still-breathing
        </a>
      </div>
    </footer>
  )
}
