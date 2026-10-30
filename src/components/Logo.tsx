// The ring-and-dots mark, same as public/favicon.svg (minus its tile background).
// `tight` crops the empty margin so the mark can be sized to match text; the crop
// is centred on the ring so dots never clip as they orbit.
// `animated` sends the dots around the ring, like birthdays around the year.
export function Logo({
  className,
  tight = false,
  animated = false,
}: {
  className?: string
  tight?: boolean
  animated?: boolean
}) {
  const classes = [className, animated && 'logo-orbit'].filter(Boolean).join(' ')
  return (
    <svg
      className={classes || undefined}
      viewBox={tight ? '4 4 24 24' : '0 0 32 32'}
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke="var(--line)"
        strokeWidth="2"
      />
      <g className="logo-dots">
        <circle cx="16" cy="7" r="3" fill="var(--fam)" />
        <circle cx="24.5" cy="19" r="2.6" fill="var(--kid)" />
        <circle cx="9.5" cy="22" r="2.6" fill="var(--fam)" />
        <circle cx="8" cy="12" r="2.2" fill="var(--sun)" />
      </g>
    </svg>
  )
}
