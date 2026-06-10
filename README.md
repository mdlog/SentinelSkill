# SentinelSkill

**Runtime security co-processor & on-chain attestation layer for AI agents on Pharos.**

> *A Skill that secures other Skills.* An MCP server an agent calls **before** it
> installs a third-party Skill or executes an on-chain transaction. It wraps the
> **CertiK Skill Scanner** risk rubric (Skill supply-chain risk) and the
> **GoPlus Security API** (transaction/counterparty risk), applies the owner's
> declarative policy, and writes an immutable **attestation** to Pharos Atlantic.

Built for the **Pharos "Skill-to-Agent Dual Cascade" Hackathon** (DoraHacks).
See [`SentinelSkill-PRD.md`](./SentinelSkill-PRD.md) — read **§0** first (verified
corrections).

---

## Two MCP tools

| Tool | When | Engine | Returns |
|---|---|---|---|
| `vet_skill` | before installing a Skill | CertiK 5-category rubric (local heuristic; CertiK API feature-flagged) | `ALLOW/HOLD/DENY` + score + findings + `attestationTx` |
| `guard_transaction` | before a transfer/approval/payment | GoPlus address + token security | `ALLOW/HOLD/DENY` + reasons + `requiresApproval` + `attestationTx` |

**Fail-safe:** on scanner/API error or uncertainty the verdict defaults to **HOLD**, never ALLOW.
**Verdict ⇄ on-chain:** `ALLOW→PASS`, `HOLD→WARN`, `DENY→FAIL`.

## Repo layout

```
SKILL.md                     agentskills.io Skill manifest
src/
  index.ts                   MCP stdio entry
  server.ts                  registers vet_skill + guard_transaction
  tools/                     orchestration per tool
  scanners/                  repo fetcher, heuristic engine, CertiK adapter
  clients/                   goplusClient (688689→688688), chainClient (attestations)
  policy/                    pure deterministic engine + zod schema + loader
  chain/pharos.ts            viem chain def for Atlantic
  registry/abi.ts            SentinelRegistry ABI
policies/default.yaml        declarative policy
test/                        vitest unit tests (policy + heuristic)
fixtures/                    malicious-skill + clean-skill demo inputs
contracts/                   Foundry: SentinelRegistry.sol + deploy + tests
```

## Quick start (MCP server)

```bash
cp .env.example .env          # fill ATTESTER_PRIVATE_KEY + SENTINEL_REGISTRY_ADDRESS after deploy
npm install
npm test                      # policy + heuristic unit tests (deterministic)
npm run build && npm start    # or: npm run dev
```

Without `ATTESTER_PRIVATE_KEY`/`SENTINEL_REGISTRY_ADDRESS`, tools still return
verdicts — they just skip the on-chain write (`attestationTx` omitted).

## Deploy SentinelRegistry to Pharos Atlantic

```bash
cd contracts
forge install foundry-rs/forge-std   # one-time
cp .env.example .env                 # set ATTESTER_PRIVATE_KEY (faucet-funded)
forge test                           # contract unit tests
forge script script/Deploy.s.sol:Deploy \
  --rpc-url pharos_atlantic --broadcast --private-key $ATTESTER_PRIVATE_KEY
```

Then copy the printed address into the root `.env` `SENTINEL_REGISTRY_ADDRESS`.

- **Get PHRS gas:** faucet (official, Gas.zip, ZAN, Stakely) — ~0.01–0.2 PHRS / 12h, so claim early.
- **Verify (optional):** `forge verify-contract <addr> SentinelRegistry --chain 688689` (Etherscan-style); if that fails, Pharosscan is Blockscout — use `--verifier blockscout --verifier-url https://atlantic.pharosscan.xyz/api`.
- **Respect limits:** 500 RPC req / 5 min, max 64 pending tx/address. Attestation writes are async, one per final verdict.

## Demo scenarios (video deliverable)

1. **Malicious Skill → DENY:** `vet_skill("./fixtures/malicious-skill")` → `fail` (data_exfiltration + unauthorized_network + shell_execution). Show attestation on `atlantic.pharosscan.xyz`.
2. **Malicious tx → DENY:** `guard_transaction` to a GoPlus-flagged address/honeypot.
3. **Green path → ALLOW:** `vet_skill("./fixtures/clean-skill")` + a clean small transfer.
4. **Policy change:** lower `min_score` / tax cap in `policies/default.yaml` → different verdict.
5. **Reuse:** a second agent reads `latest(subjectHash)` from the registry without re-scanning.

## Status & honest notes

- **CertiK Skill Scanner has no public self-serve API** (Jun 2026). `vet_skill` ships
  with a local engine implementing CertiK's published 5-category rubric; the real
  adapter is feature-flagged behind `CERTIK_SKILL_SCANNER_URL` (PRD §0 #7).
- **GoPlus token_security uses chain `688688`** for Pharos (it rejects 688689); the
  on-chain attestation still targets 688689 (PRD §0 #1).
- **Descoped for the window:** USD price oracle (limits are native-unit), IPFS report
  storage (hash + bitmask only), x402 + Anvita Flow (stretch).
- CertiK/GoPlus are the security **standards/data sources** wrapped here — not
  official judges/sponsors of this event (only Pharos is).

## Security posture (it's a security product)

- API keys via env only; `.env` git-ignored; `.env.example` provided.
- Outbound calls only to GoPlus, the Pharos RPC, and (cloned) Skill repos.
- Block decisions are **pure & unit-tested** — never LLM-driven.
- Attestations store **hashes**, not Skill contents or sensitive tx detail.

## License

MIT
