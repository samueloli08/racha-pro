/**
 * Gera um apito duplo sintetizado usando Web Audio API (zero dependência externa).
 */
export function playRefWhistle(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
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
    // Ignora silenciosamente se o navegador bloquear áudio antes de interação
  }
}
