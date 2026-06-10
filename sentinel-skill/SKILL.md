---
name: sentinel-skill
description: >
  Security pre-flight co-processor for AI agents on Pharos. ALWAYS call this
  BEFORE installing any third-party skill (use vet_skill) and BEFORE executing
  any on-chain transaction or payment (use guard_transaction). Returns an
  ALLOW / HOLD / DENY verdict from a local engine implementing CertiK's published
  5-category risk rubric + the live GoPlus address/token security API, applies the
  agent owner's declarative policy, and records an immutable on-chain attestation on Pharos Atlantic
  Testnet. Use whenever the agent is about to add a new capability, transfer
  funds, approve a token, or pay another agent.
license: MIT
---

# SentinelSkill

A meta-Skill that secures other Skills. It is backed by an MCP server (in this
repository) exposing three tools an agent calls before — and after — it acts.

## Tools

### `vet_skill` — pre-install check (Mode A)
Scans a third-party Skill **before** the agent installs it.

- **Input:** `{ source: string (GitHub URL or local path), policyId?: string }`
- **Does:** clones/reads the source, runs the local heuristic engine implementing
  the CertiK 5-category rubric (malicious behavior, data exfiltration,
  unauthorized network activity, shell execution, filesystem misuse), applies the
  `skill_policy`, writes an attestation, returns a verdict.
- **Output:** `{ verdict: ALLOW|HOLD|DENY, score: 0-100, scannerVerdict: pass|warn|fail, flags: string[], findings: [...], attestationTx?: string }`

### `guard_transaction` — pre-execution check (Mode B)
Vets a transaction intent **before** the agent broadcasts it.

- **Input:** `{ chainId: number, to: string, token?: string, value: string, calldata?: string, policyId?: string }`
- **Does:** queries GoPlus address_security (chain-agnostic, uses 688689) and
  token_security (translated to **688688** — GoPlus does not index 688689),
  applies the `transaction_policy`, writes an attestation, returns a verdict.
- **Output:** `{ verdict: ALLOW|HOLD|DENY, flags: string[], reasons: string[], requiresApproval: boolean, attestationTx?: string }`

### `get_attestation` — cross-agent reuse
Reads the latest on-chain attestation for a subject **without re-scanning**, so a
second agent can trust a prior verdict (composability / the Phase-1 → Phase-2 cascade).

- **Input:** `{ subject: string }` — the same Skill source or tx-intent JSON used originally
- **Output:** `{ found: boolean, verdict?, subjectType?, score?, flags?, attester?, timestamp?, uri? }`

## Invocation example
```jsonc
// agent calls vet_skill before installing a Skill:
vet_skill({ "source": "./fixtures/malicious-skill" })
// -> { "verdict": "DENY", "score": 0, "scannerVerdict": "fail",
//      "flags": ["data_exfiltration","unauthorized_network","shell_execution"],
//      "attestationTx": "0x…" }

// a second agent reuses the verdict instead of re-scanning:
get_attestation({ "subject": "./fixtures/malicious-skill" })
// -> { "found": true, "verdict": "DENY", "subjectType": "SKILL", "score": 0, ... }
```

## Running the MCP server
This Skill is powered by the SentinelSkill MCP server in the repository root:

```bash
npm install && npm run build
node dist/index.js          # stdio MCP server (self-loads ../.env)
```

Register it with your agent/host (Claude Code, MCP Inspector) — see the
repository `README.md`. The server exposes `vet_skill`, `guard_transaction`, and `get_attestation`.

## Fail-safe
On scanner/API error or uncertainty the verdict defaults to **HOLD**, never ALLOW.

## Verdict ⇄ on-chain mapping
`ALLOW → PASS`, `HOLD → WARN`, `DENY → FAIL` (SentinelRegistry `Verdict` enum on
Pharos Atlantic Testnet).
