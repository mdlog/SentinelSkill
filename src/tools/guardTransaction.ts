// Mode B: guard_transaction — pre-execution transaction check.
// GoPlus (address + token) -> policy -> attestation -> verdict.

import { inspectTransaction } from "../clients/goplusClient.js";
import { loadPolicy } from "../policy/loader.js";
import { evaluateTransaction } from "../policy/engine.js";
import { toBitmask } from "../flags.js";
import { recordAttestation } from "../clients/chainClient.js";
import type { TxIntent, TxVerdict } from "../types.js";

const POLICY_PATH = process.env.SENTINEL_POLICY_PATH ?? "./policies/default.yaml";

// In-memory daily accumulator (resets on restart — acceptable for MVP demo).
let dailySpentWei = 0n;

export interface GuardTransactionInput {
  chainId: number;
  to: string;
  token?: string;
  value: string;
  calldata?: string;
  policyId?: string;
}

export async function guardTransaction(input: GuardTransactionInput): Promise<TxVerdict> {
  const intent: TxIntent = {
    chainId: input.chainId,
    to: input.to,
    token: input.token,
    value: input.value,
    calldata: input.calldata,
  };

  const goplus = await inspectTransaction(input.to, input.token, input.chainId);
  const policy = loadPolicy(POLICY_PATH);
  const decision = evaluateTransaction(intent, goplus, policy, dailySpentWei);

  // Only count value toward the daily total when the tx is allowed to proceed.
  if (decision.verdict === "ALLOW") {
    try {
      dailySpentWei += BigInt(input.value);
    } catch {
      /* ignore malformed value */
    }
  }

  const attestationTx = await recordAttestation({
    subject: JSON.stringify(intent),
    subjectType: "TRANSACTION",
    verdict: decision.verdict,
    score: 0, // no scanner score for transactions
    flags: toBitmask(decision.flags),
    uri: "",
  });

  return {
    verdict: decision.verdict,
    flags: decision.flags,
    reasons: decision.reasons,
    requiresApproval: decision.requiresApproval,
    attestationTx: attestationTx ?? undefined,
  };
}
