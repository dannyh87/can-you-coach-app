# Can You Coach - MVP Scope

## Purpose

The MVP exists to prove that coaches will record measurable player actions and find value in reviewing the resulting data.

The MVP is not intended to be a complete coaching platform.

Success is defined by coaches being able to:

* Create players
* Create matches
* Record actions during matches
* Review data afterwards
* Identify development trends

---

# In Scope

## Authentication

Users can:

* Create an account
* Sign in
* Sign out

Simple email and password authentication is sufficient.

---

## Teams

Users can:

* Create a team
* Edit a team
* Delete a team

A team contains:

* Team name
* Age group
* Season

---

## Players

Users can:

* Add players
* Edit players
* Remove players

Player fields:

* First name
* Surname
* Preferred position
* Squad number

---

## Matches

Users can:

* Create matches
* Record opposition
* Record date
* Record venue
* Record final score

Match types:

* League
* Cup
* Friendly

---

## Match Tracking

Users can track actions during a match.

Initial tracked actions:

* Successful pass
* Unsuccessful pass
* Successful dribble
* Unsuccessful dribble
* Shot
* Shot on target
* Goal
* Tackle won
* Interception

Each event records:

* Player
* Event type
* Timestamp
* Match

---

## Dashboards

### Player Dashboard

Show:

* Total events
* Per match averages
* Trends over time

### Team Dashboard

Show:

* Team totals
* Team averages
* Match comparisons


## Fitness Testing

Users can create fitness testing sessions.

A testing session contains:

* Test type
* Date
* Notes

Supported MVP tests:

* Yo-Yo Test
* Gacon Test
* Bronco Test
* Custom Test

Users can record a result for each player.

Examples:

* Distance achieved
* Level reached
* Time completed
* Stage reached

The system should store historical results.

---

## Fitness Dashboard

Show:

* Best result
* Latest result
* Improvement over time
* Team ranking
* Historical trend

Users should be able to compare players within the same test.

Examples:

* Gacon rankings
* Yo-Yo rankings
* Bronco rankings

Charts should display performance changes across multiple testing dates.

---

## Charts

Use simple charts only.

Examples:

* Bar charts
* Line charts

Avoid complex visualisations.

---

## Data Storage

Use:

* Prisma
* SQLite

Database must run locally.

No cloud database required.

---

# Out Of Scope

The following must NOT be built for MVP.

## Premium Features

Do not build:

* Payments
* Subscriptions
* Stripe integration

---

## Parent Accounts

Do not build:

* Parent login
* Parent portals

---

## Assistant Coaches

Do not build:

* Multi-user collaboration

---

## Video

Do not build:

* Video upload
* Video analysis
* Video storage

---

## AI Features

Do not build:

* Recommendations
* Session generation
* Coaching advice

---

## Notifications

Do not build:

* Email notifications
* Push notifications

---

## Mobile Apps

Do not build:

* iOS app
* Android app

Use responsive web design only.

---

## Benchmarking

Do not build:

* Age-group benchmarks
* Comparison against national averages

---

## Training Sessions

Do not build:

* Session planning
* Training tracking
* Session libraries

---

# Definition Of Done

The MVP is complete when a coach can:

1. Create a team
2. Add players
3. Create a match
4. Track actions during a match
5. Review player statistics
6. Review team statistics

Nothing else is required before initial testing.
