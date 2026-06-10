import { z } from "zod";

export const SkillPolicySchema = z.object({
  min_score: z.number().min(0).max(100).default(80),
  block_on_severity: z
    .array(z.enum(["critical", "high", "medium", "low"]))
    .default(["critical", "high"]),
  allow_warn: z.boolean().default(false),
});

export const TransactionPolicySchema = z.object({
  value_unit: z.literal("native_wei").default("native_wei"),
  block_malicious_address: z.boolean().default(true),
  block_sanctioned_address: z.boolean().default(true),
  block_phishing_address: z.boolean().default(true),
  block_honeypot: z.boolean().default(true),
  max_transfer_tax_bps: z.number().int().min(0).default(1000),
  // Limits in the native token's smallest unit (wei). Decimal strings to keep
  // bigint precision through YAML/JSON. (USD oracle descoped — PRD §0.)
  per_tx_limit_wei: z.string().default("0"),
  daily_limit_wei: z.string().default("0"),
  require_human_approval_above_wei: z.string().default("0"),
});

export const EscalationSchema = z.object({
  on_hold: z.enum(["hold", "deny", "warn"]).default("hold"),
  approver: z.string().default(""),
});

export const PolicySchema = z.object({
  policyId: z.string().default("default"),
  skill_policy: SkillPolicySchema.default({}),
  transaction_policy: TransactionPolicySchema.default({}),
  escalation: EscalationSchema.default({}),
});

export type Policy = z.infer<typeof PolicySchema>;
export type SkillPolicy = z.infer<typeof SkillPolicySchema>;
export type TransactionPolicy = z.infer<typeof TransactionPolicySchema>;
