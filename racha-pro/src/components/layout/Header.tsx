import React from 'react';
import { Trophy } from 'lucide-react';

interface HeaderProps {
  presentCount: number;
  matchesCount: number;
}

export const Header: React.FC<HeaderProps> = ({ presentCount, matchesCount }) => {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20">
            <Trophy className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white">
              Racha<span className="text-emerald-400">Pro</span>
            </h1>
            <p className="text-[11px] font-medium text-zinc-400">
              {presentCount} presentes • {matchesCount} jogos hoje
            </p>
          </div>
        </div>

        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
          OFFLINE READY
        </span>
      </div>
    </header>
  );
};
