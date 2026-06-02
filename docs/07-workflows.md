# Can You Coach - MVP Workflows

## Purpose

This document defines the key workflows the MVP must support.

The AI coding agent should use this document to understand how coaches will actually use the product in real life.

The first MVP should prioritise workflows that can be used during preseason.

---

# Workflow 1: Preseason Fitness Testing

## User Goal

As a coach, I want to run a fitness test with my squad and record results immediately, so that I can compare players and track improvement over time.

---

## Real-World Scenario

A coach is running a preseason fitness session.

Around 20 to 25 players are present.

The coach selects a test, starts a testing session, and records each player's result either:

* live during the test
* immediately after the test

The system then produces rankings and stores results for future comparison.

---

## Supported Fitness Test Styles

The app must support different styles of fitness tests.

### Drop-Out Tests

Players drop out at different points.

Examples:

* Gacon Test
* Yo-Yo Test
* Bleep Test

The coach records the point where each player drops out.

Example results:

* 980 metres
* Level 17.2
* Stage 8

---

### Distance-Based Tests

Players complete a fixed time period and the distance achieved is recorded.

Examples:

* 12-minute run
* Cooper Test
* 6-minute run

Example results:

* 2250 metres
* 2.4 km

---

### Time-Based Tests

Players complete a fixed distance or course and the time taken is recorded.

Examples:

* Bronco Test
* 505 Agility Test
* 20m Sprint
* 40m Sprint

Example results:

* 5 minutes 12 seconds
* 2.41 seconds
* 6.1 seconds

---

### Repetition-Based Tests

Players complete as many repetitions as possible.

Examples:

* Press-ups in 60 seconds
* Sit-ups in 60 seconds

Example results:

* 42 reps

---

# Workflow 2: Create Fitness Test Type

## User Goal

As a coach, I want to create custom fitness tests, so that the app can support any test my club uses.

---

## Required Fields

A custom fitness test type should include:

* Test name
* Description
* Result unit
* Whether higher or lower is better

Example result units:

* metres
* kilometres
* seconds
* minutes
* level
* reps
* points

Examples:

```text
Test name: 12-minute run
Result unit: metres
Higher is better: yes
```

```text
Test name: Bronco
Result unit: seconds
Higher is better: no
```

---

# Workflow 3: Run Fitness Test Session

## User Goal

As a coach, I want to select a fitness test and enter player results quickly.

---

## Steps

1. Select club
2. Select team
3. Select fitness test type
4. Select date
5. Select players
6. Enter results
7. Save session
8. View rankings

---

## Player Selection

Default behaviour:

* All active players in the selected team should be included

The coach should be able to remove unavailable players.

Examples of unavailable players:

* Injured
* Absent
* Did not start

---

## Result Entry

The result entry screen should show one row per player.

Each row should include:

* Player name
* Result input
* Notes input
* Status option

Possible statuses:

* Completed
* Did not start
* Injured
* Absent
* Dropped out

The interface should be quick enough to use during the test.

---

# Workflow 4: View Fitness Rankings

## User Goal

As a player or coach, I want to see current rankings, so that performance can be compared across the squad.

---

## Ranking Rules

Rankings should be based on the selected fitness test type.

If higher is better:

* Highest result ranks first

If lower is better:

* Lowest result ranks first

Players with no valid result should appear separately or at the bottom.

---

## Ranking View Should Display

* Rank
* Player name
* Result
* Result unit
* Notes or status where relevant

Example:

```text
1. Tom Jones - 1140 metres
2. Jack Smith - 1090 metres
3. Ben Taylor - 1030 metres
```

---

# Workflow 5: View Fitness Improvement Over Time

## User Goal

As a coach, I want to see whether players are improving across preseason.

---

## Progress View Should Display

For a selected player and test type:

* First recorded result
* Latest recorded result
* Best recorded result
* Improvement from first to latest
* Simple line chart

---

## Team Progress View

For a selected team and test type:

* All player results over time
* Biggest improvers
* Current rankings
* Average team improvement

---

# Workflow 6: Match Tracking During Friendlies

## User Goal

As a coach, assistant, parent or injured player, I want to record a small number of key match events during preseason friendlies.

---

## Real-World Scenario

During a preseason friendly, the team may be experimenting with different formations.

The coach wants to track a small number of meaningful events.

The aim is not to record everything.

The aim is to capture useful coaching information without distracting from the match.

---

## Event Tracking Rules

The MVP should support custom match event types.

A match should typically use around 5 event types.

Too many event types makes the process slow and unreliable.

The app should encourage simple tracking.

---

## Positive And Negative Events

The system must support positive and negative events.

This allows success percentages to be calculated.

Examples:

```text
Successful pass
Unsuccessful pass
```

```text
Successful dribble
Unsuccessful dribble
```

```text
Press won
Press failed
```

---

# Workflow 7: Track Match Events

## User Goal

As a match tracker, I want to record player events quickly during a match.

---

## Steps

1. Select match
2. Select player
3. Select event type
4. Event is saved with timestamp

Each recorded event should store:

* Match
* Player
* Event type
* Timestamp
* Notes if added

---

## UX Rule

Recording an event should require no more than two taps after the match screen is open:

1. Select player
2. Select event

---

# Workflow 8: Match Analysis

## User Goal

As a coach, I want to review match data so that I can understand player and team performance.

---

## Required Views

### Player Match View

Display:

* Events recorded
* Positive events
* Negative events
* Success percentage where applicable
* Comparison against players in the same general position

---

### Team Match View

Display:

* Total events
* Success percentage by event type
* Trends across matches
* Formation notes where available

---

# Buyer And User Assumption

The likely buyer is a football club rather than an individual coach.

The app should support club-level structure from the beginning.

However, the MVP does not need complex permissions.

Future versions may support:

* Club admins
* Team coaches
* Assistant coaches
* Parents
* Analysts
* Players

Do not build complex role-based permissions in the MVP.

---

# MVP Priority Order

Build in this order:

1. Club, team and player setup
2. Fitness test types
3. Fitness test sessions
4. Fitness result entry
5. Fitness rankings
6. Fitness progress charts
7. Match setup
8. Custom match event types
9. Match tracking
10. Match analysis

The first usable version should allow Brereton Social First Team to record preseason fitness testing.
