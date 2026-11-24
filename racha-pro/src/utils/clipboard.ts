/** Copia texto para a área de transferência com fallback seguro para navegadores restritivos. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // tenta o fallback abaixo
  }

  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (area && area.parentNode) {
      area.parentNode.removeChild(area);
    }
  }
}
