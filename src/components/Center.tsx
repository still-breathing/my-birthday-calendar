import { MF, when } from '../data/dates'
import type { Person } from '../hooks/useBirthdays'

export function Center({ people, label }: { people: Person[]; label?: string }) {
  if (!people.length) {
    return (
      <div className="center" aria-live="polite">
        <small>No birthdays</small>
        <strong>Nothing here</strong>
      </div>
    )
  }
  const p = people[0]
  const names =
    people.length > 2
      ? `${p.name} and ${people.length - 1} more`
      : people.map((x) => x.name).join(' & ')
  return (
    <div className="center" aria-live="polite">
      <small>{label ?? (p.u ? 'Next birthday' : 'Happy birthday')}</small>
      <strong>{names}</strong>
      <span>
        {p.day} {MF[p.month - 1]}
      </span>
      <b>{when(p.u)}</b>
    </div>
  )
}
