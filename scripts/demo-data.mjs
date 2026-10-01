import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { fitnessTestTypes, matchEventDefinitions } from '../prisma/seed.mjs'
import { teamTacticalEventDefinitions, tacticalPresets } from '../src/lib/teamTacticalCatalogue.mjs'
import { getTacticalDetailOptions } from '../src/lib/teamTacticalObservations.ts'
import { getMatchEventPrismaCategory } from '../src/lib/matchEventTaxonomy.ts'

export const PREFIX = 'cycdemo_v1_'
export const CLUB_ID = `${PREFIX}club`
export const OWNER_ID = `${PREFIX}owner`
const EMAIL = 'local-coach@can-you-coach.local' // Existing development-only auth fallback.
const DAY = 86400000
const id = (...parts) => PREFIX + parts.join('_')
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const normalized = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const isLoopbackAddress = value => {
  if (!value) return false
  const address = String(value).split('/')[0]
  return address === '127.0.0.1' || address === '::1'
}
export function assertLocalTarget(url, env = process.env) {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') throw new Error('Production is not supported.')
  const target = new URL(url)
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('Only loopback PostgreSQL is supported; remote databases are refused.')
  if (!/^\/cyc_demo(?:_[a-z0-9_]+)?$/.test(target.pathname)) throw new Error('Use a dedicated database named cyc_demo or cyc_demo_<suffix>.')
  if ([...target.searchParams.keys()].some(key => !['schema', 'connection_limit', 'pool_timeout', 'connect_timeout', 'sslmode'].includes(key))) throw new Error('Unsupported connection parameters; socket/host overrides are refused.')
  if (target.searchParams.has('schema') && target.searchParams.get('schema') !== 'public') throw new Error('Use the public schema in the dedicated demo database.')
  return `${target.hostname}:${target.port || 5432}${target.pathname}`
}
function random(seed) {
  let state = createHash('sha256').update(String(seed)).digest().readUInt32LE()
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
}
export function makePlan({ seed = '2026', asOf = new Date().toISOString().slice(0, 10), tactical = false } = {}) {
  const anchor = new Date(`${asOf}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(+anchor) || anchor.toISOString().slice(0, 10) !== asOf) throw new Error('Invalid --as-of date; use YYYY-MM-DD.')
  const rand = random(seed)
  const rows = {}
  const add = (model, row) => { (rows[model] ??= []).push(row); return row }
  const at = (days, seconds = 0) => new Date(+anchor + days * DAY + seconds * 1000)
  const marker = JSON.stringify({ generator: PREFIX, seed: String(seed), asOf, tactical })
  add('user', { id: OWNER_ID, email: EMAIL, passwordHash: 'local-mvp-user', onboardingRole: 'CLUB_OFFICIAL', onboardingCompletedAt: at(-182) })
  add('user', { id: id('parent'), email: 'demo-parent@example.com', onboardingRole: 'PARENT_SPECTATOR', onboardingCompletedAt: at(-182) })
  add('club', { id: CLUB_ID, userId: OWNER_ID, name: 'DEMO — Meadow Vale FC (fictional)', location: 'Fictional development club', notes: marker, sendMatchReportEmails: false, sendFitnessReportEmails: false })
  add('clubMembership', { id: id('membership'), userId: OWNER_ID, clubId: CLUB_ID, role: 'OWNER' })
  const first = ['Alex', 'Jamie', 'Charlie', 'Riley', 'Morgan', 'Sam', 'Taylor', 'Casey', 'Jordan', 'Robin', 'Avery', 'Drew', 'Finley', 'Ellis', 'Cameron', 'Blake', 'Reece', 'Jesse', 'Noah', 'Quinn']
  const surnames = ['Meadows', 'Brookfield', 'Ashford']
  const positions = ['Goalkeeper', 'Right Back', 'Centre Back', 'Centre Back', 'Left Back', 'Defensive Midfielder', 'Central Midfielder', 'Attacking Midfielder', 'Right Wing', 'Left Wing', 'Striker', 'Striker', 'Central Midfielder', 'Centre Back', 'Right Wing', 'Left Back', 'Forward', 'Goalkeeper', 'Midfielder', 'Striker']
  const definitions = [...matchEventDefinitions.filter(d => d.legacyEventType), ...(tactical ? [...matchEventDefinitions.filter(d => !d.legacyEventType && d.isActive !== false && !d.archivedAt), ...teamTacticalEventDefinitions] : [])]
  const byName = new Map(definitions.map(d => [d.name, d]))
  const definitionKey = name => `catalogue_${slug(name)}`
  const fitnessKey = 'fitness_yoyo'
  const goals = []
  for (const [t, [name, ageGroup, minutes, onPitch, age]] of [['Seniors', 'Open Age', 90, 11, 25], ['Under 16', 'U16', 80, 11, 15], ['Under 12', 'U12', 60, 9, 11]].entries()) {
    const teamId = id('team', t)
    add('team', { id: teamId, clubId: CLUB_ID, name: `DEMO ${name}`, ageGroup, season: `${anchor.getUTCFullYear()}`, league: 'Fictional Demo League' })
    const players = first.map((firstName, p) => add('player', { id: id('player', t, p), teamId, firstName, surname: surnames[t], squadNumber: p + 1, preferredPosition: positions[p], dateOfBirth: new Date(Date.UTC(anchor.getUTCFullYear() - age, 0, 15)), joinedClubDate: at(p >= 18 ? -35 : -182), isActive: true }))
    if (t === 1) add('spectatorAccess', { id: id('spectator'), userId: id('parent'), clubId: CLUB_ID, playerId: players[1].id })
    for (let m = 0; m < 24; m++) {
      const future = m >= 22
      const day = future ? 7 * (m - 21) : -175 + m * 8
      const kickoffAt = at(day)
      const halfSec = minutes * 30
      const halfStart = h => new Date(+kickoffAt + h * (halfSec + 900) * 1000)
      const moment = (h, s) => new Date(+halfStart(h) + s * 1000)
      const matchId = id('match', t, m)
      const playerMode = m % 2 === 1 || (t === 1 && m >= 19)
      const scoreOnly = []
      const ownScore = future ? 0 : t === 0 ? Math.floor(m / 8) + (m % 2) : Math.floor(rand() * 5)
      const oppositionScore = future ? 0 : t === 0 ? Math.max(0, 3 - Math.floor(m / 6)) : Math.floor(rand() * 5)
      add('matchDay', { id: matchId, teamId, kickoffAt, opposition: `DEMO ${['Oakfield', 'Riverbank', 'Hillcrest', 'Willow Park', 'Westfield', 'Stonebridge'][m % 6]} ${name}`, matchType: m % 7 === 0 ? 'FRIENDLY' : 'LEAGUE', venue: m % 2 ? 'AWAY' : 'HOME', status: future ? 'DRAFT' : 'COMPLETED', eventTrackingScope: playerMode ? 'PLAYER' : 'TEAM', trackPlayerMinutes: true, ownScore, oppositionScore, ...(!future ? { firstHalfStartedAt: halfStart(0), firstHalfEndedAt: moment(0, halfSec), secondHalfStartedAt: halfStart(1), secondHalfEndedAt: moment(1, halfSec), completedAt: moment(1, halfSec) } : {}) })
      // Players 0 and 1 are reliable; 2 improves; 3 returns gradually; 18/19 join late.
      const available = players.map((p, index) => ({ p, index })).filter(({ p, index }) => +p.joinedClubDate <= +kickoffAt && !(index === 3 && m >= 7 && m <= 12) && !(t === 1 && index > 3 && (m + index) % 5 === 0))
      const ranked = [...available].sort((a,b) => {
        const priority = x => x.index <= 1 ? -100 + x.index : x.index === 2 ? (m < 8 ? 30 : -90) : x.index === 3 && m > 12 && m < 17 ? 30 : x.index >= 18 && m >= 18 ? 5 + (x.index+m)%12 : x.index >= 16 ? 40 + x.index : (x.index + m) % 16
        return priority(a) - priority(b)
      })
      const starters = ranked.slice(0, onPitch)
      const subs = ranked.slice(onPitch).filter(x => x.index !== 17).slice(0, 3)
      const subSec = Math.floor(halfSec * 0.55)
      const intervals = new Map()
      for (const [p, player] of players.entries()) {
        const starterIndex = starters.findIndex(x => x.index === p)
        const subIndex = subs.findIndex(x => x.index === p)
        const squadStatus = starterIndex >= 0 ? 'STARTER' : subIndex >= 0 ? 'SUBSTITUTE' : 'NOT_INVOLVED'
        const mdp = add('matchDayPlayer', { id: id('squad', t,m,p), matchDayId: matchId, playerId: player.id, squadStatus, startingPosition: squadStatus === 'STARTER' ? player.preferredPosition : null, shirtNumberSnapshot: p + 1, isTracked: squadStatus !== 'NOT_INVOLVED' })
        if (future || squadStatus === 'NOT_INVOLVED') continue
        const stint = (h, start, end) => {
          add('matchPlayerStint', { id: id('stint',t,m,p,h), matchDayId: matchId, matchDayPlayerId: mdp.id, playerId: player.id, half: h ? 'SECOND_HALF' : 'FIRST_HALF', startedAt: moment(h,start), endedAt: moment(h,end), startMatchSecond: start, endMatchSecond: end })
          const key = `${h}:${player.id}`; intervals.set(key, [start,end])
        }
        if (starterIndex >= 0) { stint(0,0,halfSec); stint(1,0,starterIndex >= onPitch - subs.length ? subSec : halfSec) }
        else stint(1,subSec,halfSec)
      }
      const selectedNames = new Set(matchEventDefinitions.filter(d => d.legacyEventType).map(d => d.name))
      if (tactical && !playerMode) for (const preset of tacticalPresets) for (const name of preset.eventNames) { if (!byName.has(name)) throw new Error(`Missing tactical prerequisite: ${name}`); selectedNames.add(name) }
      if (tactical && !playerMode) for (const d of teamTacticalEventDefinitions) selectedNames.add(d.name)
      for (const name of selectedNames) {
        const d = byName.get(name)
        add('matchDayEventType', { id: id('selection',t,m,slug(name)), matchDayId: matchId, eventDefinitionId: definitionKey(name), eventType: d.legacyEventType ?? null, category: d.legacyEventType ? getMatchEventPrismaCategory(d.legacyEventType) : ['IN_POSSESSION', 'OUT_OF_POSSESSION', 'TRANSITION'].includes(d.matchPhase) ? d.matchPhase : 'ATTACKING' })
      }
      if (future) continue
      const events = []
      const event = (name, h, second, side = 'OUR_TEAM', sequenceId = null, forcePlayer = null) => {
        const d = byName.get(name)
        if (!d) throw new Error(`Missing definition: ${name}`)
        const eligible = players.filter(p => { const range = intervals.get(`${h}:${p.id}`); return range && second >= range[0] && second < range[1] })
        const detail = getTacticalDetailOptions(name)
        const playerId = !playerMode || side === 'OPPOSITION' || !d.legacyEventType ? null : forcePlayer ?? eligible[Math.floor(rand() * eligible.length)].id
        const row = { id: id('event',t,m,events.length), matchDayId: matchId, playerId, eventType: d.legacyEventType ?? null, eventDefinitionId: definitionKey(name), half: h ? 'SECOND_HALF' : 'FIRST_HALF', matchSecond: second, ownScoreAtTime: 0, oppositionScoreAtTime: 0, teamSide: side, detailCode: detail.length ? detail[Math.floor(rand() * detail.length)].code : null, tacticalSequenceId: sequenceId, x: d.requiresLocation ? Math.round(rand() * 100) : null, y: d.requiresLocation ? Math.round(rand() * 100) : null, createdAt: moment(h,second) }
        events.push(row); return row
      }
      for (const [side, total] of [['OUR_TEAM', ownScore], ['OPPOSITION', oppositionScore]]) for (let g = 0; g < total; g++) {
        const h = g % 2; const second = 120 + Math.floor(rand() * (halfSec - 240))
        if (playerMode && side === 'OPPOSITION') { scoreOnly.push({half:h ? 'SECOND_HALF' : 'FIRST_HALF',matchSecond:second,eventType:'GOAL',teamSide:side,scoreOnly:true}); continue }
        event('Shot on target',h,second - 1,side)
        const goal = event('Goal',h,second,side); goals.push(goal.id)
      }
      for (let e = 0; e < 90; e++) {
        const h = e % 2; const second = 10 + Math.floor(rand() * (halfSec - 20))
        const name = e % 5 === 0 ? 'Shot off target' : rand() < 0.55 + m / 100 ? 'Pass complete' : 'Pass incomplete'
        event(name,h,second)
      }
      if (tactical && !playerMode) {
        const pairs = [
          ['Build-up from goalkeeper controlled exit', 'Build-up from goalkeeper possession lost'],
          ['Press triggered regain', 'Press triggered opponent escapes'],
          ['Cutback reaches teammate', 'Cutback intercepted'],
          ['Defending corner or free kick first contact won', 'Defending corner or free kick first contact lost'],
        ].filter(pair => pair.every(name => byName.has(name)))
        for (const pair of pairs) for (let e = 0; e < 12; e++) event(pair[rand() < 0.35 + m / 40 ? 0 : 1], e % 2, 60 + e * 75, e % 4 === 0 ? 'OPPOSITION' : 'OUR_TEAM')
        // Representative observations across the catalogue, plus valid causal chains.
        for (const [i,d] of teamTacticalEventDefinitions.entries()) {
          if (/goal|shot|corner routine|first contact|following regain|following our loss/i.test(d.name)) continue
          event(d.name,i % 2, 100 + i * 15)
        }
        for (let q = 0; q < 6; q++) {
          const h = q % 2, second = 200 + q * 150, sequenceId = id('sequence',t,m,q)
          const corner = q >= 3
          add('tacticalSequence', { id: sequenceId, matchDayId: matchId, teamSide: 'OUR_TEAM', sequenceType: corner ? 'ATTACKING_SET_PIECE' : 'ATTACK_AFTER_REGAIN', startHalf: h ? 'SECOND_HALF' : 'FIRST_HALF', startMatchSecond: second, endHalf: h ? 'SECOND_HALF' : 'FIRST_HALF', endMatchSecond: second + 12, timeWindowSeconds: 15 })
          event(corner ? 'Attacking corner routine' : 'Ball recovery',h,second,'OUR_TEAM',sequenceId)
          if (q % 3 !== 2) { event(corner ? 'Attacking set-piece shot' : 'Attack following regain shot',h,second+10,'OUR_TEAM',sequenceId); event('Shot off target',h,second+10) }
          else if (!corner) event('Attack following regain possession lost',h,second+10,'OUR_TEAM',sequenceId)
        }
      }
      if (t === 1 && m >= 19) {
        const status = ['PENDING','ACCEPTED','IGNORED'][m-19]
        const official = event('Pass complete',0,30,'OUR_TEAM',null,players[1].id)
        const { id: eventId, ...shared } = official
        const submission = add('submittedMatchEvent', { ...shared, id: id('submission',m), submittedByUserId: id('parent'), status, note: 'Fictional parent observation: composed pass to a teammate.', ...(status === 'ACCEPTED' ? { acceptedAt: moment(0,40), acceptedByUserId: OWNER_ID } : {}) })
        if (status === 'ACCEPTED') official.submittedMatchEventId = submission.id
        else events.splice(events.findIndex(e => e.id === eventId),1)
      }
      const timeline = [...events,...scoreOnly].sort((a,b) => a.half.localeCompare(b.half) || a.matchSecond - b.matchSecond)
      let own = 0, opposition = 0
      for (const e of timeline) { e.ownScoreAtTime = own; e.oppositionScoreAtTime = opposition; if (e.eventType === 'GOAL') { if (e.teamSide === 'OUR_TEAM') own++; else opposition++ } if(!e.scoreOnly) add('matchEvent',e) }
      for (const submission of rows.submittedMatchEvent ?? []) if (submission.matchDayId === matchId) { submission.ownScoreAtTime = events.filter(e => e.eventType === 'GOAL' && e.teamSide === 'OUR_TEAM' && e.half === 'FIRST_HALF' && e.matchSecond < 30).length; submission.oppositionScoreAtTime = 0 }
    }
    for (let s = 0; s < 7; s++) {
      const future = s === 6
      const date = at(future ? 10 : -165 + s * 32)
      const sessionId = id('fitness',t,s)
      add('fitnessTestSession', { id: sessionId, teamId, fitnessTestTypeId: fitnessKey, date, status: future ? 'DRAFT' : 'COMPLETED', notes: 'DEMO: repeat assessment under consistent conditions. Focus on individual progress.', ...(!future ? { startedAt: date, completedAt: new Date(+date + 3600000) } : {}) })
      if (future) continue
      for (const [p,player] of players.entries()) {
        if (+player.joinedClubDate > +date) continue
        const absent = (p > 3 && (s+p+t)%7 === 0) || (p === 3 && (s === 2 || s === 3))
        const base = [1040,800,400][t] + (p % 6)*80
        const value = Math.round((base + (p === 2 ? s*160 : s*40) + (rand()-0.5)*80)/40)*40
        add('fitnessTestResult', { id:id('result',t,s,p), fitnessTestSessionId:sessionId, playerId:player.id, status: absent ? 'ABSENT' : 'COMPLETED', resultValue: absent ? null : value, notes: absent ? 'Not available for this assessment.' : p === 2 ? 'More consistent pacing and turning.' : p === 1 ? 'Reliable effort throughout.' : null })
      }
    }
  }
  return { seed: String(seed), asOf, tactical, marker, rows, definitions, fitnessDefinition: fitnessTestTypes.find(d => d.name === 'Yo-Yo Test'), goals }
}
export const counts = plan => Object.fromEntries(Object.entries(plan.rows).map(([name, rows]) => [name,rows.length]))
export async function assertNoForeignReferences(db) {
  // Inspect actual Prisma relations, including SetNull and Restrict edges, before cascades.
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = model.name[0].toLowerCase() + model.name.slice(1)
    for (const relation of model.fields.filter(f => f.kind === 'object' && f.relationFromFields?.length)) {
      const fields = relation.relationFromFields.filter(f => model.fields.find(x => x.name === f)?.type === 'String')
      if (!fields.length) continue
      if (await db[delegate].count({ where: { NOT: { id: { startsWith: PREFIX } }, OR: fields.map(field => ({ [field]: { startsWith: PREFIX } })) } })) throw new Error(`Reset refused: non-demo ${model.name} references demo data.`)
    }
  }
}
export async function applyPlan(db, plan, { dryRun = false, reset = false } = {}) {
  return db.$transaction(async tx => {
    // A transaction-scoped lock serializes this generator and reset, even across processes.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(76391426)::text`
    const existing = await tx.club.findUnique({ where: { id: CLUB_ID } })
    const owner = await tx.user.findUnique({ where: { email: EMAIL } })
    if (owner && owner.id !== OWNER_ID) throw new Error('Local fallback account already exists outside this generator. Use a fresh dedicated demo database.')
    if (existing && (existing.userId !== OWNER_ID || existing.notes !== plan.marker)) throw new Error('Dataset options differ, or ownership marker changed. Reset with the original seed/date/feature flags first.')
    if (reset) {
      if (!existing) return { action:'absent', counts:{} }
      await assertNoForeignReferences(tx)
      if (!dryRun) {
        await tx.club.delete({ where: { id: CLUB_ID } })
        await tx.user.deleteMany({ where: { id: { in: [OWNER_ID,id('parent')] } } })
      }
      return { action: dryRun ? 'would-reset' : 'reset', counts: counts(plan) }
    }
    if (existing) {
      for (const [model, expected] of Object.entries(counts(plan))) {
        if (await tx[model].count({where:{id:{startsWith:PREFIX}}}) !== expected) throw new Error(`Demo ${model} count has changed; reset explicitly rather than silently repairing user edits.`)
      }
      return { action:'already-exists', counts: counts(plan) }
    }
    if (dryRun) return { action:'would-create', counts: counts(plan) }
    const replacements = new Map()
    for (const definition of plan.definitions) {
      const found = await tx.eventDefinition.findFirst({ where: { scope:'GLOBAL', clubId:null, normalizedName:normalized(definition.name) } })
      if (found && (!found.isActive || found.archivedAt)) throw new Error(`Required definition is inactive: ${definition.name}`)
      const data = Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'stableId'))
      const saved = found ?? await tx.eventDefinition.create({ data: { ...data, id:`cyc_catalogue_${slug(data.name)}`, scope:'GLOBAL', slug:slug(data.name), normalizedName:normalized(data.name), enabledByDefault: data.enabledByDefault ?? true, benchmarkable:data.benchmarkable ?? true, requiresLocation:data.requiresLocation ?? false, isActive:data.isActive ?? true, archivedAt:data.archivedAt ?? null } })
      replacements.set(`catalogue_${slug(data.name)}`,saved.id)
    }
    const fitness = await tx.fitnessTestType.findFirst({ where:{ userId:null, name:'Yo-Yo Test', isDefault:true } }) ?? await tx.fitnessTestType.create({ data:{ ...plan.fitnessDefinition, id:'cyc_catalogue_yoyo' } })
    replacements.set('fitness_yoyo', fitness.id)
    for (const model of ['user','club','clubMembership','team','player','spectatorAccess','matchDay','matchDayPlayer','matchPlayerStint','matchDayEventType','tacticalSequence','submittedMatchEvent','matchEvent','fitnessTestSession','fitnessTestResult']) {
      const data = (plan.rows[model] ?? []).map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k, typeof v === 'string' && (k.endsWith('Id')) ? replacements.get(v) ?? v : v])))
      for (let start = 0; start < data.length; start += 200) await tx[model].createMany({ data:data.slice(start,start+200) })
    }
    return { action:'created', counts:counts(plan) }
  }, { timeout:180000, maxWait:10000, isolationLevel:'Serializable' })
}
async function main() {
  const { values } = parseArgs({ options: { seed:{type:'string',default:'2026'}, 'as-of':{type:'string'}, 'dry-run':{type:'boolean'}, reset:{type:'boolean'} } })
  const target = assertLocalTarget(process.env.DATABASE_URL)
  const plan = makePlan({ seed:values.seed, asOf:values['as-of'], tactical: process.env.MATCH_DAY_CUSTOM_OBSERVATIONS === 'true' })
  const db = new PrismaClient()
  try {
    const identity = await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, inet_server_addr()::text AS address, version() AS version`
    const actual = identity[0]
    const embedded = actual.version.includes('PGlite') && actual.database === 'postgres' && actual.address === null
    if (!embedded && actual.database !== new URL(process.env.DATABASE_URL).pathname.slice(1)) throw new Error('Actual database name differs from the requested demo target.')
    if (identity[0].schema !== 'public' || (identity[0].address && !isLoopbackAddress(identity[0].address))) throw new Error('Server identity is not local/public.')
    console.log(JSON.stringify({ target, identity, options:{ seed:plan.seed, asOf:plan.asOf, tactical:plan.tactical }, ...await applyPlan(db,plan,{ dryRun:values['dry-run'], reset:values.reset }) },null,2))
  } finally { await db.$disconnect() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode=1 })
