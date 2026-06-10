---
name: sentinel-skill
description: >
  Security pre-flight co-processor for AI agents on Pharos. ALWAYS call this
  BEFORE installing any third-party skill (use vet_skill) and BEFORE executing
  any on-chain transaction or payment (use guard_transaction). Returns an
  ALLOW / HOLD / DENY verdict based on the CertiK Skill Scanner risk rubric +
  GoPlus address/token security data, applies the agent owner's declarative
  policy, and records an immutable on-chain attestation on Pharos Atlantic
  Testnet. Use whenever the agent is about to add a new capability, transfer
  funds, approve a token, or pay another agent.
---

# SentinelSkill

A meta-Skill that secures other Skills. It exposes an MCP server with two tools.

> **Note (agentskills.io):** the spec requires `name` to match the parent folder
> name. When publishing this as a standalone Skill, place this file in a folder
> named `sentinel-skill/`. In this repo it sits at root for convenience.

## Tools

### `vet_skill` — pre-install check (Mode A)
Scans a third-party Skill **before** the agent installs it.

- **Input:** `{ source: string (GitHub URL or local path), policyId?: string }`
- **Does:** clones/reads the source, runs the local heuristic engine implementing
  the CertiK 5-category rubric (malicious behavior, data exfiltration,
  unauthorized network activity, shell execution, filesystem misuse), applies the
  `skill_policy`, writes an attestation, and returns a verdict.
- **Output:** `{ verdict: ALLOW|HOLD|DENY, score: 0-100, scannerVerdict: pass|warn|fail, flags: string[], findings: [...], attestationTx?: string }`

### `guard_transaction` — pre-execution check (Mode B)
Vets a transaction intent **before** the agent broadcasts it.

- **Input:** `{ chainId: number, to: string, token?: string, value: string, calldata?: string, policyId?: string }`
- **Does:** queries GoPlus address_security (chain-agnostic, uses 688689) and
  token_security (translated to **688688** — GoPlus does not index 688689),
  applies the `transaction_policy`, writes an attestation, returns a verdict.
- **Output:** `{ verdict: ALLOW|HOLD|DENY, flags: string[], reasons: string[], requiresApproval: boolean, attestationTx?: string }`

## Fail-safe
On scanner/API error or uncertainty the verdict defaults to **HOLD**, never ALLOW.

## Verdict ⇄ on-chain mapping
`ALLOW → PASS`, `HOLD → WARN`, `DENY → FAIL` (SentinelRegistry `Verdict` enum).
