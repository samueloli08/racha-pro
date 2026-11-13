export interface ShareCardRow {
  name: string;
  goals: number;
  assists: number;
  total: number;
}

export interface ShareCardData {
  heading: string;
  dateLabel: string;
  matches: number;
  totalGoals: number;
  podium: ShareCardRow[];
  topScorer: ShareCardRow | null;
  topAssist: ShareCardRow | null;
}

const W = 1080;
const H = 1920;
const FONT = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Reduz a fonte até o texto caber na largura máxima. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight: string
): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && size > 18) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight: string,
  color: string
): void {
  fitFont(ctx, text, maxWidth, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function renderShareCard(data: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#09090b');
  bg.addColorStop(0.55, '#0b1f19');
  bg.addColorStop(1, '#064e3b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Linhas de campo (decorativas)
  ctx.strokeStyle = 'rgba(16,185,129,0.10)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W / 2, H - 260, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(60, H - 260);
  ctx.lineTo(W - 60, H - 260);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';

  // Cabeçalho
  ctx.textAlign = 'center';
  ctx.font = `900 64px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('⚽ RACHA', W / 2 - 70, 170);
  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'left';
  const rachaW = ctx.measureText('⚽ RACHA').width;
  ctx.fillText('PRO', W / 2 - 70 + rachaW / 2 + 4, 170);

  drawCentered(ctx, data.heading.toUpperCase(), W / 2, 235, 900, 34, '700', '#a1a1aa');
  drawCentered(ctx, data.dateLabel, W / 2, 285, 900, 30, '500', '#71717a');

  const mvp = data.podium[0] ?? null;

  if (!mvp) {
    drawCentered(ctx, 'Nenhum gol registrado ainda', W / 2, 900, 900, 46, '700', '#e4e4e7');
  } else {
    // MVP
    roundRectPath(ctx, 90, 360, W - 180, 430, 48);
    const mvpBg = ctx.createLinearGradient(0, 360, 0, 790);
    mvpBg.addColorStop(0, 'rgba(16,185,129,0.28)');
    mvpBg.addColorStop(1, 'rgba(16,185,129,0.06)');
    ctx.fillStyle = mvpBg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(52,211,153,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    drawCentered(ctx, '👑 MVP DO RACHA', W / 2, 440, 860, 40, '800', '#fbbf24');
    drawCentered(ctx, mvp.name, W / 2, 575, 860, 112, '900', '#ffffff');
    drawCentered(
      ctx,
      `${mvp.goals} gol(s) • ${mvp.assists} assist.`,
      W / 2,
      665,
      860,
      46,
      '700',
      '#6ee7b7'
    );
    drawCentered(ctx, `G+A: ${mvp.total}`, W / 2, 740, 860, 40, '800', '#a7f3d0');

    // Pódio (2º - 1º - 3º)
    const slots: { row: ShareCardRow | undefined; height: number; medal: string; color: string }[] = [
      { row: data.podium[1], height: 300, medal: '🥈', color: '#a1a1aa' },
      { row: data.podium[0], height: 400, medal: '🥇', color: '#fbbf24' },
      { row: data.podium[2], height: 230, medal: '🥉', color: '#d97706' },
    ];
    const barW = 290;
    const gap = 22;
    const startX = (W - (barW * 3 + gap * 2)) / 2;
    const baseY = 1420;

    slots.forEach((slot, i) => {
      if (!slot.row) return;
      const x = startX + i * (barW + gap);
      const y = baseY - slot.height;
      roundRectPath(ctx, x, y, barW, slot.height, 28);
      const barGrad = ctx.createLinearGradient(0, y, 0, baseY);
      barGrad.addColorStop(0, 'rgba(255,255,255,0.16)');
      barGrad.addColorStop(1, 'rgba(255,255,255,0.04)');
      ctx.fillStyle = barGrad;
      ctx.fill();
      ctx.strokeStyle = slot.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.font = `64px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(slot.medal, x + barW / 2, y - 100);
      drawCentered(ctx, firstName(slot.row.name), x + barW / 2, y - 30, barW - 10, 44, '800', '#ffffff');

      drawCentered(ctx, String(slot.row.total), x + barW / 2, y + 120, barW - 20, 100, '900', slot.color);
      drawCentered(ctx, 'G+A', x + barW / 2, y + 170, barW - 20, 30, '700', '#a1a1aa');
      if (slot.height > 260) {
        drawCentered(
          ctx,
          `${slot.row.goals}G • ${slot.row.assists}A`,
          x + barW / 2,
          y + 225,
          barW - 20,
          32,
          '600',
          '#d4d4d8'
        );
      }
    });
  }

  // Resumo
  roundRectPath(ctx, 90, 1500, W - 180, 110, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  drawCentered(
    ctx,
    `🏟️ ${data.matches} jogo(s)  •  ⚽ ${data.totalGoals} gol(s)`,
    W / 2,
    1572,
    900,
    44,
    '800',
    '#ffffff'
  );

  // Destaques
  if (data.topScorer && data.topScorer.goals > 0) {
    drawCentered(
      ctx,
      `🥅 Artilheiro: ${data.topScorer.name} (${data.topScorer.goals})`,
      W / 2,
      1690,
      900,
      38,
      '700',
      '#fde68a'
    );
  }
  if (data.topAssist && data.topAssist.assists > 0) {
    drawCentered(
      ctx,
      `👟 Garçom: ${data.topAssist.name} (${data.topAssist.assists})`,
      W / 2,
      1750,
      900,
      38,
      '700',
      '#bae6fd'
    );
  }

  drawCentered(ctx, 'Gerado via RachaPro ⚡', W / 2, 1860, 900, 30, '600', '#71717a');

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
