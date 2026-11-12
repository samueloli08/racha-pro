# ⚽ RachaPro — Gestão de Pelada & Futebol Amador

Aplicativo web **mobile-first** e **offline-first** desenvolvido para organizar rachas na beira da quadra ou do campo.

## ✨ Funcionalidades
- **Check-in Rápido:** Cadastro de jogadores com posição (Goleiro/Linha) e nível técnico (1 a 5 estrelas).
- **Sorteio Inteligente:** Balanceamento automático por estrelas e distribuição de goleiros, ou sorteio aleatório puro, com troca manual entre times.
- **Match Center (Partida ao Vivo):** Cronômetro configurável (padrão 7 min) com números tabulares, apito sintetizado via Web Audio API, placar gigante e registro rápido de **Gols + Assistências**.
- **Rotação Automática de Fila:** Sugestão automática de quem fica e quem entra ao fim da partida.
- **Artilharia & WhatsApp:** Ranking de gols, garçons, MVP (G+A) e exportação formatada com 1 clique para o grupo do WhatsApp.

## 🚀 Como rodar localmente

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor de desenvolvimento
npm run dev

# 3. Gere a build de produção
npm run build
```

## 🛠️ Tecnologias
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Web Audio API & LocalStorage
