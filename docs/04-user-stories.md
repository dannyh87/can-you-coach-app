# Can You Coach - User Stories

## Purpose

This document describes what users need to do in the MVP.

The AI coding agent should build features based on these user stories and acceptance criteria.

---

# Priority 1: Players

## Add Player

As a coach,
I want to add a player,
So that I can track their development.

### Acceptance Criteria

* Coach can enter first name
* Coach can enter surname
* Coach can enter squad number
* Coach can select preferred position
* Player is saved
* Player appears in the player list

---

## Edit Player

As a coach,
I want to edit a player,
So that I can keep player details accurate.

### Acceptance Criteria

* Coach can update player details
* Changes are saved
* Updated details appear in the player list

---

## Delete Player

As a coach,
I want to delete a player,
So that inactive players do not clutter the app.

### Acceptance Criteria

* Coach can delete a player
* App asks for confirmation
* Player is removed from active lists

---

# Priority 2: Fitness Testing

## Create Fitness Test Session

As a coach,
I want to create a fitness testing session,
So that I can record preseason fitness data.

### Acceptance Criteria

* Coach can select test type
* Coach can select test date
* Coach can add notes
* Session is saved
* Session appears in fitness test history

Supported MVP test types:

* Gacon Test
* Yo-Yo Test
* Bronco Test
* 505 Agility Test
* Custom Test

---

## Enter Fitness Test Results

As a coach,
I want to enter fitness results for each player,
So that I can compare player fitness levels.

### Acceptance Criteria

* Coach can select a fitness test session
* Coach can see all active players
* Coach can enter each player's result
* Result can store distance, time, level, stage, or notes
* Results are saved against the correct player and test session

---

## View Fitness Test Rankings

As a coach,
I want to rank players by fitness test result,
So that I can compare performance across the squad.

### Acceptance Criteria

* Coach can select a test session
* App displays player results in ranked order
* Best performer appears at the top
* Missing results are clearly shown
* Results can be viewed in a table

---

## View Player Fitness Progress

As a coach,
I want to view a player's fitness progress over time,
So that I can see whether they are improving.

### Acceptance Criteria

* Coach can select a player
* Coach can select a test type
* App displays historical results
* App shows latest result
* App shows best result
* App shows improvement from first to latest result
* App displays a simple line chart

---

## Compare Players Across Fitness Tests

As a coach,
I want to compare players across different fitness tests,
So that I can understand different physical strengths.

### Acceptance Criteria

* Coach can view player results by test type
* Coach can compare players in a table
* Coach can identify who performs best in each test
* App should support comparison over multiple test dates

---

# Priority 3: Teams

## Create Team

As a coach,
I want to create a team,
So that players and results can be organised.

### Acceptance Criteria

* Coach can enter team name
* Coach can enter age group
* Coach can enter season
* Team is saved

---

## Assign Player To Team

As a coach,
I want to assign players to a team,
So that I can manage my squad.

### Acceptance Criteria

* Coach can select a player
* Coach can select a team
* Player is linked to that team

---

# Priority 4: Match Tracking

## Create Match

As a coach,
I want to create a match,
So that I can track player actions during a game.

### Acceptance Criteria

* Coach can enter opposition
* Coach can enter match date
* Coach can select home or away
* Coach can select match type
* Coach can enter final score
* Match is saved

---

## Record Match Event

As a coach,
I want to record player actions during a match,
So that I can measure technical and tactical performance.

### Acceptance Criteria

* Coach can select a match
* Coach can select a player
* Coach can select an event type
* Event is timestamped
* Event is saved

Supported MVP event types:

* Successful pass
* Unsuccessful pass
* Successful dribble
* Unsuccessful dribble
* Shot
* Shot on target
* Goal
* Tackle won
* Interception

---

## View Player Match Stats

As a coach,
I want to view a player's match statistics,
So that I can understand their performance over time.

### Acceptance Criteria

* Coach can select a player
* App shows total events
* App shows per-match averages
* App shows match-by-match history
* App displays simple charts

---

## View Team Match Stats

As a coach,
I want to view team match statistics,
So that I can understand team performance trends.

### Acceptance Criteria

* Coach can select a team
* App shows team totals
* App shows match comparisons
* App displays simple charts

---

# MVP Rule

If a feature is not covered by these user stories, do not build it without approval.

