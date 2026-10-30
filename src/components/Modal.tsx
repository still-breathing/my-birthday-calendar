import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DIM, MF } from '../data/dates'
import type { BirthdayInput, Person } from '../hooks/useBirthdays'

interface ModalProps {
  person: Person | null
  isOpen: boolean
  onClose: () => void
  onSave: (input: BirthdayInput) => Promise<void>
  onDelete: () => Promise<void>
  // False when the user is neither the owner nor the person who added this entry.
  canEdit: boolean
}

export function Modal(props: ModalProps) {
  if (!props.isOpen) return null
  return <ModalForm key={props.person?.id ?? 'new'} {...props} />
}

function ModalForm({ person, onClose, onSave, onDelete, canEdit }: ModalProps) {
  const [name, setName] = useState(person?.name ?? '')
  const [month, setMonth] = useState(person?.month ?? new Date().getMonth() + 1)
  const [day, setDay] = useState(person ? String(person.day) : '')
  const [year, setYear] = useState(person?.birth_year ? String(person.birth_year) : '')
  const [note, setNote] = useState(person?.note ?? '')
  const [isKid, setIsKid] = useState(person?.is_kid ?? false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => nameRef.current?.focus(), [])

  // Browser back button and Escape close the dialog.
  useEffect(() => {
    const onPop = () => onClose()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('popstate', onPop)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim().replace(/\s+/g, ' ')
    const d = Number(day)
    const y = year.trim() === '' ? null : Number(year)
    if (!n) return setErr('Enter a name.')
    if (!Number.isInteger(d) || d < 1 || d > DIM[month - 1])
      return setErr(`${MF[month - 1]} has ${DIM[month - 1]} days at most.`)
    if (y !== null && (!Number.isInteger(y) || y < 1900 || y > 2100))
      return setErr('Birth year must be between 1900 and 2100.')
    setBusy(true)
    setErr('')
    try {
      await onSave({
        name: n,
        month,
        day: d,
        birth_year: y,
        is_kid: isKid,
        note: note.trim() || null,
      })
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not save.')
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true)
    setBusy(true)
    try {
      await onDelete()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not delete.')
      setBusy(false)
    }
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dt"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form className="sheet" onSubmit={submit}>
        <h3 id="dt">{!person ? 'Add birthday' : canEdit ? 'Edit birthday' : 'Birthday'}</h3>
        <fieldset disabled={!canEdit} className="plain">
        <label>
          Name
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
            autoComplete="off"
          />
        </label>
        <div className="two">
          <label>
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MF.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={DIM[month - 1]}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Birth year (optional)
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <label>
          Note (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </label>
        <label className="chk">
          <input type="checkbox" checked={isKid} onChange={(e) => setIsKid(e.target.checked)} />
          This is Chotora
        </label>
        </fieldset>
        {!canEdit && <p className="hint">Only the owner or the person who added this can edit it.</p>}
        <p className="err" role="alert">
          {err}
        </p>
        <div className="acts">
          {person && canEdit && (
            <button type="button" className="del" onClick={remove} disabled={busy}>
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && (
            <button type="submit" className="go" disabled={busy}>
              Save
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
