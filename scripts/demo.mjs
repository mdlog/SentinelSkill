// SentinelSkill end-to-end demo — runs the 5 PRD §14 scenarios in order.
// Run AFTER `npm run build`:  node --env-file=.env scripts/demo.mjs
//
// Scenarios:
//   1. Malicious Skill        -> vet_skill        -> DENY  (+ on-chain attestation)
//   2. Sanctioned recipient   -> guard_transaction-> DENY  (+ on-chain attestation)
//   3. Green path             -> clean Skill ALLOW + clean tx ALLOW
//   4. Policy toggle          -> same Skill, default ALLOW vs strict HOLD
//   5. Reuse / composability  -> agent #2 reads the registry, no re-scan

import { vetSkill } from "../dist/tools/vetSkill.js";
import { guardTransaction } from "../dist/tools/guardTransaction.js";
import { getSkillScanner } from "../dist/scanners/skillScanner.js";
import { evaluateSkill } from "../dist/policy/engine.js";
import { loadPolicy } from "../dist/policy/loader.js";
import { latestAttestation } from "../dist/clients/chainClient.js";
import { fromBitmask } from "../dist/flags.js";

const EXPLORER = "https://atlantic.pharosscan.xyz";
const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96"; // Ronin/Lazarus exploiter
const CLEAN_ADDR = process.env.ATTESTER_ADDRESS || "0x90351bB1E85a17D5f70c62C0cC076D39D897076D";
const ON_CHAIN_VERDICT = ["ALLOW (PASS)", "HOLD (WARN)", "DENY (FAIL)"];
const SUBJECT_TYPE = ["SKILL", "TRANSACTION"];

const icon = (v) => (v === "ALLOW" ? "✅" : v === "HOLD" ? "⚠️ " : "⛔");
const line = (c = "─") => console.log(c.repeat(64));
function head(n, title) {
  console.log("");
  line("═");
  console.log(`  SCENARIO ${n}  ·  ${title}`);
  line("═");
}
function txLink(tx) {
  return tx ? `${tx}\n     ${EXPLORER}/tx/${tx}` : "(skipped — no chain credentials / funds)";
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("\n  🛡  SentinelSkill — runtime security co-processor for AI agents on Pharos");
  console.log(`  Registry: ${process.env.SENTINEL_REGISTRY_ADDRESS}`);
  console.log(`  ${EXPLORER}/address/${process.env.SENTINEL_REGISTRY_ADDRESS}`);

  // ── 1. Malicious Skill → DENY ──────────────────────────────────────────
  head(1, "Malicious Skill blocked (vet_skill)");
  const s1 = await vetSkill({ source: "./fixtures/malicious-skill" });
  console.log(`  ${icon(s1.verdict)} verdict: ${s1.verdict}   score: ${s1.score}/100   scanner: ${s1.scannerVerdict}`);
  console.log(`  flags: ${s1.flags.join(", ")}`);
  for (const f of s1.findings.slice(0, 3)) console.log(`    • [${f.severity}] ${f.title}${f.file ? ` (${f.file})` : ""}`);
  console.log(`  attestation: ${txLink(s1.attestationTx)}`);

  // ── 2. Sanctioned recipient → DENY ─────────────────────────────────────
  await sleep(3000); // space out on-chain writes (Pharos RPC per-second cap)
  head(2, "Malicious transaction held (guard_transaction)");
  console.log(`  intent: pay ${SANCTIONED}`);
  console.log(`          (Ronin/Lazarus exploiter — OFAC sanctioned)`);
  const s2 = await guardTransaction({ chainId: 688689, to: SANCTIONED, value: "1000000000000000000" });
  console.log(`  ${icon(s2.verdict)} verdict: ${s2.verdict}   requiresApproval: ${s2.requiresApproval}`);
  console.log(`  flags: ${s2.flags.join(", ") || "(none)"}`);
  for (const r of s2.reasons) console.log(`    • ${r}`);
  console.log(`  attestation: ${txLink(s2.attestationTx)}`);

  // ── 3. Green path → ALLOW ──────────────────────────────────────────────
  await sleep(3000);
  head(3, "Green path (clean Skill + clean tx → ALLOW)");
  const s3a = await vetSkill({ source: "./fixtures/clean-skill" });
  console.log(`  clean Skill : ${icon(s3a.verdict)} ${s3a.verdict}   score: ${s3a.score}/100   scanner: ${s3a.scannerVerdict}   attestation: ${s3a.attestationTx ? s3a.attestationTx.slice(0, 18) + "…" : "(skipped)"}`);
  await sleep(3000);
  const s3b = await guardTransaction({ chainId: 688689, to: CLEAN_ADDR, value: "1000000000000000" });
  console.log(`  clean tx    : ${icon(s3b.verdict)} ${s3b.verdict}   (0.001 PHRS to a clean address)   attestation: ${s3b.attestationTx ? s3b.attestationTx.slice(0, 18) + "…" : "(skipped)"}`);

  // ── 4. Policy toggle (no on-chain write) ───────────────────────────────
  head(4, "One policy file flips the verdict (borderline Skill)");
  const scan = await getSkillScanner().scan("./fixtures/borderline-skill");
  const def = evaluateSkill(scan, loadPolicy("./policies/default.yaml"));
  const strict = evaluateSkill(scan, loadPolicy("./policies/strict.yaml"));
  console.log(`  scan: score ${scan.score}/100, scanner ${scan.scannerVerdict}`);
  console.log(`  default policy (min_score 80): ${icon(def.verdict)} ${def.verdict}`);
  console.log(`  strict  policy (min_score 90): ${icon(strict.verdict)} ${strict.verdict}  — ${strict.reasons.join("; ")}`);

  // ── 5. Reuse / composability ───────────────────────────────────────────
  await sleep(3000); // let scenario-1 write settle before the reuse read
  head(5, "Cross-agent reuse (read registry, no re-scan)");
  console.log("  Agent #2 queries the on-chain registry for the malicious Skill...");
  const att = await latestAttestation("./fixtures/malicious-skill");
  if (!att) {
    console.log("  (no attestation found — was scenario 1's write skipped?)");
  } else {
    const v = Number(att.verdict);
    console.log(`  ✓ found prior attestation — no re-scan needed:`);
    console.log(`      subjectType: ${SUBJECT_TYPE[Number(att.subjectType)]}`);
    console.log(`      verdict    : ${ON_CHAIN_VERDICT[v]}`);
    console.log(`      score      : ${Number(att.score)}/100`);
    console.log(`      flags      : ${fromBitmask(Number(att.flags)).join(", ")}`);
    console.log(`      attester   : ${att.attester}`);
  }

  console.log("");
  line("═");
  console.log("  ✔ Demo complete — security is embedded in the agent's flow, recorded on-chain.");
  line("═");
}

main().catch((e) => {
  console.error("demo failed:", e);
  process.exit(1);
});
