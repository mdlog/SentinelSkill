import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { vetSkill } from "./tools/vetSkill.js";
import { guardTransaction } from "./tools/guardTransaction.js";
import { getAttestation } from "./tools/getAttestation.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "sentinel-skill",
    version: "0.1.0",
  });

  server.registerTool(
    "vet_skill",
    {
      title: "Vet Skill (pre-install)",
      description:
        "Scan a third-party Skill BEFORE installing it. Returns an ALLOW/HOLD/DENY " +
        "verdict from the CertiK 5-category risk rubric (local heuristic engine) + " +
        "the owner's skill_policy, and records an on-chain attestation. Input: a " +
        "GitHub repo URL or a local path.",
      inputSchema: {
        source: z.string().describe("GitHub repo URL or local directory path"),
        policyId: z.string().optional().describe("Policy id (default: 'default')"),
      },
    },
    async ({ source, policyId }) => {
      const result = await vetSkill({ source, policyId });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "guard_transaction",
    {
      title: "Guard Transaction (pre-execution)",
      description:
        "Vet a transaction intent BEFORE broadcasting it. Queries GoPlus address + " +
        "token security, applies the owner's transaction_policy, records an on-chain " +
        "attestation, and returns ALLOW/HOLD/DENY with reasons. Call before any " +
        "transfer, token approval, or payment to another agent.",
      inputSchema: {
        chainId: z.number().int().describe("EVM chain id (Pharos Atlantic = 688689)"),
        to: z.string().describe("Recipient / contract address"),
        token: z.string().optional().describe("Token address; omit for native transfers"),
        value: z.string().describe("Amount in smallest unit (wei), decimal string"),
        calldata: z.string().optional().describe("Transaction calldata (optional)"),
        policyId: z.string().optional(),
      },
    },
    async ({ chainId, to, token, value, calldata, policyId }) => {
      const result = await guardTransaction({ chainId, to, token, value, calldata, policyId });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_attestation",
    {
      title: "Get Attestation (cross-agent reuse)",
      description:
        "Read the latest on-chain SentinelRegistry attestation for a subject " +
        "(a Skill source string, e.g. a GitHub URL, or a tx-intent JSON) WITHOUT " +
        "re-scanning. Lets a second agent reuse a prior ALLOW/HOLD/DENY verdict — " +
        "cross-agent composability. Returns { found: false } if none exists.",
      inputSchema: {
        subject: z
          .string()
          .describe("The Skill source (e.g. GitHub URL) or tx-intent JSON used in the original check"),
      },
    },
    async ({ subject }) => {
      const result = await getAttestation({ subject });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  return server;
}
