This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/Map.tsx`. The page auto-updates as you edit the file.

## Tests

Use Node 24, install dependencies, and run the test suite once:

```bash
nvm use
yarn install --frozen-lockfile
yarn test
```

For local watch mode, run `yarn test:watch`.

Tests use Vitest with jsdom, React Testing Library, and `user-event`. Pure
TypeScript utility tests and React component interaction tests run locally and
must not connect to the remote database. Mock database and API boundaries when a
test needs data.

## Crash summary JSON

`GET /map/api/crash-summary` publishes the summary for any valid version-1
bookmarkable query in production. Pass the same query string used by `/map`:

```text
/map/api/crash-summary?v=1&tool=radius&from=2025-01-01&to=2025-12-31&lat=39.7392&lng=-104.9903&radiusFeet=500
```

The Docker deployment configures the Next.js base path as `/map`. When running
the Next.js app locally without that base path, the same handler is available at
`/api/crash-summary`.

The endpoint supports `radius`, `street`, and `draw` queries. Its response
includes the validated query and a versioned summary with total crashes, crash
and person counts by KABCO severity, bicyclists and pedestrians involved, and
the existing comprehensive-cost estimate. The endpoint is read-only, uses the
same PostGIS crash APIs and summary rules as the interactive report, and returns
HTTP 400 with an `error` string for an invalid query.

The `peopleByInjurySeverity.noInjuryPropertyDamage` field follows the existing
report behavior: CDOT supplies person counts, while a Denver-only crash without
a fatality or serious injury contributes one conservative fallback count.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## TODOs

- [ ] Fix the loading state. Trigger data fetches on click instead of side effects (hooks).

## Feature Ideas

- [ ] Search for any streets
- [ ] Select part of a street
