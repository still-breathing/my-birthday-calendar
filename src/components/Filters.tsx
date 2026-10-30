import { useEffect, useRef } from 'react'
import { MS } from '../data/dates'
import type { Sort } from '../data/order'
import { PlusIcon, SearchIcon } from './Icons'

export type Kind = 'all' | 'fam' | 'kid'
export type { Sort } from '../data/order'

interface FiltersProps {
  search: string
  setSearch: (v: string) => void
  kind: Kind
  setKind: (v: Kind) => void
  sort: Sort
  setSort: (v: Sort) => void
  month: number | null
  setMonth: (v: number | null) => void
  counts: { all: number; months: number[] }
  onAdd: () => void
}

const KINDS: [Kind, string][] = [
  ['all', 'Everyone'],
  ['fam', 'Borora'],
  ['kid', 'Chotora'],
]
const SORTS: [Sort, string][] = [
  ['month', 'By month'],
  ['next', 'Next up'],
]

export function Filters({
  search,
  setSearch,
  kind,
  setKind,
  sort,
  setSort,
  month,
  setMonth,
  counts,
  onAdd,
}: FiltersProps) {
  const strip = useRef<HTMLElement>(null)

  // Centre the selected month chip (e.g. after tapping a month on the wheel).
  // Scrolls only the strip, never the page.
  useEffect(() => {
    const el = strip.current
    const chip = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !chip) return
    el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [month])

  // A mouse wheel scrolls the strip sideways until it reaches an end, then the page.
  useEffect(() => {
    const el = strip.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const max = el.scrollWidth - el.clientWidth
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    // Fade only the edge(s) that have more chips beyond them.
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth
      el.classList.toggle('more-l', el.scrollLeft > 1)
      el.classList.toggle('more-r', el.scrollLeft < max - 1)
    }
    onScroll()
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <>
      <div className="segs">
        <div className="seg">
          {KINDS.map(([v, label]) => (
            <button key={v} aria-pressed={kind === v} onClick={() => setKind(v)}>
              {label}
            </button>
          ))}
        </div>
        <div className="seg">
          {SORTS.map(([v, label]) => (
            <button
              key={v}
              aria-pressed={sort === v}
              onClick={() => setSort(v)}
              title={v === 'next' && sort === 'next' ? 'Tap again for the one after' : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <nav className="months" aria-label="Filter by month" ref={strip}>
        <button aria-pressed={month === null} onClick={() => setMonth(null)}>
          All year <small>{counts.all}</small>
        </button>
        {MS.map((n, i) => (
          <button
            key={n}
            className={counts.months[i] ? undefined : 'none'}
            aria-pressed={month === i}
            onClick={() => setMonth(i)}
          >
            {n} <small>{counts.months[i]}</small>
          </button>
        ))}
      </nav>
      <div className="bar">
        <div className="search-box">
          <SearchIcon />
          <input
            className="search"
            type="search"
            placeholder="Search a name"
            aria-label="Search a name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="add" onClick={onAdd}>
          <PlusIcon />
          Add birthday
        </button>
      </div>
    </>
  )
}
