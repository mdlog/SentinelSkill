import { describe, it, expect } from "vitest";
import { evaluateSkill, evaluateTransaction } from "../src/policy/engine.js";
import { PolicySchema, type Policy } from "../src/policy/types.js";
import type { GoPlusResult, SkillScanResult, TxIntent } from "../src/types.js";

const policy: Policy = PolicySchema.parse({
  policyId: "test",
  skill_policy: { min_score: 80, block_on_severity: ["critical", "high"], allow_warn: false },
  transaction_policy: {
    block_malicious_address: true,
    block_sanctioned_address: true,
    block_phishing_address: true,
    block_honeypot: true,
    max_transfer_tax_bps: 1000,
    per_tx_limit_wei: "500",
    daily_limit_wei: "2000",
    require_human_approval_above_wei: "1000",
  },
  escalation: { on_hold: "hold", approver: "" },
});

function scan(p: Partial<SkillScanResult>): SkillScanResult {
  return { score: 100, scannerVerdict: "pass", findings: [], provider: "local-heuristic", ...p };
}
function gp(p: Partial<GoPlusResult["address"]> = {}, t: Partial<GoPlusResult["token"]> = {}): GoPlusResult {
  return {
    address: { malicious: false, phishing: false, sanctioned: false, flags: [], ...p },
    token: { queried: false, honeypot: false, mintable: false, blacklisted: false, maxTaxBps: 0, flags: [], ...t },
  };
}
const intent = (value: string, token?: string): TxIntent => ({ chainId: 688689, to: "0xabc", value, token });

describe("evaluateSkill", () => {
  it("ALLOWs a clean high-score skill", () => {
    expect(evaluateSkill(scan({}), policy).verdict).toBe("ALLOW");
  });

  it("DENYs on scanner fail", () => {
    expect(evaluateSkill(scan({ scannerVerdict: "fail", score: 30 }), policy).verdict).toBe("DENY");
  });

  it("DENYs when a critical finding is present", () => {
    const d = evaluateSkill(
      scan({
        score: 60,
        findings: [{ category: "data_exfiltration", severity: "critical", title: "x", detail: "y" }],
      }),
      policy,
    );
    expect(d.verdict).toBe("DENY");
    expect(d.flags).toContain("data_exfiltration");
  });

  it("HOLDs when score below min but no blocking finding", () => {
    expect(evaluateSkill(scan({ score: 70, scannerVerdict: "warn" }), policy).verdict).toBe("HOLD");
  });
});

describe("evaluateTransaction", () => {
  it("ALLOWs a clean small transfer", () => {
    expect(evaluateTransaction(intent("100"), gp(), policy).verdict).toBe("ALLOW");
  });

  it("DENYs a malicious recipient", () => {
    const d = evaluateTransaction(intent("100"), gp({ malicious: true }), policy);
    expect(d.verdict).toBe("DENY");
    expect(d.flags).toContain("malicious_address");
  });

  it("DENYs a sanctioned recipient", () => {
    expect(evaluateTransaction(intent("100"), gp({ sanctioned: true }), policy).verdict).toBe("DENY");
  });

  it("DENYs a honeypot token", () => {
    const d = evaluateTransaction(intent("100", "0xtok"), gp({}, { queried: true, honeypot: true }), policy);
    expect(d.verdict).toBe("DENY");
  });

  it("HOLDs when transfer tax exceeds the cap", () => {
    const d = evaluateTransaction(intent("100", "0xtok"), gp({}, { queried: true, maxTaxBps: 1200 }), policy);
    expect(d.verdict).toBe("HOLD");
    expect(d.flags).toContain("high_tax_token");
  });

  it("HOLDs + requiresApproval above the approval threshold", () => {
    const d = evaluateTransaction(intent("1500"), gp(), policy);
    expect(d.verdict).toBe("HOLD");
    expect(d.requiresApproval).toBe(true);
  });

  it("HOLDs when over the per-tx limit", () => {
    expect(evaluateTransaction(intent("600"), gp(), policy).verdict).toBe("HOLD");
  });

  it("fail-safe: GoPlus reputation unavailable -> HOLD (never silent ALLOW)", () => {
    const d = evaluateTransaction(intent("100"), gp({ flags: ["goplus_unavailable"] }), policy);
    expect(d.verdict).toBe("HOLD");
    expect(d.reasons.join(" ")).toMatch(/unavailable/i);
  });

  it("HOLDs + flags an unlimited ERC-20 approval from calldata", () => {
    const calldata = "0x095ea7b3" + "0".repeat(64) + "f".repeat(64); // approve(spender, MAX)
    const d = evaluateTransaction({ chainId: 688689, to: "0xabc", value: "0", calldata }, gp(), policy);
    expect(d.verdict).toBe("HOLD");
    expect(d.flags).toContain("unlimited_approval");
  });

  it("does NOT flag a bounded approval", () => {
    const calldata = "0x095ea7b3" + "0".repeat(64) + "0".repeat(62) + "64"; // approve(spender, 100)
    const d = evaluateTransaction({ chainId: 688689, to: "0xabc", value: "0", calldata }, gp(), policy);
    expect(d.flags).not.toContain("unlimited_approval");
  });

  it("is deterministic (same inputs -> same verdict)", () => {
    const a = evaluateTransaction(intent("600"), gp(), policy);
    const b = evaluateTransaction(intent("600"), gp(), policy);
    expect(a).toEqual(b);
  });
});
