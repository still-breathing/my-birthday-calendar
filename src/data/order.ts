import type { Person } from '../hooks/useBirthdays'

export type Sort = 'month' | 'next'

// The list's display order: calendar order, or soonest first.
export function orderPeople(people: Person[], sort: Sort): Person[] {
  return people
    .slice()
    .sort((a, b) =>
      sort === 'next'
        ? a.u - b.u || a.name.localeCompare(b.name)
        : a.month - b.month || a.day - b.day || a.name.localeCompare(b.name),
    )
}

// Distinct "days until" values, soonest first: each one is a Next up step.
export function nextSteps(people: Person[]): number[] {
  return [...new Set(people.map((p) => p.u))].sort((a, b) => a - b)
}

// Rows per page from the viewport height: 5 on small phones, up to 10 on tall screens.
export function rowsPerPage(viewportHeight: number): number {
  return Math.min(10, Math.max(5, Math.floor((viewportHeight - 260) / 64)))
}

export function pageOf(ordered: Person[], id: string, perPage: number): number {
  const i = ordered.findIndex((p) => p.id === id)
  return i < 0 ? 0 : Math.floor(i / perPage)
}
