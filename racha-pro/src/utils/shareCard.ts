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
const SANS = '"Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

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

function topRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Desenha o símbolo oficial R + bola no bojo em coordenadas 64x64 escaladas. */
function drawBrandGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  strokeWidth = 6
): void {
  const scale = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Haste vertical + bojo do R
  ctx.beginPath();
  ctx.moveTo(21, 50);
  ctx.lineTo(21, 14);
  ctx.lineTo(32, 14);
  ctx.arc(32, 26, 12, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(21, 38);
  ctx.stroke();

  // Perna diagonal do R
  ctx.beginPath();
  ctx.moveTo(31, 38);
  ctx.lineTo(43, 50);
  ctx.stroke();

  // Bola no bojo
  ctx.beginPath();
  ctx.arc(32, 26, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Desenha a coroa vetorial do MVP (sem emoji). */
function drawCrown(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const scale = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(3, 18);
  ctx.lineTo(5, 7);
  ctx.lineTo(10, 12);
  ctx.lineTo(12, 4);
  ctx.lineTo(14, 12);
  ctx.lineTo(19, 7);
  ctx.lineTo(21, 18);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight: string,
  family: string
): number {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 24) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function sanitizeCanvasText(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight: string,
  color: string,
  family = SANS
): void {
  let text = sanitizeCanvasText(rawText);
  fitFont(ctx, text, maxWidth, size, weight, family);
  if (ctx.measureText(text).width > maxWidth && text.length > 1) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
      text = text.slice(0, -1);
    }
    text = `${text.trimEnd()}…`;
  }
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

  // 1. Fundo Gramado + Brilho Lima superior (fiel ao artboard Card de Stories)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#090D0B');
  bg.addColorStop(0.7, '#0B1A10');
  bg.addColorStop(1, '#10260F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, -160, 40, W / 2, 120, 820);
  glow.addColorStop(0, 'rgba(132, 204, 22, 0.28)');
  glow.addColorStop(0.65, 'rgba(132, 204, 22, 0.06)');
  glow.addColorStop(1, 'rgba(132, 204, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H * 0.65);

  ctx.textBaseline = 'alphabetic';

  // 2. Lockup da Marca no Topo: [Tile R] racha [PRO]
  const tileSize = 76;
  const gap1 = 20;
  const gap2 = 16;

  ctx.font = `800 60px ${SANS}`;
  const rachaW = ctx.measureText('racha').width;
  ctx.font = `800 24px ${MONO}`;
  const proTextW = ctx.measureText('PRO').width;
  const proPadX = 14;
  const proW = proTextW + proPadX * 2;
  const proH = 40;

  const lockupW = tileSize + gap1 + rachaW + gap2 + proW;
  const lockupX = (W - lockupW) / 2;
  const topY = 112;

  // Tile lima
  roundRectPath(ctx, lockupX, topY, tileSize, tileSize, 24);
  const tileGrad = ctx.createLinearGradient(lockupX, topY, lockupX + tileSize, topY + tileSize);
  tileGrad.addColorStop(0, '#D9F99D');
  tileGrad.addColorStop(1, '#84CC16');
  ctx.fillStyle = tileGrad;
  ctx.fill();
  drawBrandGlyph(ctx, lockupX + 11, topY + 11, 54, '#10160A', 6);

  // Wordmark "racha"
  ctx.font = `800 60px ${SANS}`;
  ctx.fillStyle = '#F7FAEF';
  ctx.textAlign = 'left';
  ctx.fillText('racha', lockupX + tileSize + gap1, topY + 58);

  // Badge "PRO"
  const proX = lockupX + tileSize + gap1 + rachaW + gap2;
  const proY = topY + 18;
  roundRectPath(ctx, proX, proY, proW, proH, 12);
  ctx.strokeStyle = 'rgba(190, 242, 100, 0.48)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = `800 24px ${MONO}`;
  ctx.fillStyle = '#BEF264';
  ctx.textAlign = 'center';
  ctx.fillText('PRO', proX + proW / 2, proY + 29);

  // 3. Nome do Racha + Data
  drawCentered(ctx, data.heading.toUpperCase(), W / 2, 286, 920, 26, '800', '#A3E635', MONO);
  drawCentered(ctx, data.dateLabel, W / 2, 336, 920, 26, '500', '#879287', SANS);

  const mvp = data.podium[0] ?? null;

  if (!mvp) {
    drawCentered(ctx, 'Nenhum gol registrado ainda', W / 2, 920, 900, 48, '800', '#F4F7F2', SANS);
  } else {
    // 4. Hero do MVP
    const crownSize = 36;
    ctx.font = `800 26px ${MONO}`;
    const mvpLabel = 'MVP DO RACHA';
    const labelW = ctx.measureText(mvpLabel).width;
    const crownGroupW = crownSize + 16 + labelW;
    const crownX = (W - crownGroupW) / 2;

    drawCrown(ctx, crownX, 424, crownSize, '#FBBF24');
    ctx.fillStyle = '#FBBF24';
    ctx.textAlign = 'left';
    ctx.fillText(mvpLabel, crownX + crownSize + 16, 452);

    // Nome gigante do MVP
    drawCentered(ctx, mvp.name, W / 2, 622, 920, 152, '800', '#F4F7F2', SANS);

    // Métrica principal G+A
    const mvpSub = `G+A: ${mvp.total}  ·  ${mvp.goals}G · ${mvp.assists}A`;
    drawCentered(ctx, mvpSub, W / 2, 696, 900, 32, '800', '#D9F99D', MONO);

    // Pílula de resumo (partidas e gols)
    const summaryText = `${data.matches} ${data.matches === 1 ? 'PARTIDA' : 'PARTIDAS'}  ·  ${
      data.totalGoals
    } ${data.totalGoals === 1 ? 'GOL' : 'GOLS'}`;
    ctx.font = `700 24px ${MONO}`;
    const sumW = Math.min(820, ctx.measureText(summaryText).width + 64);
    roundRectPath(ctx, (W - sumW) / 2, 748, sumW, 64, 32);
    ctx.fillStyle = 'rgba(17, 23, 19, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawCentered(ctx, summaryText, W / 2, 789, sumW - 32, 24, '700', '#C9D3C4', MONO);

    // Destaques discretos (Artilheiro / Garçom) sem emojis
    const highlights: string[] = [];
    if (data.topScorer && data.topScorer.goals > 0) {
      highlights.push(`ARTILHEIRO: ${firstName(data.topScorer.name).toUpperCase()} (${data.topScorer.goals}G)`);
    }
    if (data.topAssist && data.topAssist.assists > 0) {
      highlights.push(`GARÇOM: ${firstName(data.topAssist.name).toUpperCase()} (${data.topAssist.assists}A)`);
    }
    if (highlights.length > 0) {
      drawCentered(ctx, highlights.join('   ·   '), W / 2, 876, 940, 22, '700', '#879287', MONO);
    }

    // 5. Pódio em 3 colunas (2º - 1º - 3º) fiel ao artboard
    const slots: {
      row: ShareCardRow | undefined;
      rank: string;
      height: number;
      topColor: string;
      botColor: string;
      numColor: string;
      numSize: number;
    }[] = [
      {
        row: data.podium[1],
        rank: '2',
        height: 300,
        topColor: 'rgba(228, 228, 231, 0.92)',
        botColor: 'rgba(161, 161, 170, 0.56)',
        numColor: '#0B100D',
        numSize: 68,
      },
      {
        row: data.podium[0],
        rank: '1',
        height: 420,
        topColor: '#FDE68A',
        botColor: '#FBBF24',
        numColor: '#1A1405',
        numSize: 88,
      },
      {
        row: data.podium[2],
        rank: '3',
        height: 220,
        topColor: '#F59E0B',
        botColor: '#B45309',
        numColor: '#1A0F02',
        numSize: 60,
      },
    ];

    const padX = 72;
    const gap = 20;
    const colW = (W - padX * 2 - gap * 2) / 3;
    const baseY = 1744;

    slots.forEach((slot, i) => {
      if (!slot.row) return;
      const x = padX + i * (colW + gap);
      const y = baseY - slot.height;

      // Nome e G+A acima da barra
      drawCentered(ctx, firstName(slot.row.name), x + colW / 2, y - 54, colW - 12, 34, '800', '#F4F7F2', SANS);
      drawCentered(
        ctx,
        `${slot.row.total} G+A`,
        x + colW / 2,
        y - 20,
        colW - 12,
        22,
        '800',
        '#879287',
        MONO
      );

      // Barra do pódio
      topRoundRectPath(ctx, x, y, colW, slot.height, 36);
      const grad = ctx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, slot.topColor);
      grad.addColorStop(1, slot.botColor);
      ctx.fillStyle = grad;
      ctx.fill();

      // Número grande no topo da barra
      ctx.font = `800 ${slot.numSize}px ${MONO}`;
      ctx.fillStyle = slot.numColor;
      ctx.textAlign = 'center';
      ctx.fillText(slot.rank, x + colW / 2, y + slot.numSize + 24);
    });
  }

  // 6. Rodapé da Marca
  const footerText = 'O PLACAR DA SUA PELADA · RACHAPRO';
  ctx.font = `700 22px ${MONO}`;
  const footerW = ctx.measureText(footerText).width;
  const iconSize = 32;
  const footerTotalW = iconSize + 14 + footerW;
  const footerX = (W - footerTotalW) / 2;
  const footerY = 1838;

  drawBrandGlyph(ctx, footerX, footerY - 26, iconSize, '#BEF264', 7);
  ctx.fillStyle = '#879287';
  ctx.textAlign = 'left';
  ctx.fillText(footerText, footerX + iconSize + 14, footerY);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
