const MAX_DEPTH = 32;

/**
 * JSON.stringify com chaves ordenadas, limite de profundidade e proteção contra ciclos.
 * O Postgres (jsonb) reordena as chaves, então comparar estados exige serialização estável.
 */
export function stableStringify(value: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (depth > MAX_DEPTH) return '"[max-depth]"';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (seen.has(value)) return '"[circular]"';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((v) => stableStringify(v, depth + 1, seen)).join(',')}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k], depth + 1, seen)}`)
      .join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}
