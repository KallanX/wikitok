# WikiTok frontend

React, TypeScript, and Vite app. Setup, Docker, and the reverse proxy live in the [repository README](../README.md).

```bash
bun install
bun run dev
bun run test
bun run build
```

`bun run dev` serves the Vite app. Production containers run `server.ts`, which adds the security headers and rate limit.
