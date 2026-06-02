# Can You Coach - Database Schema

## Purpose

This document defines the intended MVP data model.

The AI coding agent should use this document when creating the Prisma schema.

The database must support custom fitness tests and custom match events.

---

# Core Models

## User

Represents an app user.

Fields:

* id
* email
* passwordHash
* createdAt
* updatedAt

A user can own multiple teams.

---

## Team

Represents a football team or squad.

Fields:

* id
* userId
* name
* ageGroup
* season
* createdAt
* updatedAt

A team has many players.

---

## Player

Represents an individual player.

Fields:

* id
* teamId
* firstName
* surname
* squadNumber
* preferredPosition
* isActive
* createdAt
* updatedAt

A player belongs to one team.

---

# Fitness Testing Models

## FitnessTestType

Represents a type of fitness test.

This can be a standard test or a custom test.

Examples:

* Gacon Test
* Yo-Yo Test
* Bronco Test
* 505 Agility Test
* 20m Sprint
* Custom Club Test

Fields:

* id
* userId
* name
* description
* resultUnit
* higherIsBetter
* isDefault
* createdAt
* updatedAt

Example result units:

* metres
* seconds
* minutes
* level
* reps
* points

`higherIsBetter` determines ranking order.

Examples:

* Gacon distance: higher is better
* Yo-Yo distance: higher is better
* Bronco time: lower is better
* 505 agility time: lower is better

---

## FitnessTestSession

Represents a specific testing session.

Example:

* Brereton Social Preseason Testing - 10 July 2026

Fields:

* id
* teamId
* fitnessTestTypeId
* date
* notes
* createdAt
* updatedAt

A session belongs to one team and one fitness test type.

---

## FitnessTestResult

Represents one player's result in a fitness test session.

Fields:

* id
* fitnessTestSessionId
* playerId
* resultValue
* resultText
* notes
* createdAt
* updatedAt

`resultValue` should be used for numeric comparison and charts.

`resultText` can store display values such as:

* Level 17.2
* Dropped out at stage 8
* Completed
* Injured
* Did not start

A player should only have one result per fitness test session.

---

# Match Models

## Match

Represents a football match.

Fields:

* id
* teamId
* opposition
* matchDate
* venue
* homeAway
* matchType
* ourScore
* oppositionScore
* notes
* createdAt
* updatedAt

Example match types:

* League
* Cup
* Friendly
* Preseason

---

## MatchEventType

Represents a type of match event.

This can be a default event or a custom event.

Default examples:

* Successful pass
* Unsuccessful pass
* Successful dribble
* Unsuccessful dribble
* Shot
* Shot on target
* Goal
* Tackle won
* Interception

Custom examples:

* Forward run
* Press won
* Defensive recovery
* Third-man run
* Cross completed
* Header won

Fields:

* id
* userId
* name
* description
* category
* isPositive
* isDefault
* createdAt
* updatedAt

Example categories:

* Passing
* Dribbling
* Shooting
* Defending
* Goalkeeping
* Physical
* Tactical
* Custom

---

## MatchEvent

Represents one recorded action during a match.

Fields:

* id
* matchId
* playerId
* matchEventTypeId
* timestampSeconds
* notes
* createdAt
* updatedAt

Each event belongs to:

* one match
* one player
* one match event type

---

# Important Design Rules

## Customisation

The system must allow users to create:

* custom fitness test types
* custom match event types

Do not hard-code all tests or events in the UI.

Default tests and event types can be created as seed data.

---

## Ranking Logic

Fitness test rankings must use `higherIsBetter`.

Examples:

* If `higherIsBetter` is true, highest result ranks first.
* If `higherIsBetter` is false, lowest result ranks first.

---

## Historical Tracking

The system must retain historical results.

Do not overwrite old results when a new test session is created.

Progress over time should be calculated by comparing sessions of the same fitness test type.

---

## MVP Database

Use:

* Prisma
* SQLite

Do not use cloud databases for MVP.

---

# Suggested Prisma Models

The final Prisma schema should include:

* User
* Team
* Player
* FitnessTestType
* FitnessTestSession
* FitnessTestResult
* Match
* MatchEventType
* MatchEvent
