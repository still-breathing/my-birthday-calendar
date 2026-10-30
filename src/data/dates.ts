export const MF = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const MS = MF.map((m) => m.slice(0, 3))
export const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const DAY_MS = 864e5

export const startOfToday = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// Days from `today` until the next occurrence of m/d (1-based month).
// A Feb 29 birthday falls on Feb 28 in non-leap years.
export const until = (m: number, d: number, today: Date = startOfToday()): number => {
  const target = (y: number) =>
    new Date(y, m - 1, m === 2 && d === 29 && !isLeap(y) ? 28 : d)
  let t = target(today.getFullYear())
  if (t < today) t = target(today.getFullYear() + 1)
  return Math.round((t.getTime() - today.getTime()) / DAY_MS)
}

// Day of year, using leap year 2000 so Feb 29 has its own slot.
export const doy = (m: number, d: number): number =>
  Math.round((new Date(2000, m - 1, d).getTime() - new Date(2000, 0, 0).getTime()) / DAY_MS)

export const ang = (v: number): number => (v / 366) * 2 * Math.PI - Math.PI / 2

export const pt = (a: number, r: number): [number, number] => [
  200 + r * Math.cos(a),
  200 + r * Math.sin(a),
]

export const when = (u: number): string =>
  u === 0
    ? 'Today'
    : u === 1
      ? 'Tomorrow'
      : u < 60
        ? `in ${u} days`
        : `in ${Math.round(u / 30.4)} months`
