import { PrismaClient } from '@prisma/client'
import { teamTacticalEventDefinitions } from '../src/lib/teamTacticalCatalogue.mjs'

const prisma = new PrismaClient()

const localUser = {
  email: 'local-coach@can-you-coach.local',
  passwordHash: 'local-mvp-user',
}

const demoClub = {
  name: 'Demo Club',
  location: 'Local development',
  notes: 'Seeded demo club for local MVP development.',
}

const demoTeam = {
  name: 'Brereton Social',
  ageGroup: 'Open Age',
  season: '2026',
  league: 'Demo League',
  footballPyramidStep: 'Grassroots',
}

const demoPlayers = [
  {
    firstName: 'Alex',
    surname: 'Taylor',
    squadNumber: 1,
    preferredPosition: 'Goalkeeper',
  },
  {
    firstName: 'Sam',
    surname: 'Jones',
    squadNumber: 4,
    preferredPosition: 'Centre Back',
  },
  {
    firstName: 'Charlie',
    surname: 'Morgan',
    squadNumber: 8,
    preferredPosition: 'Central Midfielder',
  },
  {
    firstName: 'Riley',
    surname: 'Smith',
    squadNumber: 10,
    preferredPosition: 'Striker',
  },
]

const targetScoreCaveat = 'Use these as broad coaching benchmarks only. Scores vary by age, sex, position, training age, injury history and level of football. For grassroots players, the most useful comparison is often the player\'s own progress over time.'

const fitnessTestTypes = [
  {
    name: 'Yo-Yo Test',
    description: 'Intermittent fitness test used to assess endurance and recovery ability.',
    spaceRequired: '20m running zone plus a 5m recovery zone behind the start line. Use a flat, safe surface with enough width for the number of runners.',
    equipmentNeeded: 'Cones, tape measure, speaker, Yo-Yo IR1 audio, phone or tablet, and the Can You Coach live dropout screen.',
    setupInstructions: `Mark a start cone and a turn cone 20m apart. Mark a recovery cone 5m behind the start line. Players start on the start line, run 20m out, turn, run 20m back, then walk or jog around the 5m recovery marker during the recovery period before the next shuttle. Keep the speaker loud enough for all players to hear the audio clearly.`,
    scoringNotes: 'Record the final completed level, shuttle or total distance according to the scoring method you use. Players stop when they miss the line twice, cannot keep the pace safely, or choose to drop out. Use the same audio, surface and setup each time.',
    coachNotes: 'This is a repeat-effort test, not a punishment. Explain the route before starting and remind players to turn safely. It works best when coaches focus on effort, pacing and improvement over time.',
    videoUrl: null,
    targetScores: `${targetScoreCaveat}\n\nDeveloping: lower completion distance; use it as a starting baseline.\nGood grassroots level: completes a solid repeated-running score and recovers well between shuttles.\nStrong: high score for local football and likely good repeat-effort capacity.\nExcellent: very high score and ready for demanding match-conditioning work.\nElite / academy-level: only use this comparison for older, well-trained players in a suitable performance environment.`,
    resultUnit: 'Metres',
    higherIsBetter: true,
    allowedRecordingModes: 'MANUAL,LIVE_DROPOUT',
    preferredRecordingMode: 'LIVE_DROPOUT',
    isDefault: true,
  },
  {
    name: 'Gacon Test',
    description: 'Progressive 45/15 running test used to assess aerobic fitness.',
    spaceRequired: 'Marked pitch, track or straight running area with cones set from 125m and increasing by 6.25m each level.',
    equipmentNeeded: 'Cones, tape measure, phone or tablet, and the Can You Coach live Gacon dropout screen.',
    setupInstructions: 'Set Level 1 at 125m. Each level uses 45 seconds of running followed by 15 seconds of recovery. Increase the target distance by 6.25m each level. Players recover and move to the next marker during the 15-second rest.',
    scoringNotes: 'Record the level shown when the player drops out. The seeded default Gacon protocol starts at Level 1 / 125m and increases by 6.25m per level on each new 45-second work phase.',
    coachNotes: 'Keep the protocol, surface, weather conditions and dropout rules consistent so future results can be compared fairly. Custom Gacon-style tests can still be created separately if your club uses a different protocol.',
    videoUrl: null,
    targetScores: `${targetScoreCaveat}\n\nDeveloping: early-stage completion; useful as a baseline.\nGood grassroots level: completes a solid number of intervals with controlled pacing.\nStrong: reaches a high stage or distance for local football.\nExcellent: very high stage or distance using the same protocol.\nAvoid elite comparisons unless the exact protocol and benchmark source are known.`,
    resultUnit: 'Metres',
    higherIsBetter: true,
    allowedRecordingModes: 'MANUAL,LIVE_DROPOUT',
    preferredRecordingMode: 'LIVE_DROPOUT',
    isDefault: true,
  },
  {
    name: 'Bleep Test',
    description: 'Multi-stage shuttle run test.',
    spaceRequired: '20m between two clear lines or rows of cones on a flat, safe surface. Leave enough width for every runner to turn safely.',
    equipmentNeeded: 'Cones, tape measure, speaker, bleep test audio, phone or tablet, and the Can You Coach live dropout screen.',
    setupInstructions: 'Mark two lines 20m apart. Players run continuously between the lines and must reach the line before each beep. Start the audio only when everyone understands the route and the turn line.',
    scoringNotes: 'Record the final completed level and shuttle, or the numeric level used by your squad. Players stop when they can no longer keep up safely or miss the line repeatedly. Use the same audio and surface where possible.',
    coachNotes: 'This is easy to run with groups, but turns can get crowded. Split large squads into lanes or smaller groups and encourage players to pace the early levels sensibly.',
    videoUrl: null,
    targetScores: `${targetScoreCaveat}\n\nDeveloping: earlier levels; useful starting point, especially for younger or newer players.\nGood grassroots level: solid middle-to-high level for the age group.\nStrong: higher level showing good aerobic fitness for local football.\nExcellent: very high level and likely above normal grassroots expectations.\nElite / academy-level: only compare older, trained players against academy-style standards.`,
    resultUnit: 'Level',
    higherIsBetter: true,
    allowedRecordingModes: 'MANUAL,LIVE_DROPOUT',
    preferredRecordingMode: 'LIVE_DROPOUT',
    isDefault: true,
  },
  {
    name: 'Bronco Test',
    description: 'Repeated shuttle run completed as quickly as possible.',
    spaceRequired: 'Straight 60m running lane with markers at 0m, 20m, 40m and 60m. Use a flat, safe surface with run-off space.',
    equipmentNeeded: 'Cones, tape measure, stopwatch or timer, phone or tablet, and the Can You Coach live timed finish screen.',
    setupInstructions: 'Mark 0m, 20m, 40m and 60m. From the start line, players run to 20m and back, 40m and back, then 60m and back. That is one set. Repeat for your chosen format, commonly five sets for a 1,200m total.',
    scoringNotes: 'Record total completion time. Lower time is better. Keep the number of sets, surface, weather conditions and timing method as consistent as possible.',
    coachNotes: 'This test rewards pacing as well as fitness. Make sure players know the route before starting and avoid running too many players in one lane.',
    videoUrl: null,
    targetScores: `${targetScoreCaveat}\n\nDeveloping: slower completion time; use it as a baseline.\nGood grassroots level: completes the test strongly with controlled pacing.\nStrong: competitive time for local football conditioning.\nExcellent: very fast time and suitable for demanding higher-level conditioning.\nElite / academy-level: only compare with care, because timing method and exact Bronco format can change results.`,
    resultUnit: 'Seconds',
    higherIsBetter: false,
    allowedRecordingModes: 'MANUAL,LIVE_TIMED_FINISH',
    preferredRecordingMode: 'LIVE_TIMED_FINISH',
    isDefault: true,
  },
]

const eventDefinitionSynonyms = {
  completed: 'complete',
  successful: 'complete',
  failed: 'incomplete',
  unsuccessful: 'incomplete',
  accurate: 'target',
  dribble: '1v1',
  dribbling: '1v1',
}

const normalizeEventDefinitionName = (name) =>
  name
    .toLowerCase()
    .replace(/one\s+v\s+one/g, '1v1')
    .replace(/1\s*v\s*1/g, '1v1')
    .replace(/on\s+target/g, 'target')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => eventDefinitionSynonyms[token] ?? token)
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
    .sort()
    .join(' ')

const createEventDefinitionSlug = (name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'event'
}

const normalizeTrackingSearch = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

const matchEventDefinitions = [
  {
    legacyEventType: 'GOAL',
    name: 'Goal',
    description: 'A goal scored by the player or team.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    matchDayGroup: 'GOALS_OUTCOMES',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD'],
  },
  {
    legacyEventType: 'ASSIST',
    name: 'Assist',
    description: 'What counts? The final teammate action that directly leads to a goal. Do not count fantasy assists or second assists here.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    matchDayGroup: 'GOALS_OUTCOMES',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'],
  },
  {
    legacyEventType: 'SHOT_ON_TARGET',
    name: 'Shot on target',
    description: 'What counts? A deliberate attempt to score that is on target, including goals and shots saved by the goalkeeper.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    matchDayGroup: 'SHOOTING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
  },
  {
    legacyEventType: 'SHOT_OFF_TARGET',
    name: 'Shot off target',
    description: 'What counts? A deliberate attempt to score that misses the target. Do not count blocked shots here.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    matchDayGroup: 'SHOOTING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
  },
  {
    legacyEventType: 'PASS_COMPLETE',
    name: 'Pass complete',
    description: 'What counts? An attempted pass that reaches a teammate directly without an opposition touch. Crosses, keeper throws and throw-ins are tracked separately.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    matchDayGroup: 'PASSING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
  },
  {
    legacyEventType: 'PASS_INCOMPLETE',
    name: 'Pass incomplete',
    description: 'What counts? An attempted pass that does not reach a teammate directly. Crosses, keeper throws and throw-ins are tracked separately.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
  },
  {
    legacyEventType: 'ONE_V_ONE_SUCCESS',
    name: 'Dribble successful',
    description: 'What counts? A player attempts to beat an opponent while in possession and keeps control after passing them.',
    matchPhase: 'IN_POSSESSION',
    category: 'DRIBBLING_1V1',
    matchDayGroup: 'POSSESSION',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'WIDE_PLAYER'],
  },
  {
    legacyEventType: 'ONE_V_ONE_UNSUCCESSFUL',
    name: 'Dribble unsuccessful',
    description: 'What counts? A player attempts to beat an opponent while in possession but is tackled, overruns the ball or loses control.',
    matchPhase: 'IN_POSSESSION',
    category: 'DRIBBLING_1V1',
    matchDayGroup: 'POSSESSION',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'WIDE_PLAYER'],
  },
  {
    legacyEventType: 'TOUCH',
    name: 'Touch',
    description: 'A recorded player touch on the pitch.',
    matchPhase: 'IN_POSSESSION',
    category: 'RECEIVING',
    matchDayGroup: 'POSSESSION',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: true,
    enabledByDefault: false,
  },
  {
    name: 'Possession gained',
    description: 'Historical broad regain label. Use Ball recovery for comparable future reporting.',
    matchPhase: 'TRANSITION',
    category: 'DEFENDING',
    subcategory: 'Regains',
    matchDayGroup: 'DEFENDING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL'],
    requiresLocation: true,
    enabledByDefault: false,
    isActive: false,
    archivedAt: new Date('2026-09-08T00:00:00.000Z'),
  },
  {
    name: 'Possession lost',
    description: 'A turnover where the team loses possession.',
    matchPhase: 'TRANSITION',
    category: 'PASSING',
    subcategory: 'Turnovers',
    matchDayGroup: 'POSSESSION',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL'],
    requiresLocation: true,
    enabledByDefault: false,
  },
  {
    name: 'Shot position',
    description: 'The pitch location a shot is taken from.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    matchDayGroup: 'SHOOTING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
    requiresLocation: true,
    enabledByDefault: false,
  },
  {
    name: 'Cross position',
    description: 'The pitch location a cross is delivered from.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'WIDE_PLAYER', 'FORWARD'],
    requiresLocation: true,
    enabledByDefault: false,
  },
  {
    name: 'Carry',
    description: 'A player travels with the ball under control to progress play or beat pressure.',
    matchPhase: 'IN_POSSESSION',
    category: 'DRIBBLING_1V1',
    subcategory: 'Carrying',
    matchDayGroup: 'POSSESSION',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Forward pass',
    description: 'Historical broad forward-pass label. Use Forward pass completed or Forward pass incomplete for comparable future reporting.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Progression',
    matchDayGroup: 'PASSING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
    isActive: false,
    archivedAt: new Date('2026-09-08T00:00:00.000Z'),
  },
  {
    name: 'Forward pass completed',
    description: 'What counts? A pass whose destination is meaningfully closer to the opponent goal than its start point and reaches a teammate directly.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Progression',
    matchDayGroup: 'PASSING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Forward pass incomplete',
    description: 'What counts? A pass whose intended destination is meaningfully closer to the opponent goal than its start point but does not reach a teammate directly.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Progression',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Pass into final third completed',
    description: 'What counts? A pass starting outside the attacking third and entering it, completed directly to a teammate. Do not count passes already within the final third.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Progression',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Pass into final third incomplete',
    description: 'What counts? A pass starting outside the attacking third and intended to enter it, but not completed directly to a teammate.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Progression',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Interception',
    description: 'What counts? A player anticipates an opponent pass and moves into its path to cut it out. Do not count a loose-ball recovery as an interception.',
    matchPhase: 'OUT_OF_POSSESSION',
    category: 'DEFENDING',
    subcategory: 'Regains',
    matchDayGroup: 'DEFENDING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Tackle won',
    description: 'What counts? A legal ground challenge on an opponent in controlled possession where the tackler or a teammate regains possession, or the ball goes safely out of play.',
    matchPhase: 'OUT_OF_POSSESSION',
    category: 'DEFENDING',
    subcategory: 'Duels',
    matchDayGroup: 'DEFENDING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Key pass',
    description: 'What counts? The final pass to a teammate who then takes a non-scoring shot.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Chance creation',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Cross',
    description: 'Historical broad cross label. Use Cross completed or Cross incomplete for comparable future reporting.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Wide play',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'WIDE_PLAYER', 'FORWARD'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
    isActive: false,
    archivedAt: new Date('2026-09-08T00:00:00.000Z'),
  },
  {
    name: 'Cross completed',
    description: 'What counts? A wide delivery targeting a teammate in a central goal-scoring area that reaches a teammate.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Wide play',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'WIDE_PLAYER', 'FORWARD'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Cross incomplete',
    description: 'What counts? A wide delivery targeting a teammate in a central goal-scoring area that does not reach a teammate.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Wide play',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'WIDE_PLAYER', 'FORWARD'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Cutback',
    description: 'A pass pulled back from the byline or wide channel into a dangerous central area.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    subcategory: 'Chance creation',
    matchDayGroup: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL', 'WIDE_PLAYER', 'FORWARD', 'MIDFIELDER'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Shot blocked',
    description: 'What counts? Defensive action by an outfield player that blocks an opponent shot before it reaches goal. Do not use this for the attacker whose shot was blocked.',
    matchPhase: 'OUT_OF_POSSESSION',
    category: 'DEFENDING',
    subcategory: 'Defensive actions',
    matchDayGroup: 'DEFENDING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'DEFENDER', 'GOALKEEPER'],
    requiresLocation: false,
    enabledByDefault: false,
    benchmarkable: true,
  },
  {
    name: 'Ball recovery',
    description: 'What counts? A player establishes controlled possession after a turnover or loose ball. Do not count this as an interception unless they moved into an opponent pass.',
    matchPhase: 'TRANSITION', category: 'DEFENDING', subcategory: 'Regains', matchDayGroup: 'DEFENDING', agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'], fourCorner: 'TACTICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true,
  },
  { name: 'Clearance', description: 'What counts? Defensive action to move the ball away from danger with no immediate teammate target.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Defensive actions', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL', 'DEFENDER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Headed clearance', description: 'What counts? A clearance made with the head to move the ball away from danger.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Defensive actions', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL', 'DEFENDER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Tackle lost', description: 'What counts? A legal ground challenge on an opponent in controlled possession where the opponent team keeps or regains the ball.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Duels', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Ground duel won', description: 'What counts? A ground contest with an opponent where the player wins the ball or outcome.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Duels', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Ground duel lost', description: 'What counts? A ground contest with an opponent where the opponent wins the ball or outcome.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Duels', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Aerial duel won', description: 'What counts? An aerial contest with an opponent where the player wins the ball or outcome.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Duels', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Aerial duel lost', description: 'What counts? An aerial contest with an opponent where the opponent wins the ball or outcome.', matchPhase: 'OUT_OF_POSSESSION', category: 'DEFENDING', subcategory: 'Duels', matchDayGroup: 'DEFENDING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Long pass completed', description: 'What counts? A deliberate longer pass that reaches a teammate directly.', matchPhase: 'IN_POSSESSION', category: 'PASSING', subcategory: 'Progression', matchDayGroup: 'PASSING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Long pass incomplete', description: 'What counts? A deliberate longer pass that does not reach a teammate directly.', matchPhase: 'IN_POSSESSION', category: 'PASSING', subcategory: 'Progression', matchDayGroup: 'PASSING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Pass into penalty area completed', description: 'What counts? A pass into the opponent penalty area that reaches a teammate directly.', matchPhase: 'IN_POSSESSION', category: 'PASSING', subcategory: 'Chance creation', matchDayGroup: 'PASSING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TACTICAL', positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Pass into penalty area incomplete', description: 'What counts? A pass intended to enter the opponent penalty area that does not reach a teammate directly.', matchPhase: 'IN_POSSESSION', category: 'PASSING', subcategory: 'Chance creation', matchDayGroup: 'PASSING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TACTICAL', positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Through ball', description: 'What counts? A pass splitting the defence for a teammate to run onto.', matchPhase: 'IN_POSSESSION', category: 'PASSING', subcategory: 'Chance creation', matchDayGroup: 'PASSING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TACTICAL', positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Shot', description: 'What counts? A deliberate attempt to score when you do not need to classify on/off target. Prefer Shot on target and Shot off target when tracking accuracy.', matchPhase: 'IN_POSSESSION', category: 'SHOOTING', subcategory: null, matchDayGroup: 'SHOOTING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Foul committed', description: 'What counts? An infringement penalised against the player/team with a free kick or penalty.', matchPhase: 'DISCIPLINE_MATCH_ADMIN', category: 'DISCIPLINE', subcategory: 'Fouls', matchDayGroup: 'DISCIPLINE', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'PSYCHOLOGICAL_SOCIAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Foul won', description: 'What counts? A player wins a free kick or penalty for their team after being fouled by an opponent.', matchPhase: 'DISCIPLINE_MATCH_ADMIN', category: 'DISCIPLINE', subcategory: 'Fouls', matchDayGroup: 'DISCIPLINE', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'PSYCHOLOGICAL_SOCIAL', positionRelevance: ['ALL'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Goalkeeper save', description: 'What counts? Goalkeeper prevents an intentional attempt from entering the goal.', matchPhase: 'OUT_OF_POSSESSION', category: 'GOALKEEPING', subcategory: 'Shot stopping', matchDayGroup: 'GOALKEEPING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['GOALKEEPER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Goalkeeper high claim', description: 'What counts? Goalkeeper catches a high ball played into the penalty area.', matchPhase: 'OUT_OF_POSSESSION', category: 'GOALKEEPING', subcategory: 'Handling', matchDayGroup: 'GOALKEEPING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['GOALKEEPER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Goalkeeper punch', description: 'What counts? Goalkeeper punches a high ball clear rather than trying to catch it.', matchPhase: 'OUT_OF_POSSESSION', category: 'GOALKEEPING', subcategory: 'Handling', matchDayGroup: 'GOALKEEPING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TECHNICAL', positionRelevance: ['GOALKEEPER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
  { name: 'Goalkeeper sweeper clearance', description: 'What counts? Goalkeeper reads danger and rushes out to clear or claim under pressure near or beyond the edge of the area.', matchPhase: 'OUT_OF_POSSESSION', category: 'GOALKEEPING', subcategory: 'Sweeper keeper', matchDayGroup: 'GOALKEEPING', agePhases: ['YOUTH', 'ADULT'], fourCorner: 'TACTICAL', positionRelevance: ['GOALKEEPER'], requiresLocation: false, enabledByDefault: false, benchmarkable: true },
]

const trackingTopics = [
  { name: 'Receiving into feet', phase: 'IN_POSSESSION', focusArea: 'RECEIVING', contexts: [['PLAYER', 'CENTRE_FORWARD'], ['PLAYER', 'ATTACKING_MIDFIELDER'], ['PLAYER', 'GENERAL_OUTFIELD_PLAYER']], events: ['Touch', 'Pass complete', 'Pass incomplete'], aliases: ['receive to feet', 'set pass'] },
  { name: 'Receiving and playing forward', phase: 'IN_POSSESSION', focusArea: 'RECEIVING', contexts: [['PLAYER', 'CENTRAL_MIDFIELDER'], ['PLAYER', 'DEFENSIVE_MIDFIELDER'], ['PLAYER', 'GENERAL_OUTFIELD_PLAYER']], events: ['Touch', 'Forward pass completed', 'Forward pass incomplete', 'Pass complete', 'Pass incomplete'], aliases: ['receive forward', 'play forward'] },
  { name: 'Centre-forward link play', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', contexts: [['PLAYER', 'CENTRE_FORWARD']], events: ['Touch', 'Pass complete', 'Forward pass completed', 'Key pass'], aliases: ['number nine link play', 'set and spin', 'bounce pass'] },
  { name: 'Runs in behind', phase: 'IN_POSSESSION', focusArea: 'MOVEMENT', contexts: [['PLAYER', 'CENTRE_FORWARD'], ['PLAYER', 'WIDE_PLAYER']], events: ['Forward pass completed', 'Forward pass incomplete', 'Key pass', 'Shot on target', 'Shot off target'], aliases: ['run behind', 'balls in behind'] },
  { name: 'Pressing from the front', phase: 'OUT_OF_POSSESSION', focusArea: 'PRESSING', contexts: [['PLAYER', 'CENTRE_FORWARD'], ['UNIT', 'PRESSING_UNIT']], events: ['Ball recovery', 'Interception', 'Tackle won', 'Tackle lost'], aliases: ['front press', 'first defender'] },
  { name: 'Centre-back progression', phase: 'IN_POSSESSION', focusArea: 'PROGRESSION', contexts: [['PLAYER', 'CENTRE_BACK'], ['UNIT', 'BUILD_UP_UNIT']], events: ['Forward pass completed', 'Forward pass incomplete', 'Pass complete', 'Pass incomplete', 'Carry'], aliases: ['playing out centre back', 'break lines'] },
  { name: 'Defending one-versus-one', phase: 'OUT_OF_POSSESSION', focusArea: 'DEFENDING', contexts: [['PLAYER', 'FULL_BACK'], ['PLAYER', 'CENTRE_BACK'], ['PLAYER', 'WIDE_PLAYER']], events: ['Tackle won', 'Interception'], aliases: ['1v1 defending', 'duel defending'] },
  { name: 'Goalkeeper distribution', phase: 'GOALKEEPING', focusArea: 'GOALKEEPER_DISTRIBUTION', contexts: [['PLAYER', 'GOALKEEPER'], ['UNIT', 'GOALKEEPER_UNIT']], events: ['Pass complete', 'Pass incomplete', 'Forward pass completed', 'Forward pass incomplete', 'Long pass completed', 'Long pass incomplete'], aliases: ['keeper distribution', 'goalkeeper passing'] },
  { name: 'Defensive unit protecting space behind', phase: 'OUT_OF_POSSESSION', focusArea: 'PROTECTING_SPACE_BEHIND', contexts: [['UNIT', 'DEFENSIVE_UNIT']], events: ['Interception', 'Ball recovery', 'Tackle won', 'Tackle lost'], aliases: ['space behind', 'balls played in behind', 'protect depth'] },
  { name: 'Defensive unit defending crosses', phase: 'OUT_OF_POSSESSION', focusArea: 'DEFENDING_CROSSES', contexts: [['UNIT', 'DEFENSIVE_UNIT']], events: ['Shot blocked', 'Interception', 'Ball recovery', 'Clearance', 'Headed clearance'], aliases: ['defend crosses', 'box defending'] },
  { name: 'Midfield unit supporting possession', phase: 'IN_POSSESSION', focusArea: 'SUPPORTING_THE_BALL', contexts: [['UNIT', 'MIDFIELD_UNIT']], events: ['Pass complete', 'Pass incomplete', 'Forward pass completed', 'Forward pass incomplete', 'Touch'], aliases: ['midfield support', 'support angles'] },
  { name: 'Attacking unit combination play', phase: 'IN_POSSESSION', focusArea: 'COMBINATION_PLAY', contexts: [['UNIT', 'ATTACKING_UNIT']], events: ['Pass complete', 'Key pass', 'Assist', 'Cutback'], aliases: ['third man', 'third-player run', 'third-player combinations'] },
  { name: 'Pressing unit forcing play backwards', phase: 'OUT_OF_POSSESSION', focusArea: 'PRESSING', contexts: [['UNIT', 'PRESSING_UNIT']], events: ['Ball recovery', 'Interception', 'Tackle won', 'Tackle lost'], aliases: ['force backwards', 'press trap'] },
  { name: 'Build-up effectiveness', phase: 'IN_POSSESSION', focusArea: 'BUILD_UP', contexts: [['TEAM', 'WHOLE_TEAM']], events: ['Pass complete', 'Pass incomplete', 'Forward pass completed', 'Forward pass incomplete', 'Carry'], aliases: ['build up', 'playing out'] },
  { name: 'Final-third entries', phase: 'IN_POSSESSION', focusArea: 'CREATING_CHANCES', contexts: [['TEAM', 'WHOLE_TEAM']], events: ['Pass into final third completed', 'Pass into final third incomplete', 'Key pass', 'Cross completed', 'Cross incomplete'], aliases: ['final third entries', 'enter final third'] },
  { name: 'Team pressing', phase: 'OUT_OF_POSSESSION', focusArea: 'PRESSING', contexts: [['TEAM', 'WHOLE_TEAM']], events: ['Ball recovery', 'Interception', 'Tackle won', 'Tackle lost'], aliases: ['team press', 'collective pressing'] },
  { name: 'Defensive transition', phase: 'DEFENSIVE_TRANSITION', focusArea: 'DEFENSIVE_TRANSITION', contexts: [['TEAM', 'WHOLE_TEAM']], events: ['Possession lost', 'Ball recovery', 'Tackle won', 'Tackle lost'], aliases: ['counter press', 'rest defence reaction'] },
  { name: 'Counter-attacking effectiveness', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', contexts: [['TEAM', 'WHOLE_TEAM']], events: ['Ball recovery', 'Forward pass completed', 'Forward pass incomplete', 'Carry', 'Key pass', 'Shot on target'], aliases: ['counter attack', 'progress forward quickly'] },
  { name: 'Set-piece outcomes', phase: 'ATTACKING_SET_PIECES', focusArea: 'SET_PIECES', contexts: [['TEAM', 'WHOLE_TEAM']], events: ['Goal', 'Shot on target', 'Shot off target', 'Assist'], aliases: ['set pieces', 'corners and free kicks'] },
]

const passLocationOutcomes = [
  ['TARGET_REACHED', 'Target reached', true],
  ['POSSESSION_RETAINED', 'Possession retained', true],
  ['POSSESSION_LOST', 'Possession lost', false],
  ['OUT_OF_PLAY', 'Out of play', false],
]
const directStrikerOutcomes = [
  ['CLEAN_POSSESSION_SECURED', 'Clean possession secured', true],
  ['FLICK_ON_FOUND_TEAMMATE', 'Flick-on found teammate', true],
  ['SECOND_BALL_RECOVERED', 'Second ball recovered', true],
  ['POSSESSION_LOST', 'Possession lost', false],
]
const combinationOutcomes = [
  ['BROKE_DEFENSIVE_LINE', 'Broke the defensive line', true],
  ['PROGRESSED_PLAY', 'Progressed play', true],
  ['RETAINED_WITHOUT_PROGRESSION', 'Retained possession without progression', null],
  ['BROKE_DOWN', 'Combination broke down', false],
]
const pressingOutcomes = [
  ['POSSESSION_WON', 'Possession won', true],
  ['FORCED_BACKWARDS', 'Forced backwards', true],
  ['FORCED_LONG', 'Forced long', true],
  ['OPPONENT_PLAYED_THROUGH', 'Opponent played through', false],
]

const trackingPatterns = [
  { name: 'Pass behind opposition left-back', phase: 'IN_POSSESSION', focusArea: 'PROGRESSION', requiresLocation: true, contexts: [['TEAM', 'WHOLE_TEAM'], ['UNIT', 'ATTACKING_UNIT']], steps: ['Forward pass completed', 'Pass complete'], outcomes: passLocationOutcomes, aliases: ['pass behind left back', 'ball behind left full back'], topics: ['Runs in behind', 'Final-third entries'] },
  { name: 'Pass behind opposition right-back', phase: 'IN_POSSESSION', focusArea: 'PROGRESSION', requiresLocation: true, contexts: [['TEAM', 'WHOLE_TEAM'], ['UNIT', 'ATTACKING_UNIT']], steps: ['Forward pass completed', 'Pass complete'], outcomes: passLocationOutcomes, aliases: ['pass behind right back', 'ball behind right full back'], topics: ['Runs in behind', 'Final-third entries'] },
  { name: 'Ground pass between centre-backs', phase: 'IN_POSSESSION', focusArea: 'PROGRESSION', requiresLocation: true, contexts: [['TEAM', 'WHOLE_TEAM'], ['PLAYER', 'CENTRE_FORWARD']], steps: ['Forward pass completed', 'Pass complete'], outcomes: passLocationOutcomes, aliases: ['split centre backs', 'pass through centre backs'], topics: ['Runs in behind', 'Final-third entries'] },
  { name: 'Pass into the channel', phase: 'IN_POSSESSION', focusArea: 'PROGRESSION', requiresLocation: true, contexts: [['TEAM', 'WHOLE_TEAM'], ['PLAYER', 'WIDE_PLAYER'], ['PLAYER', 'CENTRE_FORWARD']], steps: ['Forward pass completed', 'Pass complete'], outcomes: passLocationOutcomes, aliases: ['channel pass', 'ball into channel'], topics: ['Runs in behind', 'Final-third entries'] },
  { name: 'Direct pass towards striker’s head', phase: 'IN_POSSESSION', focusArea: 'AERIAL_PLAY', requiresLocation: false, contexts: [['PLAYER', 'CENTRE_FORWARD'], ['TEAM', 'WHOLE_TEAM']], steps: ['Forward pass completed'], outcomes: directStrikerOutcomes, aliases: ['direct ball to striker head', 'flick-on', 'target man header'], topics: ['Centre-forward link play'] },
  { name: 'Direct pass into striker’s feet', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', requiresLocation: false, contexts: [['PLAYER', 'CENTRE_FORWARD'], ['TEAM', 'WHOLE_TEAM']], steps: ['Forward pass completed', 'Touch', 'Pass complete'], outcomes: directStrikerOutcomes, aliases: ['into striker feet', 'feet to striker', 'target player feet'], topics: ['Centre-forward link play', 'Receiving into feet'] },
  { name: 'Striker receives and sets', phase: 'IN_POSSESSION', focusArea: 'LINK_PLAY', requiresLocation: false, contexts: [['PLAYER', 'CENTRE_FORWARD']], steps: ['Touch', 'Pass complete'], outcomes: combinationOutcomes, aliases: ['set and spin', 'bounce pass', 'striker set'], topics: ['Centre-forward link play', 'Receiving into feet'] },
  { name: 'Third-player combination', phase: 'IN_POSSESSION', focusArea: 'COMBINATION_PLAY', requiresLocation: false, contexts: [['UNIT', 'ATTACKING_UNIT'], ['TEAM', 'WHOLE_TEAM']], steps: ['Pass complete', 'Touch', 'Key pass'], outcomes: combinationOutcomes, aliases: ['third man', 'third-player run', 'third-player combination'], topics: ['Attacking unit combination play'] },
  { name: 'Wall pass', phase: 'IN_POSSESSION', focusArea: 'COMBINATION_PLAY', requiresLocation: false, contexts: [['PLAYER', 'WIDE_PLAYER'], ['UNIT', 'ATTACKING_UNIT']], steps: ['Pass complete', 'Touch', 'Pass complete'], outcomes: combinationOutcomes, aliases: ['one two', 'give and go'], topics: ['Attacking unit combination play'] },
  { name: 'Flick-on to supporting runner', phase: 'IN_POSSESSION', focusArea: 'AERIAL_PLAY', requiresLocation: false, contexts: [['PLAYER', 'CENTRE_FORWARD'], ['UNIT', 'ATTACKING_UNIT']], steps: ['Touch', 'Pass complete'], outcomes: directStrikerOutcomes, aliases: ['flick-on runner', 'header flick'], topics: ['Centre-forward link play'] },
  { name: 'Wide combination and overlap', phase: 'IN_POSSESSION', focusArea: 'COMBINATION_PLAY', requiresLocation: true, contexts: [['UNIT', 'LEFT_SIDE_UNIT'], ['UNIT', 'RIGHT_SIDE_UNIT'], ['UNIT', 'ATTACKING_UNIT']], steps: ['Pass complete', 'Cross completed', 'Cutback'], outcomes: combinationOutcomes, aliases: ['overlap', 'wide overlap', 'ball around the corner'], topics: ['Attacking unit combination play', 'Final-third entries'] },
  { name: 'First action after regaining possession', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', requiresLocation: false, contexts: [['TEAM', 'WHOLE_TEAM'], ['UNIT', 'MIDFIELD_UNIT']], steps: ['Ball recovery', 'Forward pass completed'], outcomes: combinationOutcomes, aliases: ['first pass after regain', 'first action regain'], topics: ['Counter-attacking effectiveness'] },
  { name: 'Regain and progress forward', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', requiresLocation: false, contexts: [['TEAM', 'WHOLE_TEAM'], ['UNIT', 'PRESSING_UNIT']], steps: ['Ball recovery', 'Forward pass completed', 'Carry'], outcomes: combinationOutcomes, aliases: ['regain progress', 'win it and play forward'], topics: ['Counter-attacking effectiveness'] },
  { name: 'Counter-attack reaches final third', phase: 'ATTACKING_TRANSITION', focusArea: 'ATTACKING_TRANSITION', requiresLocation: false, contexts: [['TEAM', 'WHOLE_TEAM']], steps: ['Ball recovery', 'Forward pass completed', 'Key pass'], outcomes: combinationOutcomes, aliases: ['counter reaches final third', 'fast break final third'], topics: ['Counter-attacking effectiveness'] },
  { name: 'Defensive transition delays attack', phase: 'DEFENSIVE_TRANSITION', focusArea: 'DEFENSIVE_TRANSITION', requiresLocation: false, contexts: [['TEAM', 'WHOLE_TEAM'], ['UNIT', 'DEFENSIVE_UNIT']], steps: ['Possession lost', 'Tackle won'], outcomes: pressingOutcomes, aliases: ['delay counter attack', 'defensive delay'], topics: ['Defensive transition'] },
  { name: 'Defensive line protects space behind', phase: 'OUT_OF_POSSESSION', focusArea: 'PROTECTING_SPACE_BEHIND', requiresLocation: false, contexts: [['UNIT', 'DEFENSIVE_UNIT'], ['TEAM', 'WHOLE_TEAM']], steps: ['Interception', 'Ball recovery'], outcomes: pressingOutcomes, aliases: ['protect space behind', 'defensive line depth'], topics: ['Defensive unit protecting space behind'] },
  { name: 'Full-back supported against overload', phase: 'OUT_OF_POSSESSION', focusArea: 'DEFENDING_WIDE_AREAS', requiresLocation: false, contexts: [['PLAYER', 'FULL_BACK'], ['UNIT', 'LEFT_SIDE_UNIT'], ['UNIT', 'RIGHT_SIDE_UNIT']], steps: ['Tackle won', 'Interception'], outcomes: pressingOutcomes, aliases: ['full back support', 'wide overload support'], topics: ['Defending one-versus-one'] },
  { name: 'Midfield screen prevents central progression', phase: 'OUT_OF_POSSESSION', focusArea: 'DEFENDING', requiresLocation: false, contexts: [['UNIT', 'MIDFIELD_UNIT'], ['TEAM', 'WHOLE_TEAM']], steps: ['Interception', 'Ball recovery'], outcomes: pressingOutcomes, aliases: ['midfield screen', 'block central progression'], topics: ['Pressing unit forcing play backwards'] },
  { name: 'Press forces play backwards', phase: 'OUT_OF_POSSESSION', focusArea: 'PRESSING', requiresLocation: false, contexts: [['TEAM', 'WHOLE_TEAM'], ['UNIT', 'PRESSING_UNIT'], ['PLAYER', 'CENTRE_FORWARD']], steps: ['Ball recovery', 'Interception', 'Tackle won'], outcomes: pressingOutcomes, aliases: ['team press backwards', 'force backwards', 'press trap'], topics: ['Team pressing', 'Pressing unit forcing play backwards', 'Pressing from the front'] },
]

async function main() {
  const user = await prisma.user.upsert({
    where: { email: localUser.email },
    update: {},
    create: localUser,
  })

  let club = await prisma.club.findFirst({
    where: {
      userId: user.id,
      name: demoClub.name,
    },
  })

  if (club) {
    club = await prisma.club.update({
      where: { id: club.id },
      data: demoClub,
    })
  } else {
    club = await prisma.club.create({
      data: {
        ...demoClub,
        userId: user.id,
      },
    })
  }

  await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: user.id,
        clubId: club.id,
      },
    },
    update: {
      role: 'OWNER',
    },
    create: {
      userId: user.id,
      clubId: club.id,
      role: 'OWNER',
    },
  })

  let team = await prisma.team.findFirst({
    where: {
      clubId: club.id,
      name: demoTeam.name,
      season: demoTeam.season,
    },
  })

  if (team) {
    team = await prisma.team.update({
      where: { id: team.id },
      data: demoTeam,
    })
  } else {
    team = await prisma.team.create({
      data: {
        ...demoTeam,
        clubId: club.id,
      },
    })
  }

  for (const demoPlayer of demoPlayers) {
    const existingPlayer = await prisma.player.findFirst({
      where: {
        teamId: team.id,
        firstName: demoPlayer.firstName,
        surname: demoPlayer.surname,
      },
    })

    if (existingPlayer) {
      await prisma.player.update({
        where: { id: existingPlayer.id },
        data: {
          ...demoPlayer,
          isActive: true,
        },
      })
    } else {
      await prisma.player.create({
        data: {
          ...demoPlayer,
          teamId: team.id,
        },
      })
    }
  }

  for (const fitnessTestType of fitnessTestTypes) {
    const existingFitnessTestType = await prisma.fitnessTestType.findFirst({
      where: {
        userId: null,
        name: fitnessTestType.name,
        isDefault: true,
      },
    })

    if (existingFitnessTestType) {
      await prisma.fitnessTestType.update({
        where: { id: existingFitnessTestType.id },
        data: fitnessTestType,
      })
    } else {
      await prisma.fitnessTestType.create({
        data: fitnessTestType,
      })
    }
  }

  for (const eventDefinition of [...matchEventDefinitions, ...teamTacticalEventDefinitions]) {
    const seedEventDefinition = Object.fromEntries(Object.entries(eventDefinition).filter(([key]) => key !== 'stableId'))
    const data = {
      ...seedEventDefinition,
      scope: 'GLOBAL',
      slug: createEventDefinitionSlug(seedEventDefinition.name),
      normalizedName: normalizeEventDefinitionName(seedEventDefinition.name),
      enabledByDefault: seedEventDefinition.enabledByDefault ?? true,
      benchmarkable: seedEventDefinition.benchmarkable ?? true,
      requiresLocation: seedEventDefinition.requiresLocation ?? false,
      isActive: seedEventDefinition.isActive ?? true,
      archivedAt: seedEventDefinition.archivedAt ?? null,
    }

    if (seedEventDefinition.legacyEventType) {
      await prisma.eventDefinition.upsert({
        where: { legacyEventType: seedEventDefinition.legacyEventType },
        update: data,
        create: data,
      })
    } else {
      const existingEventDefinition = await prisma.eventDefinition.findFirst({
        where: {
          scope: data.scope,
          clubId: data.clubId ?? null,
          normalizedName: data.normalizedName,
        },
        select: { id: true },
      })

      if (existingEventDefinition) {
        await prisma.eventDefinition.update({
          where: { id: existingEventDefinition.id },
          data,
        })
      } else {
        await prisma.eventDefinition.create({ data })
      }
    }
  }

  const eventDefinitionsByName = new Map((await prisma.eventDefinition.findMany({ where: { scope: 'GLOBAL' } })).map((eventDefinition) => [eventDefinition.name, eventDefinition]))
  const missingTopicEventDefinitions = new Set()
  const savedTopicsByName = new Map()
  for (const topic of trackingTopics) {
    const slug = createEventDefinitionSlug(topic.name)
    const data = {
      ownerScope: 'GLOBAL',
      clubId: null,
      name: topic.name,
      slug,
      normalizedName: normalizeTrackingSearch(topic.name),
      description: `${topic.name} coaching focus using existing standard event definitions.`,
      phase: topic.phase,
      focusArea: topic.focusArea,
      agePhases: ['YOUTH', 'ADULT'],
      suggestedMaxEvents: Math.min(8, Math.max(4, topic.events.length + 2)),
      isActive: true,
      archivedAt: null,
    }
    const savedTopic = await prisma.eventTopic.upsert({ where: { slug }, update: data, create: data })
    savedTopicsByName.set(topic.name, savedTopic)
    await prisma.eventTopicContext.deleteMany({ where: { topicId: savedTopic.id } })
    await prisma.eventTopicAlias.deleteMany({ where: { topicId: savedTopic.id } })
    await prisma.eventTopicEvent.deleteMany({ where: { topicId: savedTopic.id } })
    await prisma.eventTopicContext.createMany({ data: topic.contexts.map(([scopeType, targetContext], index) => ({ topicId: savedTopic.id, scopeType, targetContext, recommended: true, displayOrder: index })) })
    await prisma.eventTopicAlias.createMany({ data: Array.from(new Set(topic.aliases.map((alias) => normalizeTrackingSearch(alias)))).map((normalizedAlias) => ({ topicId: savedTopic.id, alias: topic.aliases.find((alias) => normalizeTrackingSearch(alias) === normalizedAlias) ?? normalizedAlias, normalizedAlias })), skipDuplicates: true })
    const linkedEvents = topic.events.flatMap((name, index) => {
      const eventDefinition = eventDefinitionsByName.get(name)
      if (!eventDefinition) {
        missingTopicEventDefinitions.add(`${topic.name}: ${name}`)
        return []
      }
      return [{ topicId: savedTopic.id, eventDefinitionId: eventDefinition.id, displayOrder: index, recommended: index < 4, guidance: index < 4 ? null : 'Optional context event; use only if observer workload allows.', observerLoadWeight: eventDefinition.requiresLocation ? 2 : 1 }]
    })
    if (linkedEvents.length > 0) await prisma.eventTopicEvent.createMany({ data: linkedEvents, skipDuplicates: true })
  }
  if (missingTopicEventDefinitions.size > 0) console.warn('Tracking topic seed skipped missing event definitions:', Array.from(missingTopicEventDefinitions).join(', '))

  const missingPatternEventDefinitions = new Set()
  const missingPatternTopics = new Set()
  for (const pattern of trackingPatterns) {
    const slug = createEventDefinitionSlug(pattern.name)
    const data = {
      ownerScope: 'GLOBAL',
      clubId: null,
      name: pattern.name,
      slug,
      normalizedName: normalizeTrackingSearch(pattern.name),
      description: `${pattern.name} tactical pattern with controlled outcomes.`,
      phase: pattern.phase,
      focusArea: pattern.focusArea,
      active: true,
      requiresLocation: pattern.requiresLocation,
    }
    const savedPattern = await prisma.trackingPatternDefinition.upsert({ where: { slug }, update: data, create: data })
    await prisma.trackingPatternContext.deleteMany({ where: { patternId: savedPattern.id } })
    await prisma.trackingPatternAlias.deleteMany({ where: { patternId: savedPattern.id } })
    await prisma.trackingPatternStep.deleteMany({ where: { patternId: savedPattern.id } })
    await prisma.eventTopicPattern.deleteMany({ where: { patternId: savedPattern.id } })

    await prisma.trackingPatternContext.createMany({ data: pattern.contexts.map(([scopeType, targetContext], index) => ({ patternId: savedPattern.id, scopeType, targetContext, recommended: index === 0, displayOrder: index })) })
    await prisma.trackingPatternAlias.createMany({ data: Array.from(new Set(pattern.aliases.map((alias) => normalizeTrackingSearch(alias)))).map((normalizedAlias) => ({ patternId: savedPattern.id, alias: pattern.aliases.find((alias) => normalizeTrackingSearch(alias) === normalizedAlias) ?? normalizedAlias, normalizedAlias })), skipDuplicates: true })
    const stepRows = pattern.steps.flatMap((eventName, index) => {
      const eventDefinition = eventDefinitionsByName.get(eventName)
      if (!eventDefinition) {
        missingPatternEventDefinitions.add(`${pattern.name}: ${eventName}`)
        return []
      }
      return [{ patternId: savedPattern.id, eventDefinitionId: eventDefinition.id, stepOrder: index, label: eventName, required: true }]
    })
    if (stepRows.length > 0) await prisma.trackingPatternStep.createMany({ data: stepRows })
    for (const [index, [code, label, positive]] of pattern.outcomes.entries()) {
      await prisma.trackingPatternOutcome.upsert({
        where: { patternId_code: { patternId: savedPattern.id, code } },
        update: { label, displayOrder: index, positive },
        create: { patternId: savedPattern.id, code, label, displayOrder: index, positive },
      })
    }
    const topicRows = pattern.topics.flatMap((topicName, index) => {
      const topic = savedTopicsByName.get(topicName)
      if (!topic) {
        missingPatternTopics.add(`${pattern.name}: ${topicName}`)
        return []
      }
      return [{ topicId: topic.id, patternId: savedPattern.id, displayOrder: index, recommended: index === 0, observerLoadWeight: pattern.requiresLocation ? 3 : 2 }]
    })
    if (topicRows.length > 0) await prisma.eventTopicPattern.createMany({ data: topicRows, skipDuplicates: true })
  }
  if (missingPatternEventDefinitions.size > 0) console.warn('Tracking pattern seed skipped missing event definitions:', Array.from(missingPatternEventDefinitions).join(', '))
  if (missingPatternTopics.size > 0) console.warn('Tracking pattern seed skipped missing topics:', Array.from(missingPatternTopics).join(', '))
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
