# Can You Coach - UI Design

## Purpose

This document defines the intended user experience and screen layouts for the MVP.

The application should prioritise speed, simplicity and usability.

Most users will be coaches using a mobile phone while coaching, managing players or conducting fitness testing.

The UI should be designed mobile-first.

---

# Design Principles

## Fast

Users should be able to record information quickly.

Reduce the number of taps wherever possible.

---

## Simple

Avoid unnecessary screens and configuration.

The app should feel intuitive without training.

---

## Mobile First

All MVP screens must work well on:

* Mobile phones
* Tablets

Desktop support is desirable but secondary.

---

## Large Touch Targets

Buttons should be easy to press on a touchline.

Avoid small icons where possible.

---

## Consistent Navigation

Navigation should remain consistent throughout the application.

---

# Main Navigation

Bottom navigation bar:

```text
Dashboard
Players
Fitness
Matches
Settings
```

---

# Dashboard Screen

Purpose:

Provide a quick overview of activity.

Display:

* Total players
* Total teams
* Recent fitness tests
* Recent matches
* Quick actions

Quick Action Buttons:

* Add Player
* Create Fitness Test
* Create Match

---

# Players Screen

Purpose:

Manage players.

Display:

* Search bar
* Player list
* Active players only by default

Each player card displays:

* Name
* Squad number
* Position

Actions:

* View
* Edit
* Archive

Floating action button:

```text
+ Add Player
```

---

# Player Profile Screen

Display:

* Player details
* Fitness history
* Match statistics
* Recent activity

Tabs:

```text
Overview
Fitness
Matches
```

Overview should be the default tab.

---

# Fitness Screen

Purpose:

Manage fitness testing.

Display:

* Recent test sessions
* Test history
* Rankings
* Quick actions

Buttons:

```text
Create Test Session
View Rankings
```

---

# Create Fitness Test Session Screen

Step 1:

Select:

* Team
* Test Type
* Date

Step 2:

Select players

Default:

All active players selected

Step 3:

Enter results

Display:

```text
Player Name
Result Field
```

Large input fields.

Fast data entry.

---

# Fitness Rankings Screen

Purpose:

Compare player performance.

Filters:

* Team
* Test Type
* Date Range

Display:

Ranking table

Example:

```text
1 Tom Jones      1140m
2 Jack Smith     1090m
3 Ben Taylor     1030m
```

---

# Fitness Progress Screen

Purpose:

Show player improvement.

Display:

* Best result
* Latest result
* Improvement amount

Charts:

* Line chart

Example:

```text
May      980m
June    1080m
July    1140m
```

---

# Matches Screen

Purpose:

Manage matches.

Display:

* Upcoming matches
* Previous matches

Actions:

```text
Create Match
Track Match
```

---

# Create Match Screen

Fields:

* Team
* Opposition
* Match Date
* Venue
* Match Type
* Home/Away

Button:

```text
Create Match
```

---

# Match Tracking Screen

Purpose:

Allow rapid event recording during a match.

Display:

Current Match

Player List

Event Buttons

Example:

```text
Pass +
Pass -

Dribble +
Dribble -

Shot

Goal

Tackle

Interception
```

Buttons should be large and easy to press.

Each action should require no more than:

1. Select Player
2. Tap Event

---

# Match Event Configuration Screen

Purpose:

Manage custom event types.

Users can:

* Create custom event
* Edit custom event
* Archive custom event

Fields:

* Name
* Category
* Positive / Negative
* Description

---

# Settings Screen

Purpose:

Manage system configuration.

Sections:

## Clubs

* Create Club
* Edit Club

## Teams

* Create Team
* Edit Team

## Fitness Test Types

* Create custom test type

## Match Event Types

* Create custom event type

---

# MVP UI Rules

Always prefer:

* Fewer screens
* Fewer clicks
* Larger buttons
* Simpler forms

Avoid:

* Complex workflows
* Pop-up overload
* Hidden navigation
* Enterprise-style admin screens

The application should feel like a coaching tool, not business software.
