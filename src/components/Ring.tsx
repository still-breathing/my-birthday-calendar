import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { MF, MS, ang, doy, pt } from '../data/dates'
import type { Person } from '../hooks/useBirthdays'
import { Center } from './Center'

interface RingProps {
  people: Person[]
  visibleIds: Set<string>
  nextGroupIds: Set<string>
  selectedMonth: number | null
  onSelectMonth: (month: number) => void
  // The selected person (from a dot or a list row): shown in the centre with
  // their dot highlighted. Hovering another dot previews it meanwhile.
  picked: Person | null
  onPick: (person: Person) => void
  onClearPick: () => void
  // Bumped when a list row is tapped: dots flash in turn from today to that person.
  sweep: { id: string; n: number; delay: number } | null
}

const TAU = 2 * Math.PI
const SWEEP_MS = 900
// How far clockwise angle `a` is from angle `from`, in [0, 2π).
const ahead = (a: number, from: number) => (((a - from) % TAU) + TAU) % TAU

// Clockwise arc along the rim between two days of the year.
function rimArc(fromDay: number, toDay: number) {
  const [x1, y1] = pt(ang(fromDay), 150)
  const [x2, y2] = pt(ang(toDay), 150)
  const large = toDay - fromDay > 183 ? 1 : 0
  return `M${x1} ${y1} A150 150 0 ${large} 1 ${x2} ${y2}`
}

// Year-so-far "comet trail": the arc from 1 January to `today`, split into
// short pieces that brighten towards today.
const TRAIL_PIECES = 48
function trail(today: number) {
  const span = today - 0.5
  return Array.from({ length: TRAIL_PIECES }, (_, i) => {
    const t = (i + 1) / TRAIL_PIECES
    const from = 0.5 + (span * i) / TRAIL_PIECES
    // A sliver of overlap so the pieces join without hairline gaps.
    const to = Math.min(today, 0.5 + span * t + 0.3)
    return { d: rimArc(from, to), t, opacity: 0.04 + 0.66 * t * t }
  })
}

// One month's slice of the rim, for the month spotlight and hover glow.
const monthArc = (m: number) =>
  rimArc(doy(m + 1, 1) - 0.5, m === 11 ? 366.5 : doy(m + 2, 1) - 0.5)

const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

export function Ring({
  people,
  visibleIds,
  nextGroupIds,
  selectedMonth,
  onSelectMonth,
  picked,
  onPick,
  onClearPick,
  sweep,
}: RingProps) {
  const [peeked, setPeeked] = useState<Person | null>(null)
  // How far the sweep has travelled clockwise from today, while it runs.
  const [swept, setSwept] = useState<number | null>(null)
  // Month name under the mouse (or keyboard focus): its slice glows faintly.
  const [hoverMonth, setHoverMonth] = useState<number | null>(null)
  const trailMask = useId()

  const now = new Date()
  const todayDoy = doy(now.getMonth() + 1, now.getDate())
  const ta = ang(todayDoy)
  const [a1, b1] = pt(ta, 100)
  const [a2, b2] = pt(ta, 150)

  const sweepTarget = sweep && people.find((p) => p.id === sweep.id)
  const sweepTo = sweepTarget
    ? ahead(ang(doy(sweepTarget.month, sweepTarget.day)), ta)
    : 0

  useEffect(() => {
    if (!sweep || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return
    let frame = 0
    let start = 0
    const tick = (t: number) => {
      start ||= t
      const k = Math.min(1, (t - start) / SWEEP_MS)
      setSwept(k < 1 ? (1 - (1 - k) ** 3) * sweepTo : null)
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    const timer = setTimeout(
      () => (frame = requestAnimationFrame(tick)),
      sweep.delay,
    )
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      setSwept(null)
    }
    // Re-run only for a new sweep request, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweep?.n])

  const seen: Record<string, number> = {}
  const dots = people.map((p) => {
    const v = doy(p.month, p.day)
    const key = (p.is_kid ? 'k' : 'a') + v
    const j = (seen[key] = (seen[key] ?? -1) + 1)
    const [x, y] = pt(ang(v), (p.is_kid ? 118 : 138) - j * 10)
    return { p, v, x, y }
  })

  const group = people.filter((p) => nextGroupIds.has(p.id))
  const shown = peeked ?? picked
  const centerPeople = shown ? [shown] : group

  return (
    <div className="ringwrap">
      <svg
        className={swept !== null ? 'sweeping' : undefined}
        // Cropped to the month labels (radius 182) so the ring fills the box.
        viewBox="18 18 364 364"
        role="group"
        aria-label="Year wheel of birthdays"
        onPointerDown={(e) => {
          if (!(e.target as Element).closest('.dotg')) {
            setPeeked(null)
            onClearPick()
          }
        }}
      >
        <circle className="core" cx="200" cy="200" r="100" />
        <circle className="rim" cx="200" cy="200" r="150" />
        {/* How much of the year has gone: 1 January up to today. */}
        {todayDoy > 1 && (
          <>
            {/* Drawn in on load by revealing it through a mask. */}
            <mask id={trailMask}>
              <path
                className="year-reveal"
                d={rimArc(0.5, todayDoy)}
                pathLength={1}
              />
            </mask>
            <g className="year" mask={`url(#${trailMask})`}>
              {trail(todayDoy).map((piece, i) => (
                <path
                  key={i}
                  d={piece.d}
                  opacity={piece.opacity}
                  style={{
                    // Blend from --trail-from (1 Jan) to --trail-to (today).
                    stroke: `color-mix(in srgb, var(--trail-to) ${Math.round(piece.t * 100)}%, var(--trail-from))`,
                  }}
                />
              ))}
            </g>
          </>
        )}
        {hoverMonth !== null && hoverMonth !== selectedMonth && (
          <path
            key={`h${hoverMonth}`}
            className="spot peek"
            d={monthArc(hoverMonth)}
          />
        )}
        {selectedMonth !== null && (
          <path
            key={selectedMonth}
            className="spot"
            d={monthArc(selectedMonth)}
          />
        )}
        {MS.map((n, i) => {
          const [x1, y1] = pt(ang(doy(i + 1, 1)), 146)
          const [x2, y2] = pt(ang(doy(i + 1, 1)), 158)
          const [lx, ly] = pt(ang(doy(i + 1, 15)), 168)
          const select = () => onSelectMonth(i)
          return (
            <g key={n}>
              <line className="tick" x1={x1} y1={y1} x2={x2} y2={y2} />
              <g
                className={`mo${selectedMonth === i ? ' on' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`Show ${MF[i]}`}
                onClick={select}
                onKeyDown={activate(select)}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setHoverMonth(i)
                }}
                onPointerLeave={() => setHoverMonth(null)}
                onFocus={() => setHoverMonth(i)}
                onBlur={() => setHoverMonth(null)}
              >
                <circle className="hit" cx={lx} cy={ly} r="14" />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {n}
                </text>
              </g>
            </g>
          )
        })}
        <line className="today" x1={a1} y1={b1} x2={a2} y2={b2} />
        <circle className="tdot" cx={a2} cy={b2} r="6" />
        {dots.map(({ p, v, x, y }) => {
          const on = visibleIds.has(p.id)
          const passed = swept !== null && ahead(ang(v), ta) <= swept
          const soon = on && p.u <= 30
          // Tapping a dot selects that person; the list highlights them without scrolling.
          const select = () => {
            setPeeked(null)
            onPick(p)
          }
          return (
            <g
              key={p.id}
              className={`dotg${on ? '' : ' dim'}`}
              tabIndex={on ? 0 : -1}
              role="button"
              aria-hidden={!on}
              aria-label={`${p.name}, ${p.day} ${MF[p.month - 1]}`}
              onClick={select}
              onKeyDown={activate(select)}
              onPointerOver={() => setPeeked(p)}
              onPointerOut={(e) => {
                if (e.pointerType !== 'touch') setPeeked(null)
              }}
              onFocus={() => setPeeked(p)}
              onBlur={() => setPeeked(null)}
            >
              <circle className="tap" cx={x} cy={y} r="14" />
              {picked?.id === p.id && (
                <circle className="halo" cx={x} cy={y} r="9" />
              )}
              <circle
                className={`dot ${p.is_kid ? 'k' : 'a'}${on && nextGroupIds.has(p.id) ? ' next' : ''}${soon ? ' soon' : ''}${passed ? ' swept' : ''}`}
                cx={x}
                cy={y}
                r="5"
                style={{ '--d': v } as React.CSSProperties}
              />
            </g>
          )
        })}
      </svg>
      <Center people={centerPeople} label={shown ? 'Birthday' : undefined} />
    </div>
  )
}
