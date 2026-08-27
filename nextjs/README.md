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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## TODOs

- [ ] Fix the loading state. Trigger data fetches on click instead of side effects (hooks).

## Feature Ideas

- [ ] Search for any streets
- [ ] Select part of a street
