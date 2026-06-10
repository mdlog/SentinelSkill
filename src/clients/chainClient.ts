// Writes attestations to SentinelRegistry on Pharos Atlantic and reads the
// latest verdict for a subject (reuse / composability). On-chain write is the
// SLOW path: one tx per final verdict, retryable, never blocks the tool reply.
// If ATTESTER_PRIVATE_KEY / SENTINEL_REGISTRY_ADDRESS are unset, writes are
// skipped (tool still returns a verdict; attestationTx is undefined).

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pharosAtlantic } from "../chain/pharos.js";
import {
  SENTINEL_REGISTRY_ABI,
  SubjectType,
  verdictToOnChain,
} from "../registry/abi.js";
import type { Verdict } from "../types.js";

const RPC = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";

function registryAddress(): Address | null {
  const a = process.env.SENTINEL_REGISTRY_ADDRESS?.trim();
  if (!a || /^0x0+$/.test(a)) return null;
  return getAddress(a);
}

function attester() {
  const pk = process.env.ATTESTER_PRIVATE_KEY?.trim();
  if (!pk) return null;
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const wallet = createWalletClient({ account, chain: pharosAtlantic, transport: http(RPC) });
  const pub = createPublicClient({ chain: pharosAtlantic, transport: http(RPC) });
  return { account, wallet, pub };
}

/** keccak256 of an arbitrary subject string (skill source or tx intent JSON). */
export function subjectHash(subject: string): Hex {
  return keccak256(toHex(subject));
}

export interface AttestationInput {
  subject: string; // raw source/intent — hashed on-chain, not stored
  subjectType: keyof typeof SubjectType; // "SKILL" | "TRANSACTION"
  verdict: Verdict;
  score: number; // 0..100 (skills); 0 for tx
  flags: number; // uint32 bitmask
  uri?: string;
}

/**
 * Record an attestation. Returns the tx hash, or null when the write is skipped
 * (missing key/address) or fails — callers treat null as "not attested".
 */
export async function recordAttestation(input: AttestationInput): Promise<Hex | null> {
  const addr = registryAddress();
  const signer = attester();
  if (!addr || !signer) return null;

  try {
    // Pin a legacy gas price at/above the live network price. viem's auto
    // EIP-1559 estimate can lag the live base fee and leave txs stuck
    // underpriced (Pharos Atlantic runs ~10 gwei); bump 25% for headroom.
    const base = await withRetry(() => signer.pub.getGasPrice(), "gas price");
    const gasPrice = (base * 125n) / 100n;

    const hash = await withRetry(
      () =>
        signer.wallet.writeContract({
          address: addr,
          abi: SENTINEL_REGISTRY_ABI,
          functionName: "recordAttestation",
          args: [
            subjectHash(input.subject),
            SubjectType[input.subjectType],
            verdictToOnChain(input.verdict),
            input.score,
            input.flags,
            input.uri ?? "",
          ],
          gasPrice,
        }),
      "attestation write",
    );

    // Confirm it actually mined — surfaces reverts and prevents the next write
    // from queueing behind an unmined nonce.
    const receipt = await withRetry(
      () => signer.pub.waitForTransactionReceipt({ hash, timeout: 60_000 }),
      "confirm receipt",
    );
    if (receipt.status !== "success") throw new Error(`attestation tx reverted (${hash})`);
    return hash;
  } catch (err) {
    console.error("[chainClient] attestation write failed:", (err as Error).message);
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry transient RPC throttling (Pharos caps 500 req/5min + a per-second limit). */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let delay = 1500;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const throttled = /too fast|cu limit|rate.?limit|429|exceeded|timeout/i.test(msg);
      if (i === attempts - 1 || !throttled) throw err;
      console.error(`[chainClient] ${label} throttled — retry ${i + 1}/${attempts - 1} in ${delay}ms`);
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

/** Read the latest attestation for a subject (reuse before re-scanning). */
export async function latestAttestation(subject: string) {
  const addr = registryAddress();
  const signer = attester();
  const pub = signer?.pub ?? createPublicClient({ chain: pharosAtlantic, transport: http(RPC) });
  if (!addr) return null;
  try {
    return await pub.readContract({
      address: addr,
      abi: SENTINEL_REGISTRY_ABI,
      functionName: "latest",
      args: [subjectHash(subject)],
    });
  } catch {
    return null; // no prior attestation
  }
}
