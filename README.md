# Daybloom

Daybloom is an AI daily planner that turns your to-do list into a realistic, prioritized schedule.

It is a full-stack app built with [Wasp](https://wasp.sh) (React, Node.js, Prisma), based on the
[Open SaaS](https://opensaas.sh) template.

Maintained by Mitchell Gray &lt;godsmilerxiaomin@proton.me&gt;.

## Features

### Planner

| Feature           | Where                    | What it does                                                                                                        |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| AI daily plans    | `/planner`               | Turns your open tasks and available hours into timed, prioritized steps, saved per day                              |
| Progress tracking | `/planner`, `/plans/:id` | Check off steps, run a per-step timer, reorder, edit and add steps                                                  |
| Calendar view     | `/calendar`              | Day and week time grid; drag steps to reschedule them                                                               |
| Plan history      | `/plans`                 | Search past plans, compare two plans side by side, copy a plan to another day                                       |
| Stats             | `/stats`                 | Completion rate, tracked vs planned time, streaks, completion by priority, top tasks                                |
| Recurring tasks   | `/routines`              | Daily, weekday or weekly tasks, added to your list automatically in your own time zone                              |
| Templates         | `/routines`              | Save a set of tasks and add them back to your list in one click                                                     |
| Calendar export   | `/settings`              | Private ICS feed URL for Google Calendar, Apple Calendar and Outlook, plus per-plan `.ics` download                 |
| Reminders         | `/settings`              | Email reminders before each step (background job every 5 minutes) and browser notifications                         |
| Teams             | `/teams`                 | Shared task lists with owners/members, email invites, assignees and due dates; pull shared tasks into your own plan |

### Platform (from Open SaaS)

- **Auth**: email/password with verification and password reset, plus Google, GitHub and Discord sign-in
- **Payments**: subscriptions and one-off credits via Stripe, Lemon Squeezy, Paddle or Polar. AI plans cost one credit without a subscription.
- **Admin dashboard**: user management and analytics (Plausible or Google Analytics)
- **File uploads**: to AWS S3 with presigned URLs
- **Landing page**: prerendered for SEO
- **Blog & docs**: Astro + Starlight
- **Tests**: Vitest unit tests for the planner logic, Playwright end-to-end tests

### Code map

| Module                             | Contents                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `template/app/src/planner`         | Plans, steps, timers, history, stats, calendar pages             |
| `template/app/src/planner/lib`     | Pure, unit-tested logic: dates and time zones, scheduling, stats |
| `template/app/src/recurring`       | Recurring tasks, templates and the hourly job that creates them  |
| `template/app/src/reminders`       | Reminder selection, email content and the reminder job           |
| `template/app/src/calendar-export` | ICS generation and the private calendar feed API                 |
| `template/app/src/settings`        | Planner preferences (time zone, workday start, reminders)        |
| `template/app/src/workspaces`      | Teams, members, invites, shared tasks and permission rules       |

## Repository layout

| Path                 | What it is                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| `template/app`       | The main Wasp web app (this is where you build your product)              |
| `template/blog`      | Blog and docs site (Astro / Starlight)                                    |
| `template/e2e-tests` | Playwright end-to-end tests for the app                                   |
| `opensaas-sh`        | The opensaas.sh site, stored as diffs on top of `template` (see `tools/`) |
| `template-test`      | A test variant of the template, also stored as diffs                      |
| `tools`              | Helper scripts, including `dope.sh` for creating/applying those diffs     |

## Getting started

### Prerequisites

- Node.js `24.22.1` (see `.nvmrc`)
- [Wasp CLI](https://wasp.sh/docs/quick-start) `^0.27.0`. On Windows, Wasp runs inside
  [WSL](https://learn.microsoft.com/windows/wsl/install).
- Docker (used by `wasp start db` to run a local PostgreSQL database)

### Run the app locally

```sh
cd template/app

# 1. Create your env files and fill in the values you need
cp .env.server.example .env.server
cp .env.client.example .env.client

# 2. Start the database (leave it running in its own terminal)
wasp start db

# 3. In a new terminal, apply database migrations (first run, or after schema changes)
wasp db migrate-dev

# 4. Start the app
wasp start
```

The app runs at http://localhost:3000. Emails are not actually sent in development (the `Dummy`
provider is used), so check the server logs for verification and password-reset links.

Optionally seed the database with fake users: `wasp db seed`.

### Tests

```sh
cd template/app
wasp test client run   # Vitest unit tests (src/**/*.test.ts)
```

End-to-end tests live in `template/e2e-tests` (see its README).

### Lint and format

From the repository root:

```sh
npm install
npm run lint            # ESLint
npm run prettier:check  # check formatting
npm run prettier:format # fix formatting
```

## Configuration

- **Admin users**: set `ADMIN_EMAILS` in `template/app/.env.server` (comma-separated). Accounts
  that sign up with these emails get admin access.
- **Email sending**: before going to production, switch the provider in
  `template/app/src/server/emailSender.wasp.ts` to SendGrid, Mailgun or SMTP, and use a sender
  address on a domain you have verified with that provider.
- **Payments**: see the [payment integrations guide](https://docs.opensaas.sh/guides/payment-integrations/).
- **Deployment**: see the [deployment guide](https://docs.opensaas.sh/guides/deploying/).

## Documentation

- [Open SaaS docs](https://docs.opensaas.sh)
- [Wasp docs](https://wasp.sh/docs)

## License

[MIT](LICENSE). Based on [Open SaaS](https://github.com/wasp-lang/open-saas) by Wasp.
