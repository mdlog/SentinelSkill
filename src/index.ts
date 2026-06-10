#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

// Self-load .env from the project root (one level up from dist/ or src/) so the
// server works whether launched via `npm run dev`, `start`, or spawned by an MCP
// client (which does NOT pass --env-file). No-op if there is no .env — the
// client may inject env directly. Requires Node >=20.12 (process.loadEnvFile).
try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), "..", ".env"));
} catch {
  /* no .env file, or env provided by the launcher */
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers communicate over stdio — log to stderr only.
  console.error("[sentinel-skill] MCP server ready (vet_skill, guard_transaction)");
}

main().catch((err) => {
  console.error("[sentinel-skill] fatal:", err);
  process.exit(1);
});
