import { defineChain } from "viem";

/** Pharos Atlantic Testnet — verified specs (PRD §0). */
export const pharosAtlantic = defineChain({
  id: 688689,
  name: "Pharos Atlantic Testnet",
  nativeCurrency: { name: "Pharos", symbol: "PHRS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://atlantic.dplabs-internal.com"] },
  },
  blockExplorers: {
    default: { name: "Pharosscan", url: "https://atlantic.pharosscan.xyz" },
  },
  testnet: true,
});

export const PHAROS_CHAIN_ID = 688689;

/**
 * GoPlus does NOT index 688689 (returns error 2022). It indexes Pharos at
 * 688688. Translate ONLY for GoPlus token_security calls. (PRD §0 #1)
 */
export const GOPLUS_PHAROS_CHAIN_ID = 688688;
