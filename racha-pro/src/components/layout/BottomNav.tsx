import React from 'react';
import { BarChart3, Play, Shuffle, Users } from 'lucide-react';
import { TabId } from '../../types/racha';

interface BottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  isMatchRunning: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  isMatchRunning,
}) => {
  const items: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'players', label: 'Jogadores', icon: <Users className="h-5 w-5" /> },
    { id: 'sort', label: 'Sorteio', icon: <Shuffle className="h-5 w-5" /> },
    { id: 'match', label: 'Partida', icon: <Play className="h-5 w-5" /> },
    { id: 'stats', label: 'Stats', icon: <BarChart3 className="h-5 w-5" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 pb-safe backdrop-blur-md">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-semibold transition-colors ${
                isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {item.id === 'match' && isMatchRunning && (
                <span className="absolute right-6 top-2 h-2 w-2 animate-ping rounded-full bg-emerald-400" />
              )}
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
