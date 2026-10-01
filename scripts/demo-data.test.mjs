import test from 'node:test'
import assert from 'node:assert/strict'
import { assertLocalTarget, makePlan } from './demo-data.mjs'

test('refuses production, remote hosts, alternate sockets and unsafe database names', () => {
  for (const url of ['postgresql://host/cyc_demo','postgresql://127.0.0.1/production','postgresql://127.0.0.1/cyc_demo?host=remote','postgresql://127.0.0.1/cyc_demo?schema=live']) assert.throws(() => assertLocalTarget(url,{}))
  assert.throws(() => assertLocalTarget('postgresql://127.0.0.1/cyc_demo',{NODE_ENV:'production'}))
  assert.equal(assertLocalTarget('postgresql://127.0.0.1/cyc_demo',{}),'127.0.0.1:5432/cyc_demo')
})
test('reproducible dates, seed variation and disabled tactical feature', () => {
  const options = {seed:'42',asOf:'2026-10-01',tactical:true}
  assert.deepEqual(makePlan(options),makePlan(options))
  assert.notDeepEqual(makePlan(options).rows.matchEvent,makePlan({...options,seed:'43'}).rows.matchEvent)
  const classic = makePlan({...options,tactical:false})
  assert.equal(classic.rows.tacticalSequence,undefined)
  assert.ok(classic.rows.matchEvent.every(e=>e.eventType))
  assert.throws(()=>makePlan({asOf:'2026-02-30'}))
})
test('scores, timing, squad eligibility, pitch occupancy and fitness consistency', () => {
  const {rows} = makePlan({asOf:'2026-10-01',tactical:true})
  for (const m of rows.matchDay) {
    const events = rows.matchEvent.filter(e=>e.matchDayId===m.id)
    assert.equal(events.filter(e=>e.eventType==='GOAL'&&e.teamSide==='OUR_TEAM').length,m.ownScore)
    if(m.eventTrackingScope==='TEAM') assert.equal(events.filter(e=>e.eventType==='GOAL'&&e.teamSide==='OPPOSITION').length,m.oppositionScore)
    if(m.status==='DRAFT') { assert.equal(events.length,0); continue }
    const halfSec=(m.firstHalfEndedAt-m.firstHalfStartedAt)/1000
    const stints=rows.matchPlayerStint.filter(s=>s.matchDayId===m.id)
    const pitch = m.teamId.endsWith('_2') ? 9:11
    assert.equal(stints.reduce((sum,s)=>sum+s.endMatchSecond-s.startMatchSecond,0),halfSec*2*pitch)
    for (const half of ['FIRST_HALF','SECOND_HALF']) for(const second of [0,Math.floor(halfSec*0.55)-1,Math.floor(halfSec*0.55),halfSec-1]) assert.equal(stints.filter(s=>s.half===half&&s.startMatchSecond<=second&&s.endMatchSecond>second).length,pitch)
    for(const e of events) {
      assert.ok(e.matchSecond>=0&&e.matchSecond<halfSec)
      assert.ok(e.ownScoreAtTime<=m.ownScore&&e.oppositionScoreAtTime<=m.oppositionScore)
      if(m.eventTrackingScope==='TEAM') assert.equal(e.playerId,null)
      if(m.eventTrackingScope==='PLAYER') assert.ok(e.playerId)
      if(e.playerId) assert.ok(stints.some(s=>s.playerId===e.playerId&&s.half===e.half&&s.startMatchSecond<=e.matchSecond&&s.endMatchSecond>e.matchSecond))
      if(e.teamSide==='OPPOSITION') assert.equal(e.playerId,null)
      if(e.tacticalSequenceId) { const seq=rows.tacticalSequence.find(s=>s.id===e.tacticalSequenceId); assert.equal(seq.matchDayId,e.matchDayId); assert.equal(seq.startHalf,e.half); assert.ok(e.matchSecond>=seq.startMatchSecond&&e.matchSecond<=seq.endMatchSecond) }
    }
  }
  for(const result of rows.fitnessTestResult) {
    const player=rows.player.find(p=>p.id===result.playerId),session=rows.fitnessTestSession.find(s=>s.id===result.fitnessTestSessionId)
    assert.equal(player.teamId,session.teamId)
    assert.ok(player.joinedClubDate<=session.date)
    assert.equal(result.resultValue===null,result.status==='ABSENT')
  }
})
