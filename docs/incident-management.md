# Incident Management

How we detect, respond to, and learn from incidents at ClipCrafter.

---

## Detection Layers

### Layer 1: Automated Health Checks
**OpenClaw cron** polls `/api/health` every 30 minutes. If status is not `ok`, Naresh gets a WhatsApp alert instantly.

`GET /api/health` checks:
- **Supabase** — can query the projects table
- **R2** — bucket is accessible
- **Railway worker** — `/api/health` responds 200

Response shape:
```json
{
  "status": "ok|degraded|down",
  "timestamp": "2026-03-29T07:30:00.000Z",
  "version": "abc1234",
  "checks": {
    "supabase": { "status": "ok", "latencyMs": 45 },
    "r2": { "status": "ok", "latencyMs": 120 },
    "worker": { "status": "ok", "latencyMs": 230 }
  }
}
```

### Layer 2: Inngest Failed Job Alerts
Inngest webhooks `POST /api/webhooks/inngest-alerts` on every `inngest/function.failed` event.
→ Triggers WhatsApp alert with function name, run ID, error message, and direct Inngest link.

**Setup:** Configure in [Inngest dashboard](https://app.inngest.com) → Manage → Webhooks:
- URL: `https://toolnexus-app.vercel.app/api/webhooks/inngest-alerts`
- Event: `inngest/function.failed`
- Set `INNGEST_ALERT_WEBHOOK_SECRET` env var on Vercel (any random string)

### Layer 3: Vercel Deploy Alerts
Configure in Vercel dashboard → Project Settings → Git → Deploy Notifications.
Set email or webhook for failed deployments.

### Layer 4: E2E Tests on Every PR
GitHub Actions runs Playwright tests on every push to main and every PR.
Failed tests block merge and upload a Playwright HTML report as an artifact.

---

## Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P0 | Complete outage — nothing works | Immediate | Supabase down, Vercel deploy broke prod |
| P1 | Core feature broken | < 1 hour | Export pipeline failing, upload returns 500 |
| P2 | Partial degradation | < 4 hours | Knowledge graph not rendering, batch export bug |
| P3 | Minor / cosmetic | Next session | UI glitch, wrong label |

---

## Response Playbook

### P0 — Complete Outage
1. Check `/api/health` → identify which service is down
2. Check Vercel deployment list — did a bad deploy cause it?
   - If yes: `vercel rollback` from Vercel dashboard
3. Check Railway worker logs: `railway logs --service clipcrafter-app`
4. Check Supabase dashboard for DB issues
5. Once resolved: write post-mortem (see template below)

### P1 — Core Feature Broken
1. Check Inngest dashboard for failed runs — get the error
2. Check Vercel function logs for the relevant API route
3. Reproduce locally → fix → open PR with `fix:` prefix
4. Add regression test to the relevant E2E spec
5. Log in bug-log.md

### P2/P3 — Partial Degradation
1. Open GitHub issue with `bug` label
2. Tag with correct milestone
3. Fix in normal sprint flow

---

## Post-Mortem Template

Add to `docs/bug-log.md` for any P0/P1 incident:

```markdown
## YYYY-MM-DD — <title>

**Severity:** P0 / P1
**Duration:** HH:MM (detected at X, resolved at Y)
**Impact:** What users/features were affected

**Symptom:** What we saw / how it was detected

**Root cause:** Why it happened

**Fix:** What we changed

**Files:** List of changed files

**Prevention:** What we're adding to stop recurrence
(test added? monitoring improved? guard added?)

**Post-worthy:** Yes/No
```

---

## Useful Commands

```bash
# Check prod health
curl https://toolnexus-app.vercel.app/api/health | jq

# Check Railway worker health
curl https://clipcrafter-app-production-9647.up.railway.app/api/health | jq

# View Railway logs
railway logs --service clipcrafter-app --tail

# Rollback Vercel deploy
vercel rollback

# List recent Inngest runs (via dashboard)
open https://app.inngest.com/env/production/functions

# Run E2E tests locally
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui
```

---

## Env Vars Required

| Var | Where | Purpose |
|-----|-------|---------|
| `INNGEST_ALERT_WEBHOOK_SECRET` | Vercel + Railway | Signs Inngest webhook payloads |
| `OPENCLAW_GATEWAY_URL` | Vercel + Railway | OpenClaw gateway for WhatsApp alerts |
| `OPENCLAW_GATEWAY_TOKEN` | Vercel + Railway | Auth token for OpenClaw gateway |
| `RAILWAY_WORKER_URL` | Vercel | Worker URL for health check |
