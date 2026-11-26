import React from 'react';

interface BrandGlyphProps {
  className?: string;
  strokeWidth?: number;
}

/** Símbolo oficial RachaPro: um R riscado como linha de campo com a bola no bojo. */
export const BrandGlyph: React.FC<BrandGlyphProps> = ({
  className = 'h-7 w-7',
  strokeWidth = 6,
}) => (
  <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
    <path
      d="M21 50V14h11a12 12 0 0 1 0 24H21M31 38l12 12"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="32" cy="26" r="3.4" fill="currentColor" />
  </svg>
);

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const TILE_SIZES = {
  sm: { box: 'h-9 w-9 rounded-[11px]', glyph: 'h-6 w-6', stroke: 6.5 },
  md: { box: 'h-[42px] w-[42px] rounded-[13px]', glyph: 'h-[30px] w-[30px]', stroke: 6 },
  lg: { box: 'h-16 w-16 rounded-[20px]', glyph: 'h-11 w-11', stroke: 6 },
};

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', className = '' }) => {
  const cfg = TILE_SIZES[size];
  return (
    <div className={`brand-mark shrink-0 ${cfg.box} ${className}`}>
      <BrandGlyph className={cfg.glyph} strokeWidth={cfg.stroke} />
    </div>
  );
};

interface BrandLockupProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  align?: 'center' | 'left';
}

export const BrandLockup: React.FC<BrandLockupProps> = ({
  size = 'lg',
  showTagline = false,
  align = 'center',
}) => {
  const isLg = size === 'lg';
  const isSm = size === 'sm';
  return (
    <div
      className={`flex flex-col ${
        align === 'left' ? 'items-start text-left' : 'items-center text-center'
      }`}
    >
      <div className={`flex items-center ${isSm ? 'gap-2.5' : 'gap-3'}`}>
        <BrandMark size={isLg ? 'lg' : isSm ? 'sm' : 'md'} />
        <div className="flex items-start gap-1.5">
          <span
            className={`font-extrabold leading-none tracking-[-0.065em] text-[#0D1510] ${
              isLg ? 'text-[44px] sm:text-[54px]' : isSm ? 'text-[24px]' : 'text-[30px]'
            }`}
          >
            racha
          </span>
          <span
            className={`brand-badge ${
              isLg ? 'mt-1 px-2 py-1 text-[13px]' : isSm ? 'mt-0.5 text-[10px]' : 'mt-0.5 text-[11px]'
            }`}
          >
            PRO
          </span>
        </div>
      </div>
      {showTagline && (
        <p className="mt-3 text-sm font-medium tracking-[-0.01em] text-[#5B6B5F]">
          O placar da sua pelada.
        </p>
      )}
    </div>
  );
};
