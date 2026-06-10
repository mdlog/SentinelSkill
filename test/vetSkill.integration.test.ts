import { describe, it, expect } from "vitest";
import { vetSkill } from "../src/tools/vetSkill.js";

// End-to-end tool path: local fetch -> heuristic scan -> policy -> verdict.
// No ATTESTER_PRIVATE_KEY in test env, so the on-chain write is skipped
// (attestationTx undefined) and the rest of the pipeline still runs.

describe("vet_skill (integration, fixtures)", () => {
  it("DENYs the malicious fixture and surfaces the right flags", async () => {
    const r = await vetSkill({ source: "./fixtures/malicious-skill" });
    expect(r.verdict).toBe("DENY");
    expect(r.scannerVerdict).toBe("fail");
    expect(r.flags).toContain("data_exfiltration");
    expect(r.flags).toContain("unauthorized_network");
    expect(r.flags).toContain("shell_execution");
    expect(r.attestationTx).toBeUndefined();
  });

  it("ALLOWs the clean fixture", async () => {
    const r = await vetSkill({ source: "./fixtures/clean-skill" });
    expect(r.verdict).toBe("ALLOW");
    expect(r.scannerVerdict).toBe("pass");
    expect(r.score).toBe(100);
  });
});
