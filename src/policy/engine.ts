// Pure, deterministic policy engine. NO LLM, NO I/O, NO randomness — block
// decisions must be reproducible and unit-testable (PRD §11).

import type {
  Finding,
  GoPlusResult,
  RiskCategory,
  SkillScanResult,
  TxIntent,
  Verdict,
} from "../types.js";
import type { Policy } from "./types.js";

export interface SkillDecision {
  verdict: Verdict;
  flags: RiskCategory[];
  findings: Finding[];
  reasons: string[];
}

export interface TxDecision {
  verdict: Verdict;
  flags: RiskCategory[];
  reasons: string[];
  requiresApproval: boolean;
}

/** Mode A: evaluate a Skill scan result against skill_policy. */
export function evaluateSkill(
  scan: SkillScanResult,
  policy: Policy,
): SkillDecision {
  const p = policy.skill_policy;
  const reasons: string[] = [];
  const flags = unique(scan.findings.map((f) => f.category));

  const blockingSeverities = new Set(p.block_on_severity);
  const hasBlockingFinding = scan.findings.some((f) =>
    blockingSeverities.has(f.severity),
  );

  let verdict: Verdict = "ALLOW";

  if (scan.scannerVerdict === "fail") {
    verdict = "DENY";
    reasons.push("scanner verdict = fail");
  }
  if (hasBlockingFinding) {
    verdict = "DENY";
    reasons.push(
      `finding at blocked severity (${[...blockingSeverities].join("/")})`,
    );
  }
  if (verdict !== "DENY" && scan.score < p.min_score) {
    verdict = "HOLD";
    reasons.push(`score ${scan.score} < min_score ${p.min_score}`);
  }
  if (verdict === "ALLOW" && scan.scannerVerdict === "warn" && !p.allow_warn) {
    verdict = "HOLD";
    reasons.push("scanner verdict = warn and allow_warn = false");
  }

  return { verdict, flags, findings: scan.findings, reasons };
}

/** Mode B: evaluate a transaction intent + GoPlus result against transaction_policy. */
export function evaluateTransaction(
  intent: TxIntent,
  goplus: GoPlusResult,
  policy: Policy,
  dailySpentWei: bigint = 0n,
): TxDecision {
  const p = policy.transaction_policy;
  const reasons: string[] = [];
  const flags: RiskCategory[] = [];
  let deny = false;
  let hold = false;

  // ── Address-level (hard blocks) ──
  if (p.block_malicious_address && goplus.address.malicious) {
    flags.push("malicious_address");
    deny = true;
    reasons.push("recipient flagged malicious by GoPlus");
  }
  if (p.block_phishing_address && goplus.address.phishing) {
    flags.push("malicious_address");
    deny = true;
    reasons.push("recipient flagged phishing by GoPlus");
  }
  if (p.block_sanctioned_address && goplus.address.sanctioned) {
    flags.push("sanctioned_address");
    deny = true;
    reasons.push("recipient is sanctioned");
  }

  // ── Token-level ──
  if (goplus.token.queried) {
    if (p.block_honeypot && goplus.token.honeypot) {
      flags.push("honeypot_token");
      deny = true;
      reasons.push("token is a honeypot");
    }
    if (goplus.token.maxTaxBps > p.max_transfer_tax_bps) {
      flags.push("high_tax_token");
      hold = true;
      reasons.push(
        `transfer tax ${bpsToPct(goplus.token.maxTaxBps)} > max ${bpsToPct(
          p.max_transfer_tax_bps,
        )}`,
      );
    }
  }

  // ── Value limits (native-unit, USD oracle descoped) ──
  const value = safeBigInt(intent.value);
  const perTx = safeBigInt(p.per_tx_limit_wei);
  const daily = safeBigInt(p.daily_limit_wei);
  const approvalAbove = safeBigInt(p.require_human_approval_above_wei);

  if (perTx > 0n && value > perTx) {
    hold = true;
    reasons.push(`value ${intent.value} > per_tx_limit ${p.per_tx_limit_wei}`);
  }
  if (daily > 0n && dailySpentWei + value > daily) {
    hold = true;
    reasons.push(`daily spend would exceed daily_limit ${p.daily_limit_wei}`);
  }

  let requiresApproval = false;
  if (approvalAbove > 0n && value > approvalAbove) {
    requiresApproval = true;
    hold = true;
    reasons.push(
      `value ${intent.value} > require_human_approval_above ${p.require_human_approval_above_wei}`,
    );
  }

  // ── Escalation policy for HOLD ──
  if (hold && !deny && policy.escalation.on_hold === "deny") {
    deny = true;
    reasons.push("escalation.on_hold = deny");
  }

  const verdict: Verdict = deny ? "DENY" : hold ? "HOLD" : "ALLOW";
  return { verdict, flags: unique(flags), reasons, requiresApproval };
}

// ── helpers ──
function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
function safeBigInt(s: string): bigint {
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}
