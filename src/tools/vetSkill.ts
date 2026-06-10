// Mode A: vet_skill — pre-install Skill check.
// scan (CertiK rubric / local heuristic) -> policy -> attestation -> verdict.

import { getSkillScanner } from "../scanners/skillScanner.js";
import { loadPolicy } from "../policy/loader.js";
import { evaluateSkill } from "../policy/engine.js";
import { toBitmask } from "../flags.js";
import { recordAttestation } from "../clients/chainClient.js";
import type { SkillVerdict } from "../types.js";

const POLICY_PATH = process.env.SENTINEL_POLICY_PATH ?? "./policies/default.yaml";

export interface VetSkillInput {
  source: string;
  policyId?: string;
}

export async function vetSkill(input: VetSkillInput): Promise<SkillVerdict> {
  const scanner = getSkillScanner();

  let scan;
  try {
    scan = await scanner.scan(input.source);
  } catch (err) {
    // Fail-safe: cannot scan -> HOLD, never ALLOW. (PRD §11)
    return {
      verdict: "HOLD",
      score: 0,
      scannerVerdict: "warn",
      flags: [],
      findings: [
        {
          category: "malicious_behavior",
          severity: "medium",
          title: "Scan failed",
          detail: `Could not scan source: ${(err as Error).message}`,
        },
      ],
    };
  }

  const policy = loadPolicy(POLICY_PATH);
  const decision = evaluateSkill(scan, policy);

  const attestationTx = await recordAttestation({
    subject: input.source,
    subjectType: "SKILL",
    verdict: decision.verdict,
    score: scan.score,
    flags: toBitmask(decision.flags),
    uri: "",
  });

  return {
    verdict: decision.verdict,
    score: scan.score,
    scannerVerdict: scan.scannerVerdict,
    flags: decision.flags,
    findings: decision.findings,
    attestationTx: attestationTx ?? undefined,
  };
}
