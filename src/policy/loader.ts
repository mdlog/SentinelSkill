import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { PolicySchema, type Policy } from "./types.js";

const cache = new Map<string, Policy>();

/**
 * Load + validate a policy file (YAML or JSON). Cached by path.
 * Throws (caller decides fail-safe) if the file is missing/invalid.
 */
export function loadPolicy(path: string): Policy {
  const cached = cache.get(path);
  if (cached) return cached;

  const raw = readFileSync(path, "utf8");
  const data = parseYaml(raw); // yaml.parse also accepts JSON
  const policy = PolicySchema.parse(data);
  cache.set(path, policy);
  return policy;
}

/** Test/util escape hatch. */
export function clearPolicyCache(): void {
  cache.clear();
}
