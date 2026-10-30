import { Fragment } from 'react'
import { MF, MS, startOfToday, when } from '../data/dates'
import type { Sort } from '../data/order'
import type { Person } from '../hooks/useBirthdays'
import { PencilIcon } from './Icons'

interface ListProps {
  // Already filtered and in display order (orderPeople).
  people: Person[]
  sort: Sort
  page: number
  perPage: number
  onPage: (page: number) => void
  onEdit: (person: Person) => void
  // Tapping a row shows that person on the wheel.
  onPick: (person: Person) => void
  pickedId: string | null
}

const countLabel = (n: number) => `${n} ${n === 1 ? 'birthday' : 'birthdays'}`

function Row({
  p,
  on,
  onEdit,
  onPick,
}: {
  p: Person
  on: boolean
  onEdit: () => void
  onPick: () => void
}) {
  return (
    <article
      className={`row${p.is_kid ? ' k' : ''}${on ? ' on' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Show ${p.name} on the wheel`}
      onClick={onPick}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === 'Enter' || e.key === ' ')
        ) {
          e.preventDefault()
          onPick()
        }
      }}
    >
      <div className="d">
        {p.day}
        <small>{MS[p.month - 1]}</small>
      </div>
      <div>
        <div className="n">{p.name}</div>
        <div className="s">
          <span>{p.is_kid ? 'Chotora' : 'Borora'}</span>
          <span className={`badge${p.u <= 7 ? ' soon' : ''}`}>{when(p.u)}</span>
          {p.note && <span className="note">{p.note}</span>}
        </div>
      </div>
      <button
        className="x"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        aria-label={`Edit ${p.name}`}
        title="Edit"
      >
        <PencilIcon />
      </button>
    </article>
  )
}

// Month heading for a row: calendar month, or month-and-year of the next occurrence.
function heading(p: Person, sort: Sort, today: Date) {
  if (sort === 'month') {
    return {
      key: p.month,
      title: MF[p.month - 1],
      thisMonth: p.month === today.getMonth() + 1,
    }
  }
  const t = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + p.u,
  )
  return {
    key: t.getFullYear() * 12 + t.getMonth(),
    title: `${MF[t.getMonth()]} ${t.getFullYear()}`,
    thisMonth: false,
  }
}

export function List({
  people,
  sort,
  page,
  perPage,
  onPage,
  onEdit,
  onPick,
  pickedId,
}: ListProps) {
  if (!people.length) {
    return (
      <main>
        <p className="empty">
          No one matches. Clear the search or pick another month.
        </p>
      </main>
    )
  }

  const today = startOfToday()
  // Headings show the whole month's count, even when it spans pages.
  const totals = new Map<number, number>()
  for (const p of people) {
    const k = heading(p, sort, today).key
    totals.set(k, (totals.get(k) ?? 0) + 1)
  }

  const pages = Math.ceil(people.length / perPage)
  const current = Math.min(page, pages - 1)
  const shown = people.slice(current * perPage, (current + 1) * perPage)

  return (
    <main>
      {shown.map((p, i) => {
        const h = heading(p, sort, today)
        const first =
          i === 0 || heading(shown[i - 1], sort, today).key !== h.key
        return (
          <Fragment key={p.id}>
            {first && (
              <div className="mh">
                <h2>{h.title}</h2>
                <span>
                  {countLabel(totals.get(h.key) ?? 0)}
                  {h.thisMonth ? ', this month' : ''}
                </span>
              </div>
            )}
            <Row
              p={p}
              on={p.id === pickedId}
              onEdit={() => onEdit(p)}
              onPick={() => onPick(p)}
            />
          </Fragment>
        )
      })}
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          <button
            onClick={() => onPage(current - 1)}
            disabled={current === 0}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span>
            {current * perPage + 1}–{current * perPage + shown.length} of{' '}
            {people.length}
          </span>
          <button
            onClick={() => onPage(current + 1)}
            disabled={current === pages - 1}
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}
    </main>
  )
}
