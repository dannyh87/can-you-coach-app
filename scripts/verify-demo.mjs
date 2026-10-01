import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma.ts'
import { getDashboardData } from '../src/lib/dashboard.ts'
import { getAccessibleTeamIds, accessibleMatchWhere, accessiblePlayerWhere } from '../src/lib/accessWhere.ts'
import { buildTacticalObservationReport } from '../src/lib/teamTacticalObservations.ts'
import { buildTeamTrendOptions, buildTeamTrendSeries } from '../src/lib/teamTrackingTrends.ts'
import { assertLocalTarget, makePlan, applyPlan, counts, PREFIX, CLUB_ID, OWNER_ID } from './demo-data.mjs'

async function main() {
  assertLocalTarget(process.env.DATABASE_URL)
  const club = await prisma.club.findUniqueOrThrow({where:{id:CLUB_ID}})
  const options = JSON.parse(club.notes)
  const plan = makePlan(options)
  for(const [model,count] of Object.entries(counts(plan))) assert.equal(await prisma[model].count({where:{id:{startsWith:PREFIX}}}),count,model)
  const ownerTeams = await getAccessibleTeamIds(OWNER_ID)
  assert.equal(ownerTeams.length,3)
  const dashboard = await getDashboardData(OWNER_ID)
  assert.equal(dashboard.kind,'coach')
  assert.equal(dashboard.snapshot.playersTracked,60)
  assert.equal(dashboard.snapshot.pendingParentSubmissions,1)
  const parent = await getDashboardData(`${PREFIX}parent`)
  assert.equal(parent.kind,'parent')
  assert.equal(parent.linkedPlayerCount,1)
  assert.equal((await getDashboardData('unknown-demo-user')).kind,'no_access')
  assert.equal(await prisma.player.count({where:await accessiblePlayerWhere(`${PREFIX}parent`)}),1)
  const matches = await prisma.matchDay.findMany({where:{AND:[await accessibleMatchWhere(OWNER_ID),{status:'COMPLETED'}]},include:{matchDayEventTypes:{include:{eventDefinition:true}},matchEvents:{include:{eventDefinition:true,standardEventDefinitionAtRecording:true,clubTrackingDefinition:true,tacticalSequence:true}},patternObservations:{include:{pattern:true,outcome:true,trackingTask:true,clubTrackingDefinition:true,standardPatternDefinitionAtRecording:true}}},orderBy:{kickoffAt:'asc'}})
  assert.equal(matches.length,66)
  assert.equal(await prisma.matchDay.count({where:await accessibleMatchWhere('unknown-demo-user')}),0)
  const senior=matches.filter(m=>m.teamId===`${PREFIX}team_0`)
  assert.ok(senior.slice(0,6).reduce((s,m)=>s+m.oppositionScore,0)>senior.slice(-6).reduce((s,m)=>s+m.oppositionScore,0))
  const optionsForTrends=buildTeamTrendOptions(senior)
  assert.ok(optionsForTrends.length>0)
  const trend=buildTeamTrendSeries(senior,optionsForTrends[0].identity)
  assert.ok(trend.total>0)
  const dateFiltered=await prisma.matchDay.findMany({where:{AND:[await accessibleMatchWhere(OWNER_ID),{teamId:senior[0].teamId,kickoffAt:{gte:senior[16].kickoffAt},status:'COMPLETED'}]}})
  assert.equal(dateFiltered.length,6)
  const playerFiltered=await prisma.matchEvent.count({where:{matchDay:{AND:[await accessibleMatchWhere(OWNER_ID),{teamId:senior[0].teamId}]},playerId:`${PREFIX}player_0_1`}})
  assert.ok(playerFiltered>0)
  const tactical=buildTacticalObservationReport({events:senior.flatMap(m=>m.matchEvents),selections:senior.flatMap(m=>m.matchDayEventTypes)})
  if(plan.tactical) { assert.ok(tactical.causalMeasures.length>=2); for(const metric of tactical.metrics) if(metric.attempts!==null) assert.ok((metric.successes??0)<=metric.attempts) }
  const fitness=await prisma.fitnessTestResult.findMany({where:{playerId:`${PREFIX}player_0_2`,status:'COMPLETED'},include:{fitnessTestSession:true},orderBy:{fitnessTestSession:{date:'asc'}}})
  assert.ok(fitness.at(-1).resultValue>fitness[0].resultValue)
  console.log(JSON.stringify({verified:'database counts, actual dashboard/access queries, team/date/player filters, trend and tactical report functions',counts:counts(plan),dashboard:dashboard.snapshot,trend:{name:trend.displayName,total:trend.total},tactical: tactical.causalMeasures,fitness:{player:'Charlie Meadows',first:fitness[0].resultValue,last:fitness.at(-1).resultValue}},null,2))
  if(process.env.DEMO_RESET_TEST==='true') {
    // Explicit destructive integration mode, confined to a dedicated test target.
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
    const outsider=await prisma.user.create({data:{id:'demo-verification-outsider',email:'outsider@example.com'}})
    const otherClub=await prisma.club.create({data:{id:'demo-verification-other-club',userId:outsider.id,name:'Reset preservation sentinel'}})
    const before=JSON.stringify(await prisma.club.findUnique({where:{id:otherClub.id}}))
    assert.equal((await applyPlan(prisma,plan)).action,'already-exists')
    const reference=await prisma.clubMembership.create({data:{userId:outsider.id,clubId:CLUB_ID,role:'VIEWER'}})
    await assert.rejects(applyPlan(prisma,plan,{reset:true}),/non-demo ClubMembership/)
    await prisma.clubMembership.delete({where:{id:reference.id}})
    assert.equal((await applyPlan(prisma,plan,{reset:true,dryRun:true})).action,'would-reset')
    assert.equal(await prisma.club.count({where:{id:CLUB_ID}}),1)
    await applyPlan(prisma,plan,{reset:true})
    for(const model of Object.keys(counts(plan))) assert.equal(await prisma[model].count({where:{id:{startsWith:PREFIX}}}),0)
    assert.equal(JSON.stringify(await prisma.club.findUnique({where:{id:otherClub.id}})),before)
    const invalid = structuredClone(plan)
    invalid.rows.fitnessTestResult[0].playerId = 'nonexistent-player'
    await assert.rejects(applyPlan(prisma,invalid))
    assert.equal(await prisma.club.count({where:{id:CLUB_ID}}),0)
    await applyPlan(prisma,plan)
    await prisma.user.delete({where:{id:outsider.id}})
    console.log('PASS: idempotency, foreign-reference reset refusal, dry-run reset, demo-only reset, unrelated club preservation, failed-seed rollback, reseed.')
  }
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect())
