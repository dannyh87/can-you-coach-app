# Can You Coach - Current Product Vision

Can You Coach helps grassroots football coaches capture objective player development data without needing enterprise analysis tools.

The current MVP focuses on two practical coaching workflows:

- Fitness testing: record results, rank players, track progress, and export results.
- Match Day: set up a squad, manage minutes/substitutions, record selected events for tracked players, review a completed match report, and export match data.

## Mission

Help coaches answer whether players and teams are improving by giving them a simple way to record measurable information and review it later.

The app is intentionally pragmatic. It is designed for volunteer and grassroots coaches who may be using a phone on the touchline or during training.

## Built MVP Principles

- Simple: avoid deep configuration and keep data entry direct.
- Mobile-first: large buttons and card-based layouts are used throughout live workflows.
- Objective: focus on recorded results, minutes, scores, and events rather than subjective ratings.
- Development-focused: support improvement conversations, not just match outcomes.
- PostgreSQL-backed MVP: Prisma uses PostgreSQL locally and is ready for Vercel with a managed Postgres `DATABASE_URL`.

## Built Product Areas

- Club and team setup.
- Player management.
- Fitness Test Types management, session creation, recording, rankings, progress, completed locked summaries, Reopen for Correction, and CSV downloads.
- Match creation, squad setup, tracking focus, event setup, live match controls, goal controls, substitutions, minutes, completed reports, and CSV downloads.

## Current Users

- Grassroots football coaches.
- Assistant coaches.
- Team managers or volunteers helping with data entry.
- Parents or injured players helping record events for selected players.

## What The MVP Does Not Yet Do

- Production authentication or user roles.
- Parent accounts or portals.
- Payments or subscriptions.
- Video upload or analysis.
- Custom match event definitions.
- AI coaching recommendations.
- Production authentication and multi-user account separation.
- Multi-coach live collaboration.

## Long-Term Direction

The long-term product can grow into player development reporting across fitness, technical, tactical, and match involvement data. The current build establishes the data model and workflows needed to test that direction with real coaches.

## Product Direction: Coaching Development Loop

Can You Coach should not try to compete directly with FA Matchday or Full-Time as a match administration app. Match Day should remain a lightweight coaching observation and review tool, not a duplicate fixture, registration, referee, or league admin system.

The stronger long-term direction is to help coaches turn what they see into what they coach:

Observation -> Training Theme -> Training Block -> Session Plan -> Player/Team Outcomes -> Review

Future feature development should explore Training Blocks and Session Planning using the FA 4 Corner Model:

- Technical/Tactical
- Physical
- Psychological
- Social

Over time, the app should help coaches:

- capture what went well or poorly in a match
- turn observations into a coaching theme
- build a 4-week training block
- design training sessions linked to that theme
- set player and team outcomes
- review whether those outcomes improved over time

This is not part of the current MVP implementation. Match Day should stay lightweight, coaching-focused, and connected to observation and review rather than growing into a full match administration replacement.
