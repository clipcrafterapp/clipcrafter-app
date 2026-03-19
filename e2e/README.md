# E2E Tests (BDD-style with Playwright)

Tests are written in BDD style using Feature/Scenario/Given/When/Then.

## Running Tests
- `npm run test:e2e` — run all E2E tests
- `npm run test:e2e:ui` — run with Playwright UI

## Structure
Each feature area has its own file:
- `auth.spec.ts` — authentication flows
- `dashboard.spec.ts` — dashboard features
- `upload.spec.ts` — video upload flows
- `processing.spec.ts` — video processing
