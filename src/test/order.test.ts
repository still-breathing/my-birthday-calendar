import { describe, expect, it } from 'vitest'
import { nextSteps, orderPeople, pageOf, rowsPerPage } from '../data/order'
import type { Person } from '../hooks/useBirthdays'

const person = (id: string, month: number, day: number, u: number, is_kid = false): Person => ({
  id,
  family_id: 'f',
  name: id,
  month,
  day,
  birth_year: null,
  is_kid,
  note: null,
  created_by: null,
  u,
})

const people = [
  person('c', 3, 1, 120),
  person('a', 1, 5, 60),
  person('b', 1, 5, 60, true),
  person('d', 11, 2, 3),
]

describe('orderPeople', () => {
  it('orders by calendar date', () => {
    expect(orderPeople(people, 'month').map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('orders soonest first', () => {
    expect(orderPeople(people, 'next').map((p) => p.id)).toEqual(['d', 'a', 'b', 'c'])
  })
})

describe('nextSteps', () => {
  it('lists each upcoming day once, soonest first', () => {
    expect(nextSteps(people)).toEqual([3, 60, 120])
  })

  it('respects a kind filter applied beforehand', () => {
    expect(nextSteps(people.filter((p) => p.is_kid))).toEqual([60])
  })
})

describe('paging', () => {
  it('keeps 5 to 10 rows per page', () => {
    expect(rowsPerPage(400)).toBe(5)
    expect(rowsPerPage(812)).toBe(8)
    expect(rowsPerPage(1400)).toBe(10)
  })

  it('finds the page a person is on', () => {
    const many = Array.from({ length: 12 }, (_, i) => person(`p${i}`, 1, i + 1, i))
    expect(pageOf(many, 'p0', 5)).toBe(0)
    expect(pageOf(many, 'p7', 5)).toBe(1)
    expect(pageOf(many, 'missing', 5)).toBe(0)
  })
})
