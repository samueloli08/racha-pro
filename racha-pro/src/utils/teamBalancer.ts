import { Player, SortMode, Team } from '../types/racha';

const TEAM_PRESETS = [
  { name: 'Time Verde', color: '#10b981' },
  { name: 'Time Amarelo', color: '#f59e0b' },
  { name: 'Time Azul', color: '#3b82f6' },
  { name: 'Time Vermelho', color: '#ef4444' },
  { name: 'Time Roxo', color: '#a855f7' },
  { name: 'Time Branco', color: '#e4e4e7' },
];

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateTeams(
  presentPlayers: Player[],
  playersPerTeam: number,
  mode: SortMode
): Team[] {
  if (presentPlayers.length === 0) return [];

  const totalTeams = Math.max(2, Math.ceil(presentPlayers.length / playersPerTeam));
  const buckets: Player[][] = Array.from({ length: totalTeams }, () => []);

  if (mode === 'random') {
    const shuffled = shuffle(presentPlayers);
    shuffled.forEach((player, idx) => {
      buckets[idx % totalTeams].push(player);
    });
  } else {
    const goalkeepers = shuffle(presentPlayers.filter((p) => p.isGoalkeeper)).sort(
      (a, b) => b.skill - a.skill
    );
    const outfield = shuffle(presentPlayers.filter((p) => !p.isGoalkeeper)).sort(
      (a, b) => b.skill - a.skill
    );

    goalkeepers.forEach((gk, idx) => {
      buckets[idx % totalTeams].push(gk);
    });

    let direction = 1;
    let teamIdx = 0;

    for (const player of outfield) {
      let attempts = 0;
      while (buckets[teamIdx].length >= playersPerTeam && attempts < totalTeams) {
        teamIdx = (teamIdx + 1) % totalTeams;
        attempts++;
      }
      buckets[teamIdx].push(player);

      teamIdx += direction;
      if (teamIdx >= totalTeams) {
        teamIdx = totalTeams - 1;
        direction = -1;
      } else if (teamIdx < 0) {
        teamIdx = 0;
        direction = 1;
      }
    }
  }

  return buckets
    .filter((b) => b.length > 0)
    .map((bucket, idx) => {
      const preset = TEAM_PRESETS[idx % TEAM_PRESETS.length];
      return {
        id: `team-${idx + 1}`,
        name: preset.name,
        color: preset.color,
        playerIds: bucket.map((p) => p.id),
      };
    });
}
