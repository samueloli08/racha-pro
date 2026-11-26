const SAFE_HEX_RE = /^#[0-9a-f]{6}$/i;

export function safeHexColor(hex: string, fallback = '#34d399'): string {
  return SAFE_HEX_RE.test(hex) ? hex : fallback;
}
