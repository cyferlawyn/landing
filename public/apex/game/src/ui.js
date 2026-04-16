// ui.js — shop panel and button wiring
// Patches DOM in-place to avoid hover flicker from full re-renders.

import { RARITIES, RARITY_COLOR, RARITY_BONUS, TYPE_BONUS_MULT, petBonus } from './traitor.js';

function getApex() { return window.__apex; }

// ── Initial DOM build (runs once) ──────────────────────────────────────────

function buildPrestigeCards() {
  const apex = getApex();
  if (!apex) return;

  const list = document.getElementById('prestige-upgrade-list');
  list.innerHTML = '';

  for (const entry of apex.prestigeShop.catalogue) {
    const card = document.createElement('div');
    card.className   = 'prestige-card';
    card.dataset.upg = entry.id;

    card.innerHTML = `
      <div class="upgrade-card-top">
        <span class="upgrade-name">${entry.name}</span>
        <span class="upgrade-tier" data-tier></span>
        <span class="upgrade-tooltip-icon" aria-label="${entry.tooltip}">?
          <span class="upgrade-tooltip-box">${(entry.tooltip ?? '').replace(/\n/g, '<br>')}</span>
        </span>
      </div>
      <button class="prestige-buy-btn" data-pid="${entry.id}"></button>
    `;

    list.appendChild(card);
  }
}

function buildShopCards() {
  const apex = getApex();
  if (!apex) return;

  const list = document.getElementById('upgrade-list');
  list.innerHTML = '';

  for (const entry of apex.shop.catalogue) {
    const card = document.createElement('div');
    card.className   = 'upgrade-card';
    card.dataset.upg = entry.id;

    card.innerHTML = `
      <div class="upgrade-card-top">
        <span class="upgrade-name">${entry.name}</span>
        <span class="upgrade-tier" data-tier></span>
        <span class="upgrade-tooltip-icon" aria-label="${entry.tooltip}">?
          <span class="upgrade-tooltip-box">${(entry.tooltip ?? '').replace(/\n/g, '<br>')}</span>
        </span>
      </div>
      <button class="upgrade-buy-btn" data-id="${entry.id}"></button>
    `;

    list.appendChild(card);
  }
}

// ── Patch update (runs every 250ms) ────────────────────────────────────────

function patchPrestigeCards() {
  const apex = getApex();
  if (!apex) return;

  const { prestigeShop, game } = apex;

  const tabPrestige = document.getElementById('tab-prestige');
  const showPrestige = game.ascensionCount > 0 || game.pendingShards > 0 || game.totalShardsEarned > 0;
  if (tabPrestige.classList.contains('hidden') === showPrestige) {
    tabPrestige.classList.toggle('hidden', !showPrestige);
  }

  const ascendBtn = document.getElementById('ascend-btn');
  const showAscend = game.wave >= 30 || game.ascensionCount > 0;
  if (ascendBtn.classList.contains('hidden') === showAscend) {
    ascendBtn.classList.toggle('hidden', !showAscend);
  }
  if (showAscend) {
    const active = game.pendingShards > 0;
    ascendBtn.disabled = !active;
    const label = active ? `ASCEND (+${game.pendingShards} ◆)` : 'ASCEND (no ◆ yet)';
    if (ascendBtn.textContent !== label) ascendBtn.textContent = label;
  }

  if (!showPrestige) return;

  const shardEl = document.getElementById('prestige-shard-value');
  if (shardEl.textContent !== String(game.shards)) shardEl.textContent = game.shards;

  const passiveLine = document.getElementById('prestige-passive-line');
  const totalShards = game.totalShardsEarned;
  const mult = (1 + totalShards * 0.10).toFixed(2);
  const passiveText = `Shard bonus: ×${mult} dmg (${totalShards} total ◆)`;
  if (passiveLine.textContent !== passiveText) passiveLine.textContent = passiveText;

  for (const entry of prestigeShop.catalogue) {
    const card = document.querySelector(`.prestige-card[data-upg="${entry.id}"]`);
    if (!card) continue;

    const tier   = prestigeShop.tier(entry.id);
    const maxed  = prestigeShop.isMaxed(entry.id);
    const cost   = prestigeShop.cost(entry.id);
    const afford = game.shards >= cost;

    if (card.classList.contains('is-maxed') !== maxed) {
      card.classList.toggle('is-maxed', maxed);
    }

    const tierEl   = card.querySelector('[data-tier]');
    const tierText = maxed ? 'MAX' : `[${tier}/${entry.maxTier}]`;
    if (tierEl.textContent !== tierText) tierEl.textContent = tierText;
    if (tierEl.classList.contains('maxed') !== maxed) tierEl.classList.toggle('maxed', maxed);

    const btn = card.querySelector('.prestige-buy-btn');
    if (maxed) {
      setBtn(btn, 'MAXED', true, true);
    } else {
      const label = `◆ ${cost}`;
      setBtn(btn, label, !afford, false);
      if (btn.dataset.pid !== entry.id) btn.dataset.pid = entry.id;
    }
  }
}

function patchShopCards() {
  const apex = getApex();
  if (!apex) return;

  const { shop, game } = apex;

  document.getElementById('currency-value').textContent = game.currency;

  for (const entry of shop.catalogue) {
    const card = document.querySelector(`.upgrade-card[data-upg="${entry.id}"]`);
    if (!card) continue;

    const tier   = shop.tier(entry.id);
    const maxed  = shop.isMaxed(entry.id);
    const cost   = shop.cost(entry.id);
    const afford = game.currency >= cost;

    if (card.classList.contains('is-maxed') !== maxed) {
      card.classList.toggle('is-maxed', maxed);
    }

    const tierEl = card.querySelector('[data-tier]');
    const tierText = maxed ? 'MAX' : entry.maxTier === null ? `[${tier}/∞]` : `[${tier}/${entry.maxTier}]`;
    if (tierEl.textContent !== tierText) tierEl.textContent = tierText;
    const wantMaxedClass = maxed;
    if (tierEl.classList.contains('maxed') !== wantMaxedClass) {
      tierEl.classList.toggle('maxed', wantMaxedClass);
    }

    const btn = card.querySelector('.upgrade-buy-btn');
    if (maxed) {
      setBtn(btn, 'MAXED', true, true);
    } else {
      let label = `$ ${cost}`;
      if (!afford && game.recentEarned > 0) {
        const deficit = cost - game.currency;
        const rate = game.recentEarned / 60;
        const secs = Math.min(999, Math.ceil(deficit / rate));
        label = `$ ${cost}  ~${secs}s`;
      }
      setBtn(btn, label, !afford, false);
      if (btn.dataset.id !== entry.id) btn.dataset.id = entry.id;
    }
  }
}

function setBtn(btn, text, disabled, maxed) {
  if (btn.textContent !== text) btn.textContent = text;
  if (btn.disabled !== disabled) btn.disabled = disabled;
  if (btn.classList.contains('maxed') !== maxed) btn.classList.toggle('maxed', maxed);
}

// ── Traitor panel ──────────────────────────────────────────────────────────

const TYPE_LABEL = {
  DRONE: 'Drone', SWARM: 'Swarm', BRUTE: 'Brute', ELITE: 'Elite',
  BOSS: 'Boss', DASHER: 'Dasher', BOMBER: 'Bomber',
  SPAWNER: 'Spawner', PHANTOM: 'Phantom', COLOSSUS: 'Colossus',
};

const _toastQueue   = [];
let   _toastTimeout = null;

function _showNextToast() {
  if (_toastTimeout !== null || _toastQueue.length === 0) return;
  const pet   = _toastQueue.shift();
  const toast = document.getElementById('traitor-toast');
  const color = RARITY_COLOR[pet.rarity] ?? '#9e9e9e';
  const bonus = petBonus(pet.type, pet.rarity);

  toast.innerHTML = `
    <div id="traitor-toast-label">traitor deserted!</div>
    <div id="traitor-toast-rarity" style="color:${color}">${pet.rarity}</div>
    <div id="traitor-toast-type">${TYPE_LABEL[pet.type] ?? pet.type}</div>
    <div id="traitor-toast-bonus">+${Math.round(bonus * 100)}% dmg when active</div>
  `;
  toast.classList.remove('hidden', 'toast-show');
  void toast.offsetWidth;
  toast.classList.add('toast-show');

  _toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('toast-show');
    _toastTimeout = null;
    _showNextToast();
  }, 3000);
}

let _traitorFingerprint = '';

function _traitorStateKey(ts) {
  return ts.slots.join(',') + '|' + ts.roster.map(p => `${p.id}:${p.type}:${p.rarity}`).join(',');
}

function patchTraitorPanel() {
  const apex = getApex();
  if (!apex) return;
  const ts   = apex.game.traitorSystem;
  const game = apex.game;
  if (!ts) return;

  if (game.pendingTraitorAnnouncements?.length > 0) {
    for (const pet of game.pendingTraitorAnnouncements) _toastQueue.push(pet);
    game.pendingTraitorAnnouncements.length = 0;
    _showNextToast();
  }

  const tabTraitors = document.getElementById('tab-traitors');
  const show = ts.roster.length > 0;
  if (tabTraitors.classList.contains('hidden') === show) {
    tabTraitors.classList.toggle('hidden', !show);
  }
  if (!show) return;

  const bonus      = ts.damageBonus();
  const bonusPct   = Math.round(bonus * 100);
  const bonusEl    = document.getElementById('traitor-bonus-value');
  const bonusText  = `+${bonusPct}%`;
  if (bonusEl.textContent !== bonusText) bonusEl.textContent = bonusText;

  const passiveLine = document.getElementById('traitor-passive-line');
  const mult         = (1 + bonus).toFixed(2);
  const activeCount  = ts.activePets().length;
  const passiveText  = `Pet bonus: ×${mult} dmg  (${activeCount}/3 active)`;
  if (passiveLine.textContent !== passiveText) passiveLine.textContent = passiveText;

  const fp = _traitorStateKey(ts);
  if (fp === _traitorFingerprint) return;
  _traitorFingerprint = fp;

  const slotsEl = document.getElementById('traitor-slots');
  slotsEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const petId = ts.slots[i];
    const pet   = petId != null ? ts.roster.find(p => p.id === petId) : null;
    const div   = document.createElement('div');
    div.className = 'traitor-slot' + (pet ? ' filled' : '');
    div.dataset.slotIdx = i;
    if (pet) {
      const color = RARITY_COLOR[pet.rarity] ?? '#9e9e9e';
      div.style.borderColor = color + '80';
      div.innerHTML = `
        <span class="rarity-badge" style="color:${color}">${pet.rarity[0].toUpperCase()}</span>
        <span class="traitor-slot-type">${TYPE_LABEL[pet.type] ?? pet.type}</span>
        <span class="traitor-slot-unassign">click to remove</span>
      `;
    } else {
      div.textContent = 'empty';
    }
    slotsEl.appendChild(div);
  }

  const rosterEl = document.getElementById('traitor-roster');
  rosterEl.innerHTML = '';

  const counts = ts.groupCounts();
  if (Object.keys(counts).length === 0) {
    const empty = document.createElement('div');
    empty.id          = 'traitor-roster-empty';
    empty.textContent = 'No traitors yet.';
    rosterEl.appendChild(empty);
    return;
  }

  const sortedKeys = Object.keys(counts).sort((a, b) => {
    const [, ra] = a.split('|');
    const [, rb] = b.split('|');
    return RARITIES.indexOf(rb) - RARITIES.indexOf(ra);
  });

  const noEmptySlot = ts.slots.indexOf(null) === -1;

  for (const key of sortedKeys) {
    const [type, rarity] = key.split('|');
    const count  = counts[key];
    const color  = RARITY_COLOR[rarity] ?? '#9e9e9e';
    const bonus  = petBonus(type, rarity);
    const canMrg = ts.canMerge(type, rarity);

    const assignedIds = new Set(ts.slots.filter(Boolean));
    const unassignedInGroup = ts.roster.filter(
      p => p.type === type && p.rarity === rarity && !assignedIds.has(p.id)
    );

    const row = document.createElement('div');
    row.className = 'traitor-group';
    row.innerHTML = `
      <span class="rarity-badge" style="color:${color}">${rarity}</span>
      <span class="traitor-group-type">${TYPE_LABEL[type] ?? type}</span>
      <span class="traitor-group-count" style="color:rgba(255,255,255,0.35)">+${Math.round(bonus*100)}% ×${count}</span>
      <button class="traitor-btn traitor-btn-assign"
        data-assign-type="${type}" data-assign-rarity="${rarity}"
        ${(noEmptySlot || unassignedInGroup.length === 0) ? 'disabled' : ''}>SLOT</button>
      ${canMrg
        ? `<button class="traitor-btn traitor-btn-merge" data-merge-type="${type}" data-merge-rarity="${rarity}">MERGE×5</button>`
        : ''}
    `;
    rosterEl.appendChild(row);
  }
}

function wireTraitorButtons() {
  document.getElementById('traitor-slots').addEventListener('click', e => {
    const slot = e.target.closest('[data-slot-idx]');
    if (!slot) return;
    const apex = getApex();
    if (!apex) return;
    const idx = parseInt(slot.dataset.slotIdx, 10);
    apex.game.traitorSystem.unassign(idx);
    apex.saveTraitors(apex.game.traitorSystem.serialize());
    _traitorFingerprint = '';
    patchTraitorPanel();
  });

  document.getElementById('traitor-roster').addEventListener('click', e => {
    const apex = getApex();
    if (!apex) return;
    const ts = apex.game.traitorSystem;

    const assignBtn = e.target.closest('[data-assign-type]');
    if (assignBtn && !assignBtn.disabled) {
      const type   = assignBtn.dataset.assignType;
      const rarity = assignBtn.dataset.assignRarity;
      const assigned = new Set(ts.slots.filter(Boolean));
      const pet = ts.roster.find(p => p.type === type && p.rarity === rarity && !assigned.has(p.id));
      if (pet) ts.assignToFirstEmpty(pet.id);
      apex.saveTraitors(ts.serialize());
      _traitorFingerprint = '';
      patchTraitorPanel();
      return;
    }

    const mergeBtn = e.target.closest('[data-merge-type]');
    if (mergeBtn) {
      ts.merge(mergeBtn.dataset.mergeType, mergeBtn.dataset.mergeRarity);
      apex.saveTraitors(ts.serialize());
      _traitorFingerprint = '';
      patchTraitorPanel();
    }
  });
}

// ── Tab collapse / expand ──────────────────────────────────────────────────

function wireTabHeaders() {
  document.querySelectorAll('.tab-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const collapsed = body.classList.toggle('tab-body--collapsed');
      header.classList.toggle('is-collapsed', collapsed);
    });
  });
}

// ── Button wiring ──────────────────────────────────────────────────────────

function wireButtons() {
  wireTabHeaders();
  wireTraitorButtons();

  document.getElementById('upgrade-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    apex.shop.purchase(btn.dataset.id);
    patchShopCards();
  });

  document.getElementById('prestige-upgrade-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-pid]');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    apex.prestigeShop.purchase(btn.dataset.pid);
    patchPrestigeCards();
  });

  document.getElementById('ascend-btn').addEventListener('click', () => {
    const apex = getApex();
    if (!apex) return;
    const { game } = apex;
    const totalAfter = game.shards + game.pendingShards;
    const multAfter  = (1 + (game.totalShardsEarned + game.pendingShards) * 0.10).toFixed(2);
    document.getElementById('ascend-confirm-sub').textContent =
      `+${game.pendingShards} ◆  →  ${totalAfter} ◆ spendable  →  ×${multAfter} shard damage`;
    document.getElementById('ascend-overlay').classList.remove('hidden');
  });

  document.getElementById('ascend-yes').addEventListener('click', () => {
    document.getElementById('ascend-overlay').classList.add('hidden');
    getApex()?.ascend();
    patchShopCards();
    patchPrestigeCards();
  });

  document.getElementById('ascend-no').addEventListener('click', () => {
    document.getElementById('ascend-overlay').classList.add('hidden');
  });

  document.getElementById('new-game-btn').addEventListener('click', () => {
    const apex = getApex();
    if (!apex) return;
    if (apex.hasSave()) {
      document.getElementById('confirm-overlay').classList.remove('hidden');
    } else {
      apex.newGame(true);
      patchShopCards();
    }
  });

  document.getElementById('confirm-yes').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.add('hidden');
    getApex()?.newGame(true);
    patchShopCards();
  });

  document.getElementById('confirm-no').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.add('hidden');
  });

  document.getElementById('volume-slider').addEventListener('input', e => {
    const apex = getApex();
    if (!apex) return;
    const vol = parseInt(e.target.value, 10) / 100;
    apex.audio?.setVolume(vol);
    apex.savePrefs({ quality: apex.game.quality, volume: vol, autoQuality: apex.game.autoQuality });
  });

  document.getElementById('quality-buttons').addEventListener('click', e => {
    const btn = e.target.closest('.quality-btn');
    if (!btn) return;
    const apex = getApex();
    if (!apex) return;
    apex.setQuality(btn.dataset.q);
    syncQualityUI(apex.game);
  });

  document.getElementById('auto-quality-btn').addEventListener('click', () => {
    const apex = getApex();
    if (!apex) return;
    if (apex.game.autoQuality) {
      apex.setQuality(apex.game.quality);
    } else {
      apex.setQuality('auto');
    }
    syncQualityUI(apex.game);
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    buildShopCards();
    buildPrestigeCards();
    wireButtons();
    patchShopCards();
    patchPrestigeCards();
    patchTraitorPanel();
    syncPrefsUI();
    setInterval(patchShopCards, 250);
    setInterval(patchPrestigeCards, 250);
    setInterval(patchTraitorPanel, 250);
  });
});

window.__syncQualityUI = () => {
  const apex = getApex();
  if (apex) syncQualityUI(apex.game);
};

function syncPrefsUI() {
  const apex = getApex();
  if (!apex) return;
  syncQualityUI(apex.game);
  const vol = apex.audio?.volume ?? 0.4;
  document.getElementById('volume-slider').value = Math.round(vol * 100);
}

function syncQualityUI(game) {
  const isAuto = game.autoQuality;
  const q      = game.quality ?? 'high';

  document.querySelectorAll('.quality-btn').forEach(b => {
    b.classList.toggle('active',      !isAuto && b.dataset.q === q);
    b.classList.toggle('auto-active',  isAuto && b.dataset.q === q);
  });

  document.getElementById('auto-quality-btn').classList.toggle('active', isAuto);
}
