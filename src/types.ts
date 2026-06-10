// Shared types across SentinelSkill.

/** Owner-facing verdict returned by both MCP tools. */
export type Verdict = "ALLOW" | "HOLD" | "DENY";

/** CertiK-style verdict returned by the Skill scanner layer. */
export type ScannerVerdict = "pass" | "warn" | "fail";

export type Severity = "critical" | "high" | "medium" | "low";

/** Risk category keys (mirror the bitmask in flags.ts). */
export type RiskCategory =
  | "malicious_behavior"
  | "data_exfiltration"
  | "unauthorized_network"
  | "shell_execution"
  | "filesystem_misuse"
  | "malicious_address"
  | "honeypot_token"
  | "high_tax_token"
  | "unlimited_approval"
  | "sanctioned_address";

export interface Finding {
  category: RiskCategory;
  severity: Severity;
  title: string;
  detail: string;
  file?: string;
  line?: number;
}

/** Normalized output of any Skill scanner (CertiK adapter or local heuristic). */
export interface SkillScanResult {
  score: number; // 0..100
  scannerVerdict: ScannerVerdict;
  findings: Finding[];
  provider: "certik" | "local-heuristic";
}

/** Transaction intent passed to guard_transaction. */
export interface TxIntent {
  chainId: number;
  to: string;
  token?: string;
  value: string; // smallest unit, decimal string
  calldata?: string;
}

/** Normalized GoPlus result consumed by the policy engine. */
export interface GoPlusResult {
  address: {
    malicious: boolean;
    phishing: boolean;
    sanctioned: boolean;
    flags: string[]; // raw GoPlus field names that tripped
  };
  token: {
    queried: boolean; // false if no token / chain unsupported / no data
    honeypot: boolean;
    mintable: boolean;
    blacklisted: boolean;
    maxTaxBps: number; // max(buy, sell, transfer) tax in basis points
    flags: string[];
  };
}

export interface SkillVerdict {
  verdict: Verdict;
  score: number;
  scannerVerdict: ScannerVerdict;
  flags: RiskCategory[];
  findings: Finding[];
  attestationTx?: string;
}

export interface TxVerdict {
  verdict: Verdict;
  flags: RiskCategory[];
  reasons: string[];
  requiresApproval: boolean;
  attestationTx?: string;
}
