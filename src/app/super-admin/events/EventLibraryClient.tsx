'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type Option<T extends string = string> = {
  value: T
  label: string
}

type EventDefinition = {
  id: string
  legacyEventType: string | null
  name: string
  description: string | null
  subcategory: string | null
  videoUrl: string | null
  matchPhase: string
  category: string
  agePhases: string[]
  fourCorner: string
  positionRelevance: string[]
  enabledByDefault: boolean
  benchmarkable: boolean
  requiresLocation: boolean
  isActive: boolean
  archivedAt: string | null
}

type EventLibraryClientProps = {
  eventDefinitions: EventDefinition[]
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
  createEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  updateEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  archiveEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  archiveEventDefinitionsAction: (formData: FormData) => Promise<ActionResult>
  restoreEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
}

type SortKey = 'name' | 'matchPhase' | 'category' | 'location' | 'default' | 'benchmarkable'
type SortDirection = 'asc' | 'desc'

const getOptionLabel = (options: readonly Option[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value

const formatList = (options: readonly Option[], values: string[]) =>
  values.map((value) => getOptionLabel(options, value)).join(', ')

export default function EventLibraryClient({
  eventDefinitions,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
  createEventDefinitionAction,
  updateEventDefinitionAction,
  archiveEventDefinitionAction,
  archiveEventDefinitionsAction,
  restoreEventDefinitionAction,
}: EventLibraryClientProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchPhaseFilter, setMatchPhaseFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [subcategoryFilter, setSubcategoryFilter] = useState('ALL')
  const [locationFilter, setLocationFilter] = useState('ALL')
  const [legacyFilter, setLegacyFilter] = useState('ALL')
  const [defaultFilter, setDefaultFilter] = useState('ALL')
  const [benchmarkableFilter, setBenchmarkableFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const activeEvents = eventDefinitions.filter((eventDefinition) => eventDefinition.isActive)
  const archivedEvents = eventDefinitions.filter((eventDefinition) => !eventDefinition.isActive)
  const subcategoryOptions = useMemo(() => Array.from(new Set(
    eventDefinitions
      .map((eventDefinition) => eventDefinition.subcategory)
      .filter((subcategory): subcategory is string => Boolean(subcategory))
  )).sort((firstSubcategory, secondSubcategory) => firstSubcategory.localeCompare(secondSubcategory))
    .map((subcategory) => ({ value: subcategory, label: subcategory })), [eventDefinitions])
  const visibleActiveEvents = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase()

    return activeEvents
      .filter((eventDefinition) => {
        const searchableText = [
          eventDefinition.name,
          eventDefinition.description,
          eventDefinition.subcategory,
          eventDefinition.legacyEventType,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (normalizedSearchTerm && !searchableText.includes(normalizedSearchTerm)) return false
        if (matchPhaseFilter !== 'ALL' && eventDefinition.matchPhase !== matchPhaseFilter) return false
        if (categoryFilter !== 'ALL' && eventDefinition.category !== categoryFilter) return false
        if (subcategoryFilter !== 'ALL' && eventDefinition.subcategory !== subcategoryFilter) return false
        if (locationFilter === 'REQUIRES_LOCATION' && !eventDefinition.requiresLocation) return false
        if (locationFilter === 'NO_LOCATION' && eventDefinition.requiresLocation) return false
        if (legacyFilter === 'LEGACY_BACKED' && !eventDefinition.legacyEventType) return false
        if (legacyFilter === 'DB_ONLY' && eventDefinition.legacyEventType) return false
        if (defaultFilter === 'ON' && !eventDefinition.enabledByDefault) return false
        if (defaultFilter === 'OFF' && eventDefinition.enabledByDefault) return false
        if (benchmarkableFilter === 'YES' && !eventDefinition.benchmarkable) return false
        if (benchmarkableFilter === 'NO' && eventDefinition.benchmarkable) return false
        return true
      })
      .sort((firstEvent, secondEvent) => {
        const firstValue = getSortValue(firstEvent, sortKey)
        const secondValue = getSortValue(secondEvent, sortKey)
        const comparison = firstValue.localeCompare(secondValue)
        return sortDirection === 'asc' ? comparison : -comparison
      })
  }, [
    activeEvents,
    benchmarkableFilter,
    categoryFilter,
    defaultFilter,
    legacyFilter,
    locationFilter,
    matchPhaseFilter,
    searchTerm,
    sortDirection,
    sortKey,
    subcategoryFilter,
  ])
  const visibleActiveEventIds = visibleActiveEvents.map((eventDefinition) => eventDefinition.id)
  const selectedVisibleEventCount = visibleActiveEventIds.filter((eventDefinitionId) => selectedEventIds.includes(eventDefinitionId)).length
  const allVisibleSelected = visibleActiveEventIds.length > 0 && selectedVisibleEventCount === visibleActiveEventIds.length

  const runFormAction = async ({
    form,
    action,
    pendingLabel,
    successMessage,
    resetOnSuccess = false,
  }: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => {
    if (pendingAction) return

    setPendingAction(pendingLabel)
    setMessage(null)
    setError(null)

    const result = await action(new FormData(form))

    if (result.ok) {
      setMessage(successMessage)
      if (resetOnSuccess) form.reset()
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  const toggleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('asc')
  }

  const toggleSelectedEvent = (eventDefinitionId: string) => {
    setSelectedEventIds((currentIds) =>
      currentIds.includes(eventDefinitionId)
        ? currentIds.filter((currentId) => currentId !== eventDefinitionId)
        : [...currentIds, eventDefinitionId]
    )
  }

  const toggleAllVisibleEvents = () => {
    setSelectedEventIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter((currentId) => !visibleActiveEventIds.includes(currentId))
      }

      return Array.from(new Set([...currentIds, ...visibleActiveEventIds]))
    })
  }

  const bulkArchiveSelectedEvents = async () => {
    if (pendingAction || selectedEventIds.length === 0) return

    const confirmed = window.confirm(
      `Archive ${selectedEventIds.length} selected events? They will no longer appear in new Match Day setup defaults.`
    )
    if (!confirmed) return

    setPendingAction('bulk-archive')
    setMessage(null)
    setError(null)

    const formData = new FormData()
    selectedEventIds.forEach((eventDefinitionId) => formData.append('eventDefinitionId', eventDefinitionId))

    const result = await archiveEventDefinitionsAction(formData)

    if (result.ok) {
      setMessage(`${selectedEventIds.length} selected events archived.`)
      setSelectedEventIds([])
      setEditingEventId(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Super Admin</p>
        <h1 className="mt-1 text-3xl font-bold">Match Day Event Library</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Manage global event definitions used by match setup, live recording and reports.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Official events" value={String(eventDefinitions.length)} />
        <SummaryCard label="Active" value={String(activeEvents.length)} />
        <SummaryCard label="Archived" value={String(archivedEvents.length)} />
      </div>

      {message && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <details className="mt-6 rounded-2xl bg-gray-50 p-4 shadow-sm" open>
        <summary className="cursor-pointer text-lg font-bold">Create official event</summary>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            runFormAction({
              form: event.currentTarget,
              action: createEventDefinitionAction,
              pendingLabel: 'create',
              successMessage: 'Official event created.',
              resetOnSuccess: true,
            })
          }}
        >
          <EventDefinitionFields
            matchPhaseOptions={matchPhaseOptions}
            categoryOptions={categoryOptions}
            agePhaseOptions={agePhaseOptions}
            fourCornerOptions={fourCornerOptions}
            positionOptions={positionOptions}
          />
          <button
            type="submit"
            className="mt-4 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={Boolean(pendingAction)}
          >
            {pendingAction === 'create' ? 'Creating...' : 'Create official event'}
          </button>
        </form>
      </details>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Active official events</h2>
            <p className="mt-1 text-sm text-gray-500">
              Active global events can be selected in Match Day setup.
            </p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
            {visibleActiveEvents.length} of {activeEvents.length} active
          </span>
        </div>

        <EventFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          matchPhaseFilter={matchPhaseFilter}
          setMatchPhaseFilter={setMatchPhaseFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          subcategoryFilter={subcategoryFilter}
          setSubcategoryFilter={setSubcategoryFilter}
          locationFilter={locationFilter}
          setLocationFilter={setLocationFilter}
          legacyFilter={legacyFilter}
          setLegacyFilter={setLegacyFilter}
          defaultFilter={defaultFilter}
          setDefaultFilter={setDefaultFilter}
          benchmarkableFilter={benchmarkableFilter}
          setBenchmarkableFilter={setBenchmarkableFilter}
          matchPhaseOptions={matchPhaseOptions}
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
        />

        {selectedEventIds.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-bold">{selectedEventIds.length} selected</p>
            <button
              type="button"
              onClick={bulkArchiveSelectedEvents}
              className="rounded-lg bg-amber-800 px-4 py-2 font-bold text-white disabled:opacity-50"
              disabled={Boolean(pendingAction)}
            >
              {pendingAction === 'bulk-archive' ? 'Archiving...' : 'Archive selected'}
            </button>
          </div>
        )}

        <EventDefinitionsTable
          events={visibleActiveEvents}
          isActiveTable
          selectedEventIds={selectedEventIds}
          allVisibleSelected={allVisibleSelected}
          onToggleSelectedEvent={toggleSelectedEvent}
          onToggleAllVisibleEvents={toggleAllVisibleEvents}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={toggleSort}
          editingEventId={editingEventId}
          setEditingEventId={setEditingEventId}
          matchPhaseOptions={matchPhaseOptions}
          categoryOptions={categoryOptions}
          agePhaseOptions={agePhaseOptions}
          fourCornerOptions={fourCornerOptions}
          positionOptions={positionOptions}
          pendingAction={pendingAction}
          runFormAction={runFormAction}
          updateEventDefinitionAction={updateEventDefinitionAction}
          archiveEventDefinitionAction={archiveEventDefinitionAction}
          restoreEventDefinitionAction={restoreEventDefinitionAction}
        />
      </section>

      <details className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-lg font-bold">
          Archived events ({archivedEvents.length})
        </summary>
        <div className="mt-4">
          {archivedEvents.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-gray-500">No archived events.</p>
          ) : (
            <EventDefinitionsTable
              events={archivedEvents}
              isActiveTable={false}
              selectedEventIds={[]}
              allVisibleSelected={false}
              onToggleSelectedEvent={() => undefined}
              onToggleAllVisibleEvents={() => undefined}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={toggleSort}
              editingEventId={editingEventId}
              setEditingEventId={setEditingEventId}
              matchPhaseOptions={matchPhaseOptions}
              categoryOptions={categoryOptions}
              agePhaseOptions={agePhaseOptions}
              fourCornerOptions={fourCornerOptions}
              positionOptions={positionOptions}
              pendingAction={pendingAction}
              runFormAction={runFormAction}
              updateEventDefinitionAction={updateEventDefinitionAction}
              archiveEventDefinitionAction={archiveEventDefinitionAction}
              restoreEventDefinitionAction={restoreEventDefinitionAction}
            />
          )}
        </div>
      </details>
    </main>
  )
}

function getSortValue(eventDefinition: EventDefinition, sortKey: SortKey) {
  if (sortKey === 'location') return eventDefinition.requiresLocation ? '0' : '1'
  if (sortKey === 'default') return eventDefinition.enabledByDefault ? '0' : '1'
  if (sortKey === 'benchmarkable') return eventDefinition.benchmarkable ? '0' : '1'
  return eventDefinition[sortKey].toLowerCase()
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function EventFilters({
  searchTerm,
  setSearchTerm,
  matchPhaseFilter,
  setMatchPhaseFilter,
  categoryFilter,
  setCategoryFilter,
  subcategoryFilter,
  setSubcategoryFilter,
  locationFilter,
  setLocationFilter,
  legacyFilter,
  setLegacyFilter,
  defaultFilter,
  setDefaultFilter,
  benchmarkableFilter,
  setBenchmarkableFilter,
  matchPhaseOptions,
  categoryOptions,
  subcategoryOptions,
}: {
  searchTerm: string
  setSearchTerm: (value: string) => void
  matchPhaseFilter: string
  setMatchPhaseFilter: (value: string) => void
  categoryFilter: string
  setCategoryFilter: (value: string) => void
  subcategoryFilter: string
  setSubcategoryFilter: (value: string) => void
  locationFilter: string
  setLocationFilter: (value: string) => void
  legacyFilter: string
  setLegacyFilter: (value: string) => void
  defaultFilter: string
  setDefaultFilter: (value: string) => void
  benchmarkableFilter: string
  setBenchmarkableFilter: (value: string) => void
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  subcategoryOptions: readonly Option[]
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="text-sm font-medium lg:col-span-2">
        Search
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="Search event name"
        />
      </label>
      <FilterSelect label="Match phase" value={matchPhaseFilter} onChange={setMatchPhaseFilter} options={matchPhaseOptions} />
      <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
      <FilterSelect label="Subcategory" value={subcategoryFilter} onChange={setSubcategoryFilter} options={subcategoryOptions} />
      <FilterSelect
        label="Location"
        value={locationFilter}
        onChange={setLocationFilter}
        options={[
          { value: 'REQUIRES_LOCATION', label: 'Requires location' },
          { value: 'NO_LOCATION', label: 'No location required' },
        ]}
      />
      <FilterSelect
        label="Legacy"
        value={legacyFilter}
        onChange={setLegacyFilter}
        options={[
          { value: 'LEGACY_BACKED', label: 'Legacy-backed' },
          { value: 'DB_ONLY', label: 'DB-only' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 lg:grid-cols-1">
        <FilterSelect
          label="Default"
          value={defaultFilter}
          onChange={setDefaultFilter}
          options={[
            { value: 'ON', label: 'Default on' },
            { value: 'OFF', label: 'Default off' },
          ]}
        />
        <FilterSelect
          label="Benchmarkable"
          value={benchmarkableFilter}
          onChange={setBenchmarkableFilter}
          options={[
            { value: 'YES', label: 'Benchmarkable' },
            { value: 'NO', label: 'Not benchmarkable' },
          ]}
        />
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly Option[]
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2"
      >
        <option value="ALL">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function EventDefinitionsTable({
  events,
  isActiveTable,
  selectedEventIds,
  allVisibleSelected,
  onToggleSelectedEvent,
  onToggleAllVisibleEvents,
  sortKey,
  sortDirection,
  onSort,
  editingEventId,
  setEditingEventId,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
  pendingAction,
  runFormAction,
  updateEventDefinitionAction,
  archiveEventDefinitionAction,
  restoreEventDefinitionAction,
}: {
  events: EventDefinition[]
  isActiveTable: boolean
  selectedEventIds: string[]
  allVisibleSelected: boolean
  onToggleSelectedEvent: (eventDefinitionId: string) => void
  onToggleAllVisibleEvents: () => void
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (sortKey: SortKey) => void
  editingEventId: string | null
  setEditingEventId: (eventDefinitionId: string | null) => void
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
  pendingAction: string | null
  runFormAction: (options: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => Promise<void>
  updateEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  archiveEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  restoreEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-[1180px] w-full divide-y divide-gray-200 text-left text-sm">
        <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="w-10 px-3 py-3">
              {isActiveTable && (
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={onToggleAllVisibleEvents}
                  aria-label="Select all visible events"
                />
              )}
            </th>
            <SortableHeader label="Event name" sortKey="name" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <th className="px-3 py-3">Status</th>
            <SortableHeader label="Match phase" sortKey="matchPhase" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Category" sortKey="category" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <th className="px-3 py-3">Subcategory</th>
            <th className="px-3 py-3">Age phases</th>
            <th className="px-3 py-3">Positions</th>
            <th className="px-3 py-3">4 Corner</th>
            <SortableHeader label="Attributes" sortKey="location" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Default" sortKey="default" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <SortableHeader label="Benchmarkable" sortKey="benchmarkable" activeSortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {events.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-3 py-6 text-center text-gray-500">No events match the current view.</td>
            </tr>
          ) : events.map((eventDefinition) => {
            const selected = selectedEventIds.includes(eventDefinition.id)
            const pendingEdit = pendingAction === `edit:${eventDefinition.id}`
            const pendingArchive = pendingAction === `archive:${eventDefinition.id}`
            const pendingRestore = pendingAction === `restore:${eventDefinition.id}`
            const isEditing = editingEventId === eventDefinition.id

            return (
              <FragmentRow
                key={eventDefinition.id}
                eventDefinition={eventDefinition}
                selected={selected}
                isEditing={isEditing}
                isActiveTable={isActiveTable}
                matchPhaseOptions={matchPhaseOptions}
                categoryOptions={categoryOptions}
                agePhaseOptions={agePhaseOptions}
                fourCornerOptions={fourCornerOptions}
                positionOptions={positionOptions}
                pendingAction={pendingAction}
                pendingEdit={pendingEdit}
                pendingArchive={pendingArchive}
                pendingRestore={pendingRestore}
                onToggleSelectedEvent={onToggleSelectedEvent}
                setEditingEventId={setEditingEventId}
                runFormAction={runFormAction}
                updateEventDefinitionAction={updateEventDefinitionAction}
                archiveEventDefinitionAction={archiveEventDefinitionAction}
                restoreEventDefinitionAction={restoreEventDefinitionAction}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeSortKey: SortKey
  sortDirection: SortDirection
  onSort: (sortKey: SortKey) => void
}) {
  const isActive = activeSortKey === sortKey

  return (
    <th className="px-3 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-bold hover:text-blue-800"
      >
        {label}
        <span className="text-[10px]">{isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

function FragmentRow({
  eventDefinition,
  selected,
  isEditing,
  isActiveTable,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
  pendingAction,
  pendingEdit,
  pendingArchive,
  pendingRestore,
  onToggleSelectedEvent,
  setEditingEventId,
  runFormAction,
  updateEventDefinitionAction,
  archiveEventDefinitionAction,
  restoreEventDefinitionAction,
}: {
  eventDefinition: EventDefinition
  selected: boolean
  isEditing: boolean
  isActiveTable: boolean
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
  pendingAction: string | null
  pendingEdit: boolean
  pendingArchive: boolean
  pendingRestore: boolean
  onToggleSelectedEvent: (eventDefinitionId: string) => void
  setEditingEventId: (eventDefinitionId: string | null) => void
  runFormAction: (options: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => Promise<void>
  updateEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  archiveEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
  restoreEventDefinitionAction: (formData: FormData) => Promise<ActionResult>
}) {
  return (
    <>
      <tr className={selected ? 'bg-blue-50' : 'bg-white'}>
        <td className="px-3 py-3 align-top">
          {isActiveTable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelectedEvent(eventDefinition.id)}
              aria-label={`Select ${eventDefinition.name}`}
            />
          )}
        </td>
        <td className="px-3 py-3 align-top">
          <p className="font-bold text-gray-950">{eventDefinition.name}</p>
          {eventDefinition.description && (
            <p className="mt-1 line-clamp-2 max-w-64 text-xs text-gray-500">{eventDefinition.description}</p>
          )}
          {eventDefinition.videoUrl && (
            <a
              href={eventDefinition.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex text-xs font-bold text-blue-700 hover:underline"
            >
              Video link
            </a>
          )}
          {eventDefinition.legacyEventType && (
            <p className="mt-1 text-xs text-gray-400">{eventDefinition.legacyEventType}</p>
          )}
        </td>
        <td className="px-3 py-3 align-top">
          <Badge tone={eventDefinition.isActive ? 'green' : 'gray'}>
            {eventDefinition.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </td>
        <td className="px-3 py-3 align-top text-gray-700">{getOptionLabel(matchPhaseOptions, eventDefinition.matchPhase)}</td>
        <td className="px-3 py-3 align-top text-gray-700">{getOptionLabel(categoryOptions, eventDefinition.category)}</td>
        <td className="px-3 py-3 align-top text-gray-700">{eventDefinition.subcategory ?? '-'}</td>
        <td className="px-3 py-3 align-top text-gray-700">{formatList(agePhaseOptions, eventDefinition.agePhases)}</td>
        <td className="px-3 py-3 align-top text-gray-700">{formatList(positionOptions, eventDefinition.positionRelevance)}</td>
        <td className="px-3 py-3 align-top text-gray-700">{getOptionLabel(fourCornerOptions, eventDefinition.fourCorner)}</td>
        <td className="px-3 py-3 align-top">
          <div className="flex max-w-40 flex-wrap gap-1.5">
            <Badge tone="blue">Global event</Badge>
            {eventDefinition.requiresLocation && <Badge tone="amber">Requires location</Badge>}
            {eventDefinition.legacyEventType && <Badge tone="gray">Legacy-backed</Badge>}
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <Badge tone={eventDefinition.enabledByDefault ? 'green' : 'gray'}>
            {eventDefinition.enabledByDefault ? 'Default' : 'Not default'}
          </Badge>
        </td>
        <td className="px-3 py-3 align-top">
          <Badge tone={eventDefinition.benchmarkable ? 'blue' : 'gray'}>
            {eventDefinition.benchmarkable ? 'Benchmarkable' : 'Not benchmarkable'}
          </Badge>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditingEventId(isEditing ? null : eventDefinition.id)}
              className="rounded-lg border px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50"
            >
              {isEditing ? 'Close edit' : 'Edit metadata'}
            </button>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                runFormAction({
                  form: event.currentTarget,
                  action: eventDefinition.isActive ? archiveEventDefinitionAction : restoreEventDefinitionAction,
                  pendingLabel: `${eventDefinition.isActive ? 'archive' : 'restore'}:${eventDefinition.id}`,
                  successMessage: eventDefinition.isActive ? 'Event archived.' : 'Event restored.',
                })
              }}
            >
              <input type="hidden" name="eventDefinitionId" value={eventDefinition.id} />
              <button
                type="submit"
                className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${eventDefinition.isActive ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}
                disabled={Boolean(pendingAction)}
              >
                {pendingArchive ? 'Archiving...' : pendingRestore ? 'Restoring...' : eventDefinition.isActive ? 'Archive' : 'Restore'}
              </button>
            </form>
          </div>
        </td>
      </tr>
      {isEditing && (
        <tr className="bg-gray-50">
          <td colSpan={13} className="px-4 py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                runFormAction({
                  form: event.currentTarget,
                  action: updateEventDefinitionAction,
                  pendingLabel: `edit:${eventDefinition.id}`,
                  successMessage: 'Event metadata updated.',
                })
              }}
            >
              <input type="hidden" name="eventDefinitionId" value={eventDefinition.id} />
              <EventDefinitionFields
                eventDefinition={eventDefinition}
                matchPhaseOptions={matchPhaseOptions}
                categoryOptions={categoryOptions}
                agePhaseOptions={agePhaseOptions}
                fourCornerOptions={fourCornerOptions}
                positionOptions={positionOptions}
              />
              <button
                type="submit"
                className="mt-4 rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                disabled={Boolean(pendingAction)}
              >
                {pendingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'blue' | 'gray' | 'amber' }) {
  const toneClasses = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-700',
    amber: 'bg-amber-100 text-amber-900',
  }

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses[tone]}`}>{children}</span>
}

function EventDefinitionFields({
  eventDefinition,
  matchPhaseOptions,
  categoryOptions,
  agePhaseOptions,
  fourCornerOptions,
  positionOptions,
}: {
  eventDefinition?: EventDefinition
  matchPhaseOptions: readonly Option[]
  categoryOptions: readonly Option[]
  agePhaseOptions: readonly Option[]
  fourCornerOptions: readonly Option[]
  positionOptions: readonly Option[]
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Name
          <input
            name="name"
            defaultValue={eventDefinition?.name ?? ''}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Match phase
          <select
            name="matchPhase"
            defaultValue={eventDefinition?.matchPhase ?? matchPhaseOptions[0]?.value}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          >
            {matchPhaseOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Category
          <select
            name="category"
            defaultValue={eventDefinition?.category ?? categoryOptions[0]?.value}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Subcategory
          <input
            name="subcategory"
            defaultValue={eventDefinition?.subcategory ?? ''}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Optional"
          />
        </label>
        <label className="text-sm font-medium">
          4 Corner
          <select
            name="fourCorner"
            defaultValue={eventDefinition?.fourCorner ?? fourCornerOptions[0]?.value}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          >
            {fourCornerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-sm font-medium">
        Description
        <textarea
          name="description"
          defaultValue={eventDefinition?.description ?? ''}
          className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2"
        />
      </label>

      <label className="text-sm font-medium">
        Video URL
        <input
          type="url"
          name="videoUrl"
          defaultValue={eventDefinition?.videoUrl ?? ''}
          className="mt-1 w-full rounded-lg border px-3 py-2"
          placeholder="https://..."
        />
      </label>

      <CheckboxGroup
        label="Age phases"
        name="agePhase"
        options={agePhaseOptions}
        selectedValues={eventDefinition?.agePhases ?? ['YOUTH', 'ADULT']}
      />

      <CheckboxGroup
        label="Position relevance"
        name="positionRelevance"
        options={positionOptions}
        selectedValues={eventDefinition?.positionRelevance ?? ['ALL']}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="enabledByDefault"
            defaultChecked={eventDefinition?.enabledByDefault ?? false}
            disabled={eventDefinition ? !eventDefinition.isActive : false}
          />
          Enabled by default
        </label>
        <label className="rounded-lg border bg-white p-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              name="requiresLocation"
              defaultChecked={eventDefinition?.requiresLocation ?? false}
            />
            Requires location
          </span>
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Requires the coach to tap a pitch location when recording this event.
          </span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="benchmarkable"
            defaultChecked={eventDefinition?.benchmarkable ?? false}
          />
          Benchmarkable
        </label>
      </div>
    </div>
  )
}

function CheckboxGroup({
  label,
  name,
  options,
  selectedValues,
}: {
  label: string
  name: string
  options: readonly Option[]
  selectedValues: string[]
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selectedValues.includes(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
