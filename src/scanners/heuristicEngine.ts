// Local heuristic engine implementing the CertiK Skill Scanner risk rubric.
// Pure: operates on an in-memory file map so it is deterministic + testable.
// This is the fallback for vet_skill while CertiK has no public API (PRD §0 #7).

import type {
  Finding,
  RiskCategory,
  ScannerVerdict,
  Severity,
  SkillScanResult,
} from "../types.js";

export interface ScanFile {
  path: string;
  content: string;
}

interface Rule {
  category: RiskCategory;
  severity: Severity;
  title: string;
  pattern: RegExp;
  /** Only fire if one of these other categories is also present (e.g. exfil = secrets + network). */
  requires?: RiskCategory;
}

const RULES: Rule[] = [
  // ── shell execution (high) ──
  {
    category: "shell_execution",
    severity: "high",
    title: "Shell / process execution",
    pattern: /\b(child_process|execSync|spawnSync|exec\(|spawn\(|os\.system|subprocess)\b/,
  },
  {
    category: "shell_execution",
    severity: "critical",
    title: "Dynamic code evaluation",
    pattern: /\beval\(|new Function\(|\bvm\.runIn/,
  },
  // ── filesystem misuse (high) ──
  {
    category: "filesystem_misuse",
    severity: "high",
    title: "Filesystem write / delete",
    pattern: /\bfs\.(writeFile|writeFileSync|unlink|rm|rmdir|appendFile|chmod)\b/,
  },
  {
    category: "filesystem_misuse",
    severity: "high",
    title: "Path traversal",
    pattern: /\.\.\/\.\.\/|\/etc\/passwd|\/etc\/shadow/,
  },
  // ── unauthorized network (medium) ──
  {
    category: "unauthorized_network",
    severity: "medium",
    title: "Outbound network call",
    pattern: /\b(fetch\(|axios|https?\.request|net\.connect|XMLHttpRequest|WebSocket\()/,
  },
  // ── data exfiltration (critical) — secrets access; severity escalates if network also present ──
  {
    category: "data_exfiltration",
    severity: "critical",
    title: "Reads secrets / private keys",
    pattern: /process\.env|PRIVATE_KEY|MNEMONIC|SEED_PHRASE|\.ssh\/id_|\.aws\/credentials|wallet\.json/,
  },
  // ── malicious behavior (critical) ──
  {
    category: "malicious_behavior",
    severity: "critical",
    title: "Obfuscation / encoded payload",
    pattern: /atob\(|Buffer\.from\([^,]+,\s*['"]base64['"]\)|(?:\\x[0-9a-fA-F]{2}){6,}/,
  },
  {
    category: "malicious_behavior",
    severity: "high",
    title: "Crypto-miner / suspicious binary fetch",
    pattern: /coinhive|cryptonight|xmrig|miner\.start|curl\s+.*\|\s*(sh|bash)/i,
  },
];

const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
};

const SKIP = /(^|\/)(node_modules|\.git|dist|build|out|cache)(\/|$)/;
const BINARY_EXT = /\.(png|jpe?g|gif|ico|pdf|zip|gz|tar|wasm|woff2?|ttf|mp4|lock)$/i;

/**
 * Run the heuristic rubric over a set of files. Returns a CertiK-shaped result:
 * { score 0-100, scannerVerdict pass|warn|fail, findings[] }.
 */
export function runHeuristicScan(files: ScanFile[]): SkillScanResult {
  const findings: Finding[] = [];
  const seenCategories = new Set<RiskCategory>();

  // First pass: collect raw matches (so `requires` can see all categories).
  const raw: Finding[] = [];
  for (const file of files) {
    if (SKIP.test(file.path) || BINARY_EXT.test(file.path)) continue;
    const lines = file.content.split("\n");
    for (const rule of RULES) {
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i]!)) {
          raw.push({
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            detail: lines[i]!.trim().slice(0, 200),
            file: file.path,
            line: i + 1,
          });
          seenCategories.add(rule.category);
          break; // one finding per rule per file is enough signal
        }
      }
    }
  }

  for (const f of raw) {
    const rule = RULES.find((r) => r.title === f.title && r.category === f.category);
    if (rule?.requires && !seenCategories.has(rule.requires)) continue;
    findings.push(f);
  }

  // Escalate: secrets access + a network call = real exfiltration channel.
  if (seenCategories.has("data_exfiltration") && seenCategories.has("unauthorized_network")) {
    findings.push({
      category: "data_exfiltration",
      severity: "critical",
      title: "Exfiltration channel (secrets + outbound network)",
      detail: "Code both reads secrets and performs outbound network calls.",
    });
  }

  const score = scoreFromFindings(findings);
  const scannerVerdict = verdictFromFindings(score, findings);

  return { score, scannerVerdict, findings, provider: "local-heuristic" };
}

function scoreFromFindings(findings: Finding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function verdictFromFindings(score: number, findings: Finding[]): ScannerVerdict {
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");
  if (hasCritical || score < 50) return "fail";
  if (hasHigh || score < 80) return "warn";
  return "pass";
}
