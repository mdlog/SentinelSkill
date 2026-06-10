// Skill scanner adapter. Selects a provider based on env:
//   - CertikApiScanner  : feature-flagged, used only if CERTIK_SKILL_SCANNER_URL is set.
//   - LocalHeuristicScanner (default): runs the local rubric engine.
// This indirection is the mitigation for "CertiK has no public API" (PRD §0 #7).

import type { SkillScanResult } from "../types.js";
import { fetchSkillFiles } from "./repoFetcher.js";
import { runHeuristicScan } from "./heuristicEngine.js";

export interface SkillScanner {
  readonly name: string;
  scan(source: string): Promise<SkillScanResult>;
}

class LocalHeuristicScanner implements SkillScanner {
  readonly name = "local-heuristic";
  async scan(source: string): Promise<SkillScanResult> {
    const files = await fetchSkillFiles(source);
    return runHeuristicScan(files);
  }
}

/**
 * Feature-flagged real CertiK adapter. INERT until a verified endpoint exists.
 * Do NOT hardcode the unverified HackerNoon "v1 guide" URL here. When CertiK
 * grants access, implement the request against CERTIK_SKILL_SCANNER_URL and
 * normalize the response into SkillScanResult.
 */
class CertikApiScanner implements SkillScanner {
  readonly name = "certik";
  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
  ) {}
  async scan(_source: string): Promise<SkillScanResult> {
    // TODO(certik): POST { source } to this.url with this.apiKey; map
    // { score, verdict: pass|warn|fail, findings[] } -> SkillScanResult.
    throw new Error(
      "CertiK Skill Scanner adapter not implemented — no verified public API. " +
        "Unset CERTIK_SKILL_SCANNER_URL to use the local heuristic engine.",
    );
  }
}

export function getSkillScanner(): SkillScanner {
  const url = process.env.CERTIK_SKILL_SCANNER_URL?.trim();
  if (url) return new CertikApiScanner(url, process.env.CERTIK_API_KEY);
  return new LocalHeuristicScanner();
}
