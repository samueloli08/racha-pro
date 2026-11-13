# ⚽ RachaPro — Gestão de Pelada & Futebol Amador

Aplicativo web **mobile-first** e **offline-first** desenvolvido para organizar rachas na beira da quadra ou do campo.

## ✨ Funcionalidades
- **Check-in Rápido:** Cadastro de jogadores com posição (Goleiro/Linha) e nível técnico (1 a 5 estrelas).
- **Sorteio Inteligente:** Balanceamento automático por estrelas e distribuição de goleiros, ou sorteio aleatório puro, com troca manual entre times.
- **Match Center (Partida ao Vivo):** Cronômetro configurável (padrão 7 min) com números tabulares, apito sintetizado via Web Audio API, placar gigante e registro rápido de **Gols + Assistências**.
- **Rotação Automática de Fila:** Sugestão automática de quem fica e quem entra ao fim da partida.
- **Artilharia & WhatsApp:** Ranking de gols, garçons, MVP (G+A) e exportação formatada com 1 clique para o grupo do WhatsApp.

## 🆕 Novidades (pacote de melhorias)
- **Sync em tempo real:** indicador no header (🟢 Sincronizado / 🟡 Salvando... / 🔴 Offline (Local)) e Supabase Realtime — outros celulares com o link atualizam placar, gols e times sozinhos. Rode `supabase/realtime.sql` uma vez no Supabase.
- **Tela sempre acesa** (Wake Lock) enquanto o cronômetro roda.
- **Jogadores:** busca, filtros, marcar/desmarcar todos, edição inline (lápis) e badge de ordem de chegada (#1, #2...).
- **Sorteio:** renomear time e trocar cor (6 presets), troca manual com destaque pulsante + "Cancelar troca", jogador atrasado direto em um time, botão "Copiar Escalação".
- **Partida:** seletor manual de confronto, aviso de empate com opções (ambos saem / A fica / B fica), vibração + apito no fim, bip suave com 1 minuto restante, goleiro de cada time e clean sheet.
- **Stats:** "Racha de Hoje" x "Geral Histórico" (botão *Encerrar Dia / Arquivar Racha*), abas Geral/Gols/Assist./Vitórias, ranking de goleiros e **card PNG** (Canvas nativo) para Stories/WhatsApp.
- Compatível com os dados já salvos (`localStorage` e `racha_state`): campos novos são opcionais.

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
