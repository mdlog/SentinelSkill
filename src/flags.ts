import type { RiskCategory } from "./types.js";

/**
 * Risk category bitmask — matches PRD §10.5.
 * Bits 0-4: CertiK Skill-level. Bits 5-9: GoPlus transaction-level.
 */
export const RISK_BIT: Record<RiskCategory, number> = {
  malicious_behavior: 1 << 0,
  data_exfiltration: 1 << 1,
  unauthorized_network: 1 << 2,
  shell_execution: 1 << 3,
  filesystem_misuse: 1 << 4,
  malicious_address: 1 << 5,
  honeypot_token: 1 << 6,
  high_tax_token: 1 << 7,
  // NOTE: bit 8 (unlimited_approval) is NOT available from GoPlus token_security.
  // It requires /token_approval_security or a static calldata check. Kept for
  // completeness; not set by the MVP guard_transaction path. (PRD §0 #2)
  unlimited_approval: 1 << 8,
  sanctioned_address: 1 << 9,
};

/** Build a uint32 bitmask from a list of categories. */
export function toBitmask(categories: RiskCategory[]): number {
  return categories.reduce((mask, c) => mask | RISK_BIT[c], 0) >>> 0;
}

/** Decode a uint32 bitmask back into category keys. */
export function fromBitmask(mask: number): RiskCategory[] {
  return (Object.keys(RISK_BIT) as RiskCategory[]).filter(
    (c) => (mask & RISK_BIT[c]) !== 0,
  );
}
