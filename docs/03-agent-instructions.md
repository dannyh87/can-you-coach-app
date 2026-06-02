# Can You Coach - Agent Instructions

## Purpose

You are building the MVP version of Can You Coach.

Your goal is to create a simple, maintainable application that can be used by grassroots football coaches.

Do not attempt to build enterprise-grade solutions.

Do not add features that are not explicitly requested.

Always favour simplicity over complexity.

---

# Technology Stack

Use:

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* Prisma
* SQLite
* Recharts

Do not replace these technologies without approval.

---

# Database

Use Prisma with SQLite.

Database should be stored locally.

Create migrations using Prisma.

Create seed data where useful.

Do not use:

* AWS
* Azure
* Google Cloud
* MongoDB
* Firebase
* Supabase

unless specifically requested.

---

# Design Principles

The application is mobile-first.

Primary users will often be standing on the touchline using a phone.

Large buttons are preferred.

Fast data entry is preferred.

Reduce the number of clicks required wherever possible.

---

# User Experience

Optimise for:

1. Speed
2. Simplicity
3. Readability

Avoid:

* Complex menus
* Deep navigation structures
* Excessive configuration

---

# Code Standards

Use TypeScript throughout.

Use reusable components.

Keep files reasonably small.

Avoid unnecessary abstraction.

Avoid premature optimisation.

Use clear naming conventions.

---

# Charts

Use Recharts.

Supported chart types:

* Line charts
* Bar charts

Do not introduce advanced chart libraries.

---

# MVP Priorities

Highest Priority:

1. Players
2. Fitness Testing
3. Fitness Dashboards

Second Priority:

4. Teams
5. Matches
6. Match Tracking

Third Priority:

7. Player Analytics
8. Team Analytics

---

# Fitness Testing Requirements

The fitness testing module is a core MVP feature.

Support:

* Gacon Test
* Yo-Yo Test
* Bronco Test
* Custom Tests

Users must be able to:

* Create test sessions
* Enter player results
* View rankings
* View improvement over time

Historical results must be retained.

---

# Future Features

The following are planned future features but must not be implemented yet:

* Payments
* Subscriptions
* Parent accounts
* Video analysis
* AI recommendations
* Training session plans
* Notifications
* Mobile apps

Only create architecture that allows future expansion.

Do not build future features now.

---

# Development Philosophy

The product should be built iteratively.

A working simple feature is better than a perfect unfinished feature.

Deliver working functionality first.

Refine later.
