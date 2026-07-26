# Dependency audit status

Last reviewed: 2026-07-27

The production dependency graph is clean:

```text
npm audit --omit=dev
0 vulnerabilities
```

The complete development graph reports 13 high-severity advisories in two
upstream-only tool chains:

- `eslint@9.39.5`, `eslint-plugin-import@2.32.0`, and
  `eslint-plugin-react@7.37.5` depend on vulnerable `minimatch`/
  `brace-expansion` major lines. npm's suggested changes require ESLint 10 or
  older plugin releases. ESLint 10 is not currently peer-compatible with the
  selected import and React plugins, and the suggested plugin downgrades are
  not viable upgrades.
- `vite-plugin-pwa@1.3.0` depends on `workbox-build@7.4.1`, whose worker build
  chain reaches vulnerable `ejs`/`jake`/`filelist` versions. npm suggests
  downgrading `vite-plugin-pwa` to 1.2.0; there is no newer compatible Workbox
  release available through the latest plugin.

These packages execute during linting or build-time service-worker generation;
none are part of the shipped production dependency graph. Recheck the audit
when ESLint's plugin ecosystem or Workbox publishes compatible forward fixes.

`sql.js` is intentionally pinned to 1.11.0. `jeep-sqlite@2.8.0` embeds the
JavaScript loader produced with sql.js 1.11.0, and loading a 1.14.x WASM binary
against that embedded loader fails during application startup with a WebAssembly
import ABI mismatch. The pin keeps the loader and copied `sql-wasm.wasm` binary
in sync until jeep-sqlite publishes a compatible update.

`npm ci` also installs five optional WASM support packages that npm 10.2.3
reports as extraneous (`@emnapi/core`, `@emnapi/runtime`,
`@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, and `@tybys/wasm-util`). The
clean install is reproducible, and `npm ls` reports no missing or invalid direct
or peer dependency.
