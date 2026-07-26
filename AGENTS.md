# AGENTS

## Building

- In the sandbox, prefer `npm run build -- --configLoader native` for production builds and `npm run build:pwa -- --configLoader native` for PWA builds.
- Use the plain build commands only when explicitly requested or when the native config loader cannot cover the required verification.

## Testing

- Codex should prefer `npm run test:sandbox -- ...` for test execution in this repository.
- Use `npm test -- ...` only if the user explicitly requests it or there is a clear reason `test:sandbox` cannot cover the needed case.
