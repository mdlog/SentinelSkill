// Read-only: fetch the latest on-chain SentinelRegistry attestation for a
// subject (a Skill source string or a tx-intent JSON) WITHOUT re-scanning.
// This is the cross-agent reuse / composability primitive — a second agent can
// trust a prior ALLOW/HOLD/DENY verdict instead of re-running the check.

import { latestAttestation } from "../clients/chainClient.js";
import { fromBitmask } from "../flags.js";
import type { RiskCategory, Verdict } from "../types.js";

// SentinelRegistry.Verdict enum -> owner-facing verdict (PASS/WARN/FAIL).
const ON_CHAIN_VERDICT: Verdict[] = ["ALLOW", "HOLD", "DENY"];
const SUBJECT_TYPE = ["SKILL", "TRANSACTION"] as const;

export interface GetAttestationInput {
  subject: string; // the SAME source string or tx-intent JSON used originally
}

export interface AttestationView {
  found: boolean;
  verdict?: Verdict;
  subjectType?: string;
  score?: number;
  flags?: RiskCategory[];
  attester?: string;
  timestamp?: number;
  uri?: string;
}

export async function getAttestation(
  input: GetAttestationInput,
): Promise<AttestationView> {
  const att = await latestAttestation(input.subject);
  if (!att) return { found: false };
  return {
    found: true,
    verdict: ON_CHAIN_VERDICT[Number(att.verdict)],
    subjectType: SUBJECT_TYPE[Number(att.subjectType)],
    score: Number(att.score),
    flags: fromBitmask(Number(att.flags)),
    attester: att.attester,
    timestamp: Number(att.timestamp),
    uri: att.uri,
  };
}
