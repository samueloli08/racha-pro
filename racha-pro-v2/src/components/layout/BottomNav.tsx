import React from 'react';
import { BarChart3, CircleDot, Shuffle, Users } from 'lucide-react';
import { TabId } from '../../types/racha';

interface BottomNavProps { activeTab: TabId; onSelectTab: (tab: TabId) => void; isMatchRunning: boolean; }

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab, isMatchRunning }) => {
  const items: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'players', label: 'Elenco', icon: <Users /> },
    { id: 'sort', label: 'Times', icon: <Shuffle /> },
    { id: 'match', label: 'Ao vivo', icon: <CircleDot /> },
    { id: 'stats', label: 'Números', icon: <BarChart3 /> },
  ];
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav-inner">
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => onSelectTab(item.id)} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'is-active' : ''}`}>
              <span className="nav-icon-wrap">{item.icon}{item.id === 'match' && isMatchRunning && <i className="live-dot" />}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
