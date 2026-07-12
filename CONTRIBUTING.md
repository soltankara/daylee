# Contributing to Daylee

Thanks for your interest! Daylee is a personal-scope task tracker — deliberately
single-user, local-first, and small. Bug fixes and focused improvements are welcome;
for anything larger (new views, sync backends, multi-user ideas), please open an issue
first so we can discuss whether it fits the project's scope.

## Development setup

Requires Node.js 20+.

```bash
npm install
npm run dev       # dev server
npm test          # unit + component tests (Vitest)
npm run build     # type-check (tsc -b) + production build
```

## Before opening a PR

- `npm test` and `npm run build` must both be green — CI runs exactly these.
- TypeScript strict mode, no `any`. Named exports only (default export only for `App`).
- Pure logic goes in `src/lib/` with unit tests next to it (`foo.ts` + `foo.test.ts`);
  components stay thin.
- Reuse design tokens from `src/styles/tokens.css` — never hard-code colors.
- See `CLAUDE.md` for the code map and testing patterns (e.g. `MemoryStorage` and the
  `resetStore` pattern for component tests).

## Ground rules

- No analytics, no trackers, no third-party network calls at runtime (fonts excepted).
- All data stays in the browser (IndexedDB) — no server-side code.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
