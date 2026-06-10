// Minimal ABI for SentinelRegistry (see contracts/src/SentinelRegistry.sol).

export const SENTINEL_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectHash", type: "bytes32" },
      { name: "subjectType", type: "uint8" },
      { name: "verdict", type: "uint8" },
      { name: "score", type: "uint16" },
      { name: "flags", type: "uint32" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "latest",
    stateMutability: "view",
    inputs: [{ name: "subjectHash", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "subjectHash", type: "bytes32" },
          { name: "subjectType", type: "uint8" },
          { name: "verdict", type: "uint8" },
          { name: "score", type: "uint16" },
          { name: "flags", type: "uint32" },
          { name: "attester", type: "address" },
          { name: "timestamp", type: "uint64" },
          { name: "uri", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "count",
    stateMutability: "view",
    inputs: [{ name: "subjectHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AttestationRecorded",
    inputs: [
      { name: "subjectHash", type: "bytes32", indexed: true },
      { name: "subjectType", type: "uint8", indexed: true },
      { name: "verdict", type: "uint8", indexed: false },
      { name: "score", type: "uint16", indexed: false },
      { name: "flags", type: "uint32", indexed: false },
      { name: "attester", type: "address", indexed: true },
    ],
  },
] as const;

/** enum SubjectType { SKILL, TRANSACTION } */
export const SubjectType = { SKILL: 0, TRANSACTION: 1 } as const;

/** enum Verdict { PASS, WARN, FAIL } — maps from ALLOW/HOLD/DENY. */
export const OnChainVerdict = { PASS: 0, WARN: 1, FAIL: 2 } as const;

export function verdictToOnChain(v: "ALLOW" | "HOLD" | "DENY"): number {
  return v === "ALLOW" ? OnChainVerdict.PASS : v === "HOLD" ? OnChainVerdict.WARN : OnChainVerdict.FAIL;
}
