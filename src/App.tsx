import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth } from './auth/useAuth'
import { SignIn } from './auth/SignIn'
import { SignUp } from './auth/SignUp'
import { ResetPassword } from './auth/ResetPassword'
import { useFamily, type Family, type FamilyRole } from './family/useFamily'
import { FamilyPanel } from './family/FamilyPanel'
import { HeaderTools } from './family/HeaderTools'
import { FamilySetup } from './family/FamilySetup'
import { InviteRedeemer } from './family/InviteRedeemer'
import { MF, startOfToday, until } from './data/dates'
import {
  useAddBirthday,
  useBirthdays,
  useDeleteBirthday,
  useUpdateBirthday,
  type BirthdayInput,
  type Person,
} from './hooks/useBirthdays'
import { Filters, type Kind } from './components/Filters'
import {
  nextSteps,
  orderPeople,
  pageOf,
  rowsPerPage,
  type Sort,
} from './data/order'
import { List } from './components/List'
import { Modal } from './components/Modal'
import { Ring } from './components/Ring'
import { SiteFooter } from './components/SiteFooter'
import { Logo } from './components/Logo'

// Rows per page, following the window height (see rowsPerPage).
function usePerPage() {
  const [n, setN] = useState(() => rowsPerPage(window.innerHeight))
  useEffect(() => {
    const onResize = () => setN(rowsPerPage(window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return n
}

function BirthdayBoard({
  user,
  family,
  role,
}: {
  user: User
  family: Family
  role: FamilyRole | null
}) {
  const { signOut } = useAuth()
  const { data, isLoading, error } = useBirthdays(family.id)
  const addBirthday = useAddBirthday(family.id)
  const updateBirthday = useUpdateBirthday(family.id)
  const deleteBirthday = useDeleteBirthday(family.id)

  const [search, setSearchState] = useState('')
  const [kind, setKindState] = useState<Kind>('all')
  const [sort, setSortState] = useState<Sort>('month')
  const [month, setMonthState] = useState<number | null>(null)
  // Which upcoming day "Next up" points at: 0 = soonest, +1 per extra tap.
  const [step, setStep] = useState(0)
  const [page, setPage] = useState(0)
  // Person tapped in the list, shown on the wheel.
  const [pickedId, setPickedId] = useState<string | null>(null)
  // A list tap also asks the wheel to sweep a pointer to that person.
  const [sweep, setSweep] = useState<{
    id: string
    n: number
    delay: number
  } | null>(null)
  const ringRef = useRef<HTMLElement>(null)
  const perPage = usePerPage()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Mirrors the owner_or_creator_update_birthdays policy (0003).
  const canEdit = (p: Person | null) =>
    !p || role === 'owner' || p.created_by === user.id

  const people = useMemo<Person[]>(() => {
    const today = startOfToday()
    return (data ?? []).map((b) => ({ ...b, u: until(b.month, b.day, today) }))
  }, [data])

  const q = search.trim().toLowerCase()
  const kindOk = (p: Person) => kind === 'all' || (kind === 'kid') === p.is_kid
  const ok = (p: Person) =>
    kindOk(p) &&
    (month === null || p.month - 1 === month) &&
    p.name.toLowerCase().includes(q)

  const visible = people.filter(ok)
  const picked = visible.find((p) => p.id === pickedId) ?? null
  const visibleIds = new Set(visible.map((p) => p.id))
  const ordered = orderPeople(visible, sort)
  const steps = nextSteps(visible)
  const stepU = steps.length
    ? steps[(sort === 'next' ? step : 0) % steps.length]
    : null
  const nextGroupIds = new Set(
    visible.filter((p) => p.u === stepU).map((p) => p.id),
  )
  const counts = {
    all: people.filter(kindOk).length,
    months: Array.from(
      { length: 12 },
      (_, m) => people.filter((p) => kindOk(p) && p.month - 1 === m).length,
    ),
  }

  // Any filter change starts again from page 1 and the soonest birthday.
  function refilter() {
    setPage(0)
    setStep(0)
    setPickedId(null)
  }
  function setSearch(v: string) {
    setSearchState(v)
    refilter()
  }
  function setKind(v: Kind) {
    setKindState(v)
    refilter()
  }
  function setMonth(v: number | null) {
    setMonthState(v)
    refilter()
  }

  function setSort(next: Sort) {
    if (next === 'next' && sort === 'next') {
      // Tapping Next up again moves on to the following birthday (within the filters).
      // The wheel shows it; the list quietly turns to its page without scrolling.
      if (!steps.length) return
      const s = step + 1
      const target = ordered.find((p) => p.u === steps[s % steps.length])
      setStep(s)
      setPickedId(null)
      if (target) setPage(pageOf(ordered, target.id, perPage))
      return
    }
    setSortState(next)
    if (next === 'next') setMonthState(null)
    refilter()
  }

  // A dot was tapped: select that person and turn the list to their page, without scrolling.
  function pickFromWheel(p: Person) {
    setPickedId(p.id)
    setPage(pageOf(ordered, p.id, perPage))
  }

  // Show a list row's person on the wheel, scrolling up to it if it's off screen.
  function pick(p: Person) {
    setPickedId(p.id)
    const el = ringRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const offscreen = r.top < 0 || r.bottom > window.innerHeight
    // Start the sweep once the scroll has (roughly) settled so it's seen whole.
    setSweep((s) => ({
      id: p.id,
      n: (s?.n ?? 0) + 1,
      delay: offscreen ? 450 : 0,
    }))
    if (offscreen) {
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      el.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }
  }

  function openModal(person: Person | null) {
    setEditingPerson(person)
    window.history.pushState({ modal: true }, '')
    setModalOpen(true)
  }

  // Stable so Modal's popstate/Escape listeners aren't re-bound every render.
  const closeModal = useCallback(() => {
    setModalOpen(false)
    if (window.history.state?.modal) window.history.back()
  }, [])

  const closePanel = useCallback(() => setPanelOpen(false), [])

  async function save(input: BirthdayInput) {
    const dup = people.some(
      (p) =>
        p.id !== editingPerson?.id &&
        p.month === input.month &&
        p.day === input.day &&
        p.name.toLowerCase() === input.name.toLowerCase(),
    )
    if (dup)
      throw new Error(
        `${input.name} is already listed on ${input.day} ${MF[input.month - 1]}.`,
      )
    if (editingPerson)
      await updateBirthday.mutateAsync({ id: editingPerson.id, ...input })
    else await addBirthday.mutateAsync(input)
    closeModal()
  }

  async function remove() {
    if (!editingPerson) return
    await deleteBirthday.mutateAsync(editingPerson.id)
    closeModal()
  }

  if (isLoading) return <div className="auth-shell">Loading…</div>

  return (
    <div className="wrap">
      <section className="panel intro">
        <div className="intro-head">
          <h1>
            <Logo className="title-logo" tight animated />
            {family.name}
          </h1>
          <HeaderTools
            user={user}
            family={family}
            role={role}
            onOpenFamily={() => setPanelOpen(true)}
            onSignOut={() => signOut()}
            onError={setNotice}
          />
        </div>
        <p>
          Every birthday around one year. Tap a dot to see who it belongs to, or
          tap a month to filter the list.
        </p>
        {(error || notice) && (
          <p className="auth-error">{error?.message ?? notice}</p>
        )}
      </section>
      <section className="panel wheel" ref={ringRef}>
        <Ring
          people={people}
          visibleIds={visibleIds}
          nextGroupIds={nextGroupIds}
          selectedMonth={month}
          onSelectMonth={(m) => setMonth(month === m ? null : m)}
          picked={picked}
          onPick={pickFromWheel}
          onClearPick={() => setPickedId(null)}
          sweep={sweep}
        />
        <div className="legend">
          <span>
            <i />
            Borora
          </span>
          <span className="k">
            <i />
            Chotora
          </span>
          <span className="t">
            <i />
            Today
          </span>
        </div>
      </section>
      <Filters
        search={search}
        setSearch={setSearch}
        kind={kind}
        setKind={setKind}
        sort={sort}
        setSort={setSort}
        month={month}
        setMonth={setMonth}
        counts={counts}
        onAdd={() => openModal(null)}
      />
      <List
        people={ordered}
        sort={sort}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onEdit={openModal}
        onPick={pick}
        pickedId={picked?.id ?? null}
      />
      <Modal
        person={editingPerson}
        isOpen={modalOpen}
        onClose={closeModal}
        onSave={save}
        onDelete={remove}
        canEdit={canEdit(editingPerson)}
      />
      {panelOpen && (
        <FamilyPanel
          user={user}
          family={family}
          role={role}
          onClose={closePanel}
        />
      )}
    </div>
  )
}

function FamilyHome({ user }: { user: User }) {
  const { family, role, loading, error } = useFamily(user.id)

  if (loading) return <div className="auth-shell">Loading…</div>
  if (family) return <BirthdayBoard user={user} family={family} role={role} />
  if (error) {
    return (
      <div className="auth-shell">
        <p className="auth-error">{error.message}</p>
      </div>
    )
  }

  return <FamilySetup user={user} />
}

function Screens() {
  const { user, loading, isRecovering } = useAuth()
  const [showSignUp, setShowSignUp] = useState(false)

  if (loading) return <div className="auth-shell">Loading…</div>

  if (isRecovering) {
    return (
      <div className="auth-shell">
        <ResetPassword />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-shell">
        {showSignUp ? (
          <SignUp onSwitch={() => setShowSignUp(false)} />
        ) : (
          <SignIn onSwitch={() => setShowSignUp(true)} />
        )}
      </div>
    )
  }

  return (
    <InviteRedeemer user={user}>
      <FamilyHome user={user} />
    </InviteRedeemer>
  )
}

function App() {
  return (
    <>
      <Screens />
      <SiteFooter />
    </>
  )
}

export default App
