// Thin GoPlus Security API client.
//   - address_security : chain-agnostic, called with the real chainId (688689).
//   - token_security   : chain-gated, called with 688688 for Pharos (PRD §0 #1).
// Free tier: no key, 30 calls/min. We add a tiny client-side throttle + cache.

import type { GoPlusResult } from "../types.js";
import { GOPLUS_PHAROS_CHAIN_ID } from "../chain/pharos.js";

const BASE = process.env.GOPLUS_BASE_URL ?? "https://api.gopluslabs.io/api/v1";
const ACCESS_TOKEN = process.env.GOPLUS_ACCESS_TOKEN?.trim();

const cache = new Map<string, unknown>();
let lastCall = 0;
const MIN_GAP_MS = 2100; // ~28 calls/min, under the 30/min free limit

async function get(path: string): Promise<any> {
  if (cache.has(path)) return cache.get(path);

  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (ACCESS_TOKEN) headers.Authorization = ACCESS_TOKEN;

  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`GoPlus ${path} -> HTTP ${res.status}`);
  const json = await res.json();
  cache.set(path, json);
  return json;
}

/** Map GoPlus chainId for token_security (Pharos 688689 -> 688688). */
function tokenSecurityChainId(chainId: number): number {
  return chainId === 688689 ? GOPLUS_PHAROS_CHAIN_ID : chainId;
}

export async function checkAddress(
  address: string,
  chainId: number,
): Promise<GoPlusResult["address"]> {
  try {
    const json = await get(
      `/address_security/${address.toLowerCase()}?chain_id=${chainId}`,
    );
    const r = json?.result ?? {};
    const flags: string[] = [];
    const on = (k: string) => {
      const v = r[k] === "1";
      if (v) flags.push(k);
      return v;
    };
    const malicious =
      on("blacklist_doubt") ||
      on("stealing_attack") ||
      on("money_laundering") ||
      on("cybercrime") ||
      on("financial_crime") ||
      on("honeypot_related_address") ||
      on("darkweb_transactions");
    const phishing = on("phishing_activities");
    const sanctioned = on("sanctioned");
    return { malicious, phishing, sanctioned, flags };
  } catch {
    // Fail-safe: unknown reputation -> treat as suspicious so policy can HOLD.
    return { malicious: false, phishing: false, sanctioned: false, flags: ["goplus_unavailable"] };
  }
}

export async function checkToken(
  tokenAddress: string,
  chainId: number,
): Promise<GoPlusResult["token"]> {
  const empty: GoPlusResult["token"] = {
    queried: false,
    honeypot: false,
    mintable: false,
    blacklisted: false,
    maxTaxBps: 0,
    flags: [],
  };
  try {
    const gpChain = tokenSecurityChainId(chainId);
    const json = await get(
      `/token_security/${gpChain}?contract_addresses=${tokenAddress.toLowerCase()}`,
    );
    const r = json?.result?.[tokenAddress.toLowerCase()];
    if (!r) return empty; // GoPlus has no data for this token on this (new) chain

    const flags: string[] = [];
    const on = (k: string) => {
      const v = r[k] === "1";
      if (v) flags.push(k);
      return v;
    };
    const honeypot = on("is_honeypot");
    const mintable = on("is_mintable");
    const blacklisted = on("is_blacklisted");
    const maxTaxBps = Math.round(
      Math.max(
        parseTax(r.buy_tax),
        parseTax(r.sell_tax),
        parseTax(r.transfer_tax),
      ) * 10000,
    );
    if (maxTaxBps > 0) flags.push(`tax_${(maxTaxBps / 100).toFixed(2)}pct`);
    return { queried: true, honeypot, mintable, blacklisted, maxTaxBps, flags };
  } catch {
    return empty;
  }
}

export async function inspectTransaction(
  to: string,
  token: string | undefined,
  chainId: number,
): Promise<GoPlusResult> {
  const [address, tokenResult] = await Promise.all([
    checkAddress(to, chainId),
    token ? checkToken(token, chainId) : Promise.resolve(undefinedToken()),
  ]);
  return { address, token: tokenResult };
}

// ── helpers ──
function parseTax(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}
function undefinedToken(): GoPlusResult["token"] {
  return { queried: false, honeypot: false, mintable: false, blacklisted: false, maxTaxBps: 0, flags: [] };
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
