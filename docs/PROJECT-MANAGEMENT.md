# Project Management — ClipCrafter

## Overview

We use GitHub-native tools for all project tracking. No external tools (Jira, Linear, Notion, etc.) — everything lives in the repo.

---

## Tools & How We Use Them

### 1. GitHub Issues — Task Tracker

Every piece of work is an issue. Two types:

| Type | Label | Purpose |
|------|-------|---------|
| User Story | `user-story` | Top-level feature from the user's perspective |
| Task / Bug | `feature`, `bug`, `polish` | Concrete dev work, subtask of a user story |

**Rules:**
- User stories are parent issues — they describe *what the user can do*
- Tasks are sub-issues linked under a parent story
- Every bug or feature gets an issue before a branch is created

**Labels in use:**

| Label | Color | Meaning |
|-------|-------|---------|
| `user-story` | Purple | Top-level story |
| `feature` | Blue | New feature |
| `bug` | Red | Something broken |
| `alpha` | Yellow | Required for alpha release |
| `polish` | Grey | UI/UX improvements |
| `billing` | Green | Stripe / Razorpay work |
| `infra` | Blue | Infrastructure / DevOps |
| `large-pr` | Yellow | Bypass PR size check (requires justification comment) |

---

### 2. GitHub Milestones — Release Tracking

Each release has a milestone. Issues tagged `alpha` belong to the **Alpha Release** milestone.

**Current milestones:**
- [Alpha Release](https://github.com/nareshipme/clipcrafter-app/milestone/1) — issues that must be closed before opening to alpha users

**How it works:**
- Closing an issue (via `Fixes #N` in a PR) auto-decrements the milestone counter
- Milestone shows `X/Y closed` — that's your progress bar

---

### 3. GitHub Projects (Board) — Kanban View

Board: https://github.com/users/nareshipme/projects/1

Used for a visual overview of work in flight. Same issues, different view.

**Columns (Status):**
- `Todo` — not started
- `In Progress` — actively being worked on
- `Done` — merged / closed

**Custom field (Type):**
- `User Story` — parent stories (purple)
- `Task` — dev tasks and bugs

**How to use:**
- Group by **Type** to see stories vs tasks separately
- Sub-issues progress is visible on each story card
- Move cards manually as work progresses

---

### 4. Branches & PRs — The Workflow

```
main (protected)
  └── feat/issue-title    ← one branch per issue
  └── fix/issue-title
  └── chore/description
```

**Branch naming:** `feat/`, `fix/`, `chore/`, `polish/` + short description

**Commit message format:**
```
feat: short description (Fixes #N)
fix: short description (Fixes #N)
```

`Fixes #N` in the commit or PR body auto-closes the issue when the PR merges into `main`.

**PR rules (enforced by branch protection):**
- Must be a PR — no direct pushes to `main`
- CI must pass: `typecheck` + `lint` + `pr-size`
- PR size limit: 1000 lines (use `large-pr` label + justification to bypass)
- 1 review required — repo owner can bypass via Ruleset bypass

---

### 5. CI Pipeline — GitHub Actions

File: `.github/workflows/ci.yml`

| Job | What it checks |
|-----|---------------|
| `typecheck` | `tsc --noEmit` — zero type errors |
| `lint` | Prettier format + ESLint zero errors |
| `pr-size` | Max 1000 lines changed (skip with `large-pr` label) |

Triggers: `pull_request` (opened, sync, reopened, labeled) + `push` to `main`

---

### 6. Pre-push Hooks — Local Gates

Husky runs checks before every `git push`:
1. TypeScript check
2. Prettier format check
3. ESLint (warnings OK, errors block)

This catches issues before CI does, saving round trips.

---

## Day-to-Day Workflow

```
1. Pick an issue from the Alpha milestone (or create one)
2. git checkout main && git pull origin main
3. git checkout -b feat/short-description
4. Write code, commit with "feat: ... (Fixes #N)"
5. git push origin feat/short-description
6. Open PR → CI runs → review → merge
7. Issue auto-closes, milestone progress updates
8. Board card moves to Done
```

---

## Current Alpha Status

See live progress: https://github.com/nareshipme/clipcrafter-app/milestone/1

| # | Story | Status |
|---|-------|--------|
| #9 | Upload / YouTube URL → get clips | 🔄 In progress (#3 dedup — PR #14) |
| #10 | Review & export clips | ✅ Done |
| #11 | Manage projects | 🔲 Todo (#7 error handling) |
| #12 | Subscribe to a plan | 🔲 Todo (#4 Stripe billing) |
| #13 | Discover & sign up | 🔲 Todo (#5 Landing page) |
