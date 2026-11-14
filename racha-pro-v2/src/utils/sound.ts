type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (sharedCtx) return sharedCtx;
    const AudioCtx = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Navegadores móveis só liberam áudio após um toque do usuário.
 * Chame esta função dentro de um clique (ex.: botão Iniciar) para o apito tocar depois.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
}

/** Gera um apito duplo sintetizado usando Web Audio API (zero dependência externa). */
export function playRefWhistle(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;

    const triggerBlast = (startTime: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const masterGain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2850, startTime);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(3100, startTime);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(42, startTime);
      lfoGain.gain.setValueAtTime(140, startTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      masterGain.gain.setValueAtTime(0.001, startTime);
      masterGain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.03);
      masterGain.gain.setValueAtTime(0.35, startTime + duration - 0.05);
      masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc1.connect(masterGain);
      osc2.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      lfo.start(startTime);

      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
      lfo.stop(startTime + duration);
    };

    triggerBlast(now, 0.35);
    triggerBlast(now + 0.45, 0.7);
  } catch {
    // Ignora silenciosamente se o navegador bloquear áudio
  }
}

/** Alerta curto e suave (dois "bips") quando falta 1 minuto para o fim. */
export function playOneMinuteWarning(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;

    const beep = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, startTime);
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    };

    beep(now);
    beep(now + 0.3);
  } catch {
    // ignora
  }
}

/** Vibração (quando suportada pelo aparelho). */
export function vibratePattern(pattern: number[]): void {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // ignora
  }
}

/** Fim de partida: apito + vibração. */
export function signalMatchEnd(): void {
  playRefWhistle();
  vibratePattern([200, 100, 200]);
}
