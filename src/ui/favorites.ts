import { GAMES } from '../config';
import { STATE, saveFavorites } from '../state';
import { renderPickRow } from './renderers';
import { $, copyText } from '../utils';
import { pushFavorite, fetchFavorites, deleteFavoriteApi, clearFavoritesApi } from '../api';

export async function renderFavorites(): Promise<void> {
  const el = $('favoritesOutput')!;
  if (!STATE.favorites.length) {
    el.innerHTML = '<h3>Favoritas</h3><p class="analysis">Nenhuma carteira salva ainda.</p>';
    return;
  }
  el.innerHTML = `<h3>Carteiras favoritas</h3>${STATE.favorites.map((f: any) => {
    const g = GAMES.find(x => x.id === f.gameId) || GAMES[0];
    return `<div class="pick-row"><div><strong style="color:${g.color}">${g.name}</strong><div class="pick-meta">${f.label} | ${f.date} | ${f.tickets.length} jogos</div></div><div class="toolbar"><button class="btn" onclick="copyFavorite(${f.id})">Copiar</button><button class="btn danger" onclick="deleteFavorite(${f.id})">Excluir</button></div></div>`;
  }).join('')}`;
}

export async function saveWallet(gameId: string, tickets: any[], label: string): Promise<void> {
  const g = GAMES.find(x => x.id === gameId);
  const list = Array.isArray(tickets) ? tickets : [tickets];
  if (!list.length) return;

  const entry = { id: Date.now(), gameId, label, date: new Date().toLocaleString('pt-BR'), tickets: list };
  STATE.favorites.unshift(entry);
  STATE.favorites = STATE.favorites.slice(0, 40);
  saveFavorites();

  // Sync to API
  pushFavorite(gameId, label, list).then(ok => {
    if (ok) console.log('Favorite synced to API');
  });

  if ($('favoritesOutput')) renderFavorites();
  alert(`Carteira salva: ${g?.name} (${list.length} jogo${list.length > 1 ? 's' : ''}).`);
}

export async function copyFavorite(id: number): Promise<void> {
  const f = STATE.favorites.find((x: any) => x.id === id);
  if (!f) return;
  const g = GAMES.find(x => x.id === f.gameId) || GAMES[0];
  copyText(f.tickets.map((p: any) => {
    return `${g.name}: ${p.main.map((n: number) => String(n).padStart(g.max > 99 ? 5 : 2, '0')).join(' ')}${p.extra?.length ? ' | Extra: ' + p.extra.join(' ') : ''}`;
  }).join('\n'));
}

export async function deleteFavorite(id: number): Promise<void> {
  STATE.favorites = STATE.favorites.filter((x: any) => x.id !== id);
  saveFavorites();
  deleteFavoriteApi(id).then(ok => { if (ok) console.log('Favorite deleted from API'); });
  renderFavorites();
}

export async function clearFavorites(): Promise<void> {
  STATE.favorites = [];
  saveFavorites();
  clearFavoritesApi().then(ok => { if (ok) console.log('Favorites cleared from API'); });
  renderFavorites();
}
