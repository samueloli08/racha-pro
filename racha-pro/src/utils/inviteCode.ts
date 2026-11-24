const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_REGEX = /^[A-Z0-9]{6,16}$/;

/** Normaliza um código digitado pelo usuário (remove espaços/hífens e coloca em caixa alta). */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().replace(/[\s-]+/g, '').toUpperCase();
}

export function isValidInviteCode(raw: string): boolean {
  return INVITE_CODE_REGEX.test(normalizeInviteCode(raw));
}

/**
 * Gera um código curto no formato RCH + 6 caracteres sem ambiguidade (30 bits de entropia,
 * ex.: RCH4K92X7). Usa crypto.getRandomValues com alfabeto de 32 símbolos (sem viés de módulo).
 */
export function generateInviteCode(suffixLength = 6): string {
  const bytes = new Uint8Array(suffixLength);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < suffixLength; i++) {
    suffix += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return `RCH${suffix}`;
}
