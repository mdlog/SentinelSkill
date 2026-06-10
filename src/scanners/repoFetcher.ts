// Fetches a Skill source into an in-memory file list for the heuristic engine.
// Supports: local directory path, or a GitHub URL (shallow clone). ZIP = stretch.

import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import type { ScanFile } from "./heuristicEngine.js";

const exec = promisify(execFile);

const MAX_FILES = 2000;
const MAX_BYTES = 512 * 1024; // skip files larger than 512KB
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "out", "cache"]);

/** Resolve a `source` (local path or GitHub URL) into a list of text files. */
export async function fetchSkillFiles(source: string): Promise<ScanFile[]> {
  if (isLocalPath(source)) {
    return readDir(source, source);
  }
  if (isGitHubUrl(source)) {
    const dir = mkdtempSync(join(tmpdir(), "sentinel-scan-"));
    try {
      await exec("git", ["clone", "--depth", "1", "--quiet", source, dir], {
        timeout: 60_000,
      });
      return readDir(dir, dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  throw new Error(`Unsupported source: ${source} (expected local path or GitHub URL)`);
}

function isLocalPath(s: string): boolean {
  return s.startsWith("/") || s.startsWith("./") || s.startsWith("../");
}
function isGitHubUrl(s: string): boolean {
  return /^https?:\/\/(www\.)?github\.com\//.test(s) || s.startsWith("git@github.com:");
}

function readDir(dir: string, root: string, acc: ScanFile[] = []): ScanFile[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (acc.length >= MAX_FILES) break;
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      readDir(join(dir, entry.name), root, acc);
    } else if (entry.isFile()) {
      const full = join(dir, entry.name);
      try {
        if (statSync(full).size > MAX_BYTES) continue;
        // relative() normalizes a leading "./" that join() would otherwise strip,
        // so nested paths report correctly (e.g. scripts/optimize.js, not ripts/...).
        acc.push({ path: relative(root, full), content: readFileSync(full, "utf8") });
      } catch {
        // unreadable / binary — skip
      }
    }
  }
  return acc;
}
