// ui.js — shop panel and button wiring
// Patches DOM in-place to avoid hover flicker from full re-renders.

import { RARITIES, RARITY_COLOR, RARITY_BONUS, TYPE_BONUS_MULT, petBonus } from './traitor.js';
import { FACTIONS, FACTION_NODES, FACTION_CAPSTONES } from './faction.js';
import { fmt, fmtPct } from './util.js';
import { savePrefs, loadPrefs } from './storage.js';

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
// Only touches text/attributes that actually changed — never recreates nodes,
// so hover state and focus are preserved.

function patchPrestigeCards() {
  const apex = getApex();
  if (!apex) return;

  const { prestigeShop, game } = apex;

  // Show/hide Ascension tab — hidden until the player earns their first shard
  const tabPrestige = document.getElementById('tab-prestige');
  const showPrestige = game.ascensionCount > 0 || game.pendingShards > 0 || game.totalShardsEarned > 0;
  if (tabPrestige.classList.contains('hidden') === showPrestige) {
    tabPrestige.classList.toggle('hidden', !showPrestige);
  }

  // Ascend button — teaser from wave 30 (greyed), active once pendingShards > 0;
  // permanently visible once ascensionCount > 0
  const ascendBtn = document.getElementById('ascend-btn');
  const showAscend = game.wave >= 30 || game.ascensionCount > 0;
  if (ascendBtn.classList.contains('hidden') === showAscend) {
    ascendBtn.classList.toggle('hidden', !showAscend);
  }
  if (showAscend) {
    const active = game.pendingShards > 0;
    ascendBtn.disabled = !active;
    const label = active ? `ASCEND (+${fmt(game.pendingShards)} ◆)` : 'ASCEND (no ◆ yet)';
    if (ascendBtn.textContent !== label) ascendBtn.textContent = label;
  }

  // Auto-ascension dropdown — show if ENDLESS WAR capstone rank > 0 (cross-faction permanent unlock).
  // Requires at least one prior ascension (no point showing it otherwise).
  const autoAscRow = document.getElementById('auto-ascension-row');
  const autoAscEl2 = document.getElementById('auto-ascension-select');
  if (autoAscRow && autoAscEl2) {
    const endlessWar  = (game.factionSystem?.permanent?.vanguard?.capstoneRank ?? 0) > 0;
    const showAutoAsc = showPrestige && endlessWar;
    autoAscRow.classList.toggle('hidden', !showAutoAsc);
    if (showAutoAsc && autoAscEl2.value !== (game.autoAscensionMode ?? 'off')) {
      autoAscEl2.value = game.autoAscensionMode ?? 'off';
    }
  }

  if (!showPrestige) return;

  // Shard balance
  const shardEl = document.getElementById('prestige-shard-value');
  const shardText = fmt(game.shards);
  if (shardEl.textContent !== shardText) shardEl.textContent = shardText;

  // Passive line — based on totalShardsEarned (spending shards never reduces the bonus)
  const passiveLine = document.getElementById('prestige-passive-line');
  const totalShards = game.totalShardsEarned;
  const mult = fmt(game.shardDmgMult());
  const passiveText = `Shard bonus: ×${mult} dmg (${fmt(totalShards)} total ◆)`;
  if (passiveLine.textContent !== passiveText) passiveLine.textContent = passiveText;

  // Prestige upgrade cards
  for (const entry of prestigeShop.catalogue) {
    const card = document.querySelector(`.prestige-card[data-upg="${entry.id}"]`);
    if (!card) continue;

    // Disabled upgrades — grey out and block purchase
    if (entry.disabled) {
      card.classList.add('is-maxed');
      const tierEl = card.querySelector('[data-tier]');
      if (tierEl && tierEl.textContent !== '[OFF]') tierEl.textContent = '[OFF]';
      const btn = card.querySelector('.prestige-buy-btn');
      setBtn(btn, 'DISABLED', true, true);
      continue;
    }

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
      const label = `◆ ${fmt(cost)}`;
      setBtn(btn, label, !afford, false);
      if (btn.dataset.pid !== entry.id) btn.dataset.pid = entry.id;
    }
  }
}

function patchShopCards() {
  const apex = getApex();
  if (!apex) return;

  const { shop, game } = apex;

  // Currency in tab header
  document.getElementById('currency-value').textContent = fmt(game.currency);

  for (const entry of shop.catalogue) {
    const card = document.querySelector(`.upgrade-card[data-upg="${entry.id}"]`);
    if (!card) continue;

    const tier   = shop.tier(entry.id);
    const maxed  = shop.isMaxed(entry.id);
    const cost   = shop.cost(entry.id);
    const afford = game.currency >= cost;

    // Collapsed state for maxed cards
    if (card.classList.contains('is-maxed') !== maxed) {
      card.classList.toggle('is-maxed', maxed);
    }

    // Tier label
    const tierEl = card.querySelector('[data-tier]');
    const tierText = maxed ? 'MAX' : entry.maxTier === null ? `[${tier}/∞]` : `[${tier}/${entry.maxTier}]`;
    if (tierEl.textContent !== tierText) tierEl.textContent = tierText;
    const wantMaxedClass = maxed;
    if (tierEl.classList.contains('maxed') !== wantMaxedClass) {
      tierEl.classList.toggle('maxed', wantMaxedClass);
    }

    // Buy button
    const btn = card.querySelector('.upgrade-buy-btn');
    if (maxed) {
      setBtn(btn, 'MAXED', true, true);
    } else {
      let label = `$ ${fmt(cost)}`;
      if (!afford && game.recentEarned > 0) {
        const deficit = cost - game.currency;
        const rate = game.recentEarned / 60;
        const secs = Math.min(999, Math.ceil(deficit / rate));
        label = `$ ${fmt(cost)}  ~${secs}s`;
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

// Toast queue — drains one at a time, each shown for 3 s via CSS animation
const _toastQueue   = [];
let   _toastTimeout = null;

function _showNextToast() {
  if (_toastTimeout !== null || _toastQueue.length === 0) return;
  const pet   = _toastQueue.shift();
  const toast = document.getElementById('traitor-toast');
  const color = RARITY_COLOR[pet.rarity] ?? '#9e9e9e';
  const _resonanceMult = getApex()?.game?.resonanceField ? 2 : 1;
  const bonus = petBonus(pet.type, pet.rarity) * _resonanceMult;

  toast.innerHTML = `
    <div id="traitor-toast-label">traitor deserted!</div>
    <div id="traitor-toast-rarity" style="color:${color}">${pet.rarity}</div>
    <div id="traitor-toast-type">${TYPE_LABEL[pet.type] ?? pet.type}</div>
    <div id="traitor-toast-bonus">${fmtPct(bonus)} dmg when active</div>
  `;
  toast.classList.remove('hidden', 'toast-show');
  // Force reflow so animation restarts cleanly
  void toast.offsetWidth;
  toast.classList.add('toast-show');

  _toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('toast-show');
    _toastTimeout = null;
    _showNextToast(); // show next if queued
  }, 3000);
}

// Fingerprint of last rendered traitor state — used to skip unnecessary DOM rebuilds.
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

  // Drain pending announcements → toast queue
  if (game.pendingTraitorAnnouncements?.length > 0) {
    for (const pet of game.pendingTraitorAnnouncements) _toastQueue.push(pet);
    game.pendingTraitorAnnouncements.length = 0;
    _showNextToast();
  }

  // Show/hide tab — visible once the first pet has been captured
  const tabTraitors = document.getElementById('tab-traitors');
  const show = ts.roster.length > 0;
  if (tabTraitors.classList.contains('hidden') === show) {
    tabTraitors.classList.toggle('hidden', !show);
  }
  if (!show) return;

  // Header bonus display
  const resonanceMult = game.resonanceField ? 2 : 1;
  const bonus      = ts.damageBonus() * resonanceMult;
  const bonusEl    = document.getElementById('traitor-bonus-value');
  const bonusText  = fmtPct(bonus);
  if (bonusEl.textContent !== bonusText) bonusEl.textContent = bonusText;

  // Passive line
  const passiveLine = document.getElementById('traitor-passive-line');
  const mult         = (1 + bonus).toFixed(1);
  const activeCount  = ts.activePets().length;
  const passiveText  = `Pet bonus: ×${mult} dmg  (${activeCount}/${ts.slotCount} active)`;
  if (passiveLine.textContent !== passiveText) passiveLine.textContent = passiveText;

  // Only rebuild slots + roster DOM when state actually changed
  const fp = _traitorStateKey(ts);
  if (fp === _traitorFingerprint) return;
  _traitorFingerprint = fp;

  // Active slots
  const slotsEl = document.getElementById('traitor-slots');
  slotsEl.innerHTML = '';
  for (let i = 0; i < ts.slotCount; i++) {
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

  // Roster — grouped by type+rarity, sorted legendary→common
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

  // Sort groups: rarity desc, then damage% desc within same rarity
  const resonanceMult2 = game.resonanceField ? 2 : 1;
  const sortedKeys = Object.keys(counts).sort((a, b) => {
    const [ta, ra] = a.split('|');
    const [tb, rb] = b.split('|');
    const rarityDiff = RARITIES.indexOf(rb) - RARITIES.indexOf(ra);
    if (rarityDiff !== 0) return rarityDiff;
    return petBonus(tb, rb) * resonanceMult2 - petBonus(ta, ra) * resonanceMult2;
  });

  const noEmptySlot = ts.slots.indexOf(null) === -1;

  for (const key of sortedKeys) {
    const [type, rarity] = key.split('|');
    const count  = counts[key];
    const color  = RARITY_COLOR[rarity] ?? '#9e9e9e';
    const bonus  = petBonus(type, rarity) * (game.resonanceField ? 2 : 1);
    const canMrg = ts.canMerge(type, rarity);

    // Is at least one of this group already in a slot?
    const assignedIds = new Set(ts.slots.filter(Boolean));
    const unassignedInGroup = ts.roster.filter(
      p => p.type === type && p.rarity === rarity && !assignedIds.has(p.id)
    );

    const row = document.createElement('div');
    row.className = 'traitor-group';
    row.innerHTML = `
      <span class="rarity-badge" style="color:${color}">${rarity}</span>
      <span class="traitor-group-type">${TYPE_LABEL[type] ?? type}</span>
      <span class="traitor-group-count" style="color:rgba(255,255,255,0.35)">${fmtPct(bonus)} ×${count}</span>
      <button class="traitor-btn traitor-btn-assign"
        data-assign-type="${type}" data-assign-rarity="${rarity}"
        ${(noEmptySlot || unassignedInGroup.length === 0) ? 'disabled' : ''}>SLOT</button>
      ${canMrg
        ? `<button class="traitor-btn traitor-btn-merge" data-merge-type="${type}" data-merge-rarity="${rarity}">MERGE×${ts.mergeCount}</button>`
        : ''}
    `;
    rosterEl.appendChild(row);
  }
}

function wireTraitorButtons() {
  // Slot click — unassign
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

  // Roster — assign or merge
  document.getElementById('traitor-roster').addEventListener('click', e => {
    const apex = getApex();
    if (!apex) return;
    const ts = apex.game.traitorSystem;

    const assignBtn = e.target.closest('[data-assign-type]');
    if (assignBtn && !assignBtn.disabled) {
      const type   = assignBtn.dataset.assignType;
      const rarity = assignBtn.dataset.assignRarity;
      // Find first unassigned pet of this type+rarity
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

// ── Faction tab ────────────────────────────────────────────────────────────

let _factionTreeBuilt = false;  // tree DOM is static after first build

function buildFactionTree(factionId) {
  const treeEl = document.getElementById('faction-tree');
  treeEl.innerHTML = '';

  const nodes = FACTION_NODES[factionId] ?? [];
  // Render in row-major order: tier 1 top (cols A B C), tier 2, tier 3
  for (let tier = 1; tier <= 3; tier++) {
    for (let col = 0; col < 3; col++) {
      const node = nodes.find(n => n.col === col && n.tier === tier);
      if (!node) { treeEl.appendChild(document.createElement('div')); continue; }

      const cell = document.createElement('div');
      cell.className = 'faction-node' + (tier === 3 ? ' no-child' : '');
      cell.dataset.col = String(col);   // used for column-specific tooltip positioning

      // Header row: button + tooltip icon
      const header = document.createElement('div');
      header.className = 'faction-node-header';

      const btn = document.createElement('button');
      btn.className = 'faction-node-btn state-locked';
      btn.dataset.nodeId = node.id;
      btn.textContent = node.shortName;

      const tipIcon = document.createElement('span');
      tipIcon.className = 'upgrade-tooltip-icon';
      tipIcon.textContent = '?';
      tipIcon.setAttribute('aria-label', node.name);
      const tipBox = document.createElement('span');
      tipBox.className = 'upgrade-tooltip-box';
      tipBox.innerHTML = `<strong>${node.name}</strong><br><br>${node.tooltip.replace(/\n/g, '<br>')}`;
      tipIcon.appendChild(tipBox);

      header.appendChild(btn);
      header.appendChild(tipIcon);

      const costEl = document.createElement('div');
      costEl.className = 'faction-node-cost';
      costEl.textContent = fmt(node.cost);

      cell.appendChild(header);
      cell.appendChild(costEl);
      treeEl.appendChild(cell);
    }
  }

  // Capstone
  const cs = FACTION_CAPSTONES[factionId];
  const capArea = document.getElementById('faction-capstone-area');
  capArea.innerHTML = '';
  if (cs) {
    const row = document.createElement('div');
    row.className = 'faction-capstone-row';

    const btn = document.createElement('button');
    btn.id = 'faction-capstone-btn';
    btn.textContent = cs.name;

    const tipIcon = document.createElement('span');
    tipIcon.className = 'upgrade-tooltip-icon';
    tipIcon.textContent = '?';
    tipIcon.setAttribute('aria-label', cs.name);
    const tipBox = document.createElement('span');
    tipBox.className = 'upgrade-tooltip-box';
    tipBox.innerHTML = `<strong>${cs.name}</strong><br><br>${cs.tooltip.replace(/\n/g, '<br>')}`;
    tipIcon.appendChild(tipBox);

    row.appendChild(btn);
    row.appendChild(tipIcon);

    const rank = document.createElement('div');
    rank.id = 'faction-capstone-rank';
    capArea.appendChild(row);
    capArea.appendChild(rank);
  }

  _factionTreeBuilt = true;
}

function patchFactionTab() {
  const apex = getApex();
  if (!apex) return;
  const { game } = apex;
  const fs = game.factionSystem;
  if (!fs) return;

  // Show/hide tab — visible once the player has ascended at least once
  const tabFaction = document.getElementById('tab-faction');
  const showTab = game.ascensionCount > 0;
  if (tabFaction.classList.contains('hidden') === showTab) {
    tabFaction.classList.toggle('hidden', !showTab);
  }

  // Show faction choice overlay if pending
  const overlay = document.getElementById('faction-choice-overlay');
  if (game.pendingFactionChoice) {
    if (overlay.classList.contains('hidden')) {
      _buildFactionChoiceCards(fs);
      overlay.classList.remove('hidden');
      _startFactionChoiceCountdown(fs);
    }
    return; // don't patch tree while choice is pending
  } else {
    if (!overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden');
      _clearFactionChoiceCountdown();
    }
  }

  if (!showTab) return;

  // Neural stack display in tab header
  document.getElementById('faction-stack-value').textContent = String(game.neuralStacks);

  // Status line
  const statusLine = document.getElementById('faction-status-line');
  const fid = fs.activeFaction;
  let statusText = 'No faction active.';
  if (fid) {
    const f = FACTIONS[fid];
    if (fid === 'nexus') {
      const dmgBonus  = game.stackAmplifier ? `×${game.factionDmgMult().toFixed(2)} dmg` : '';
      const currBonus = game.stackAmplifier ? `+${((game.factionCurrencyMult() - 1) * 100).toFixed(1)}% currency` : '';
      const bonuses   = [dmgBonus, currBonus].filter(Boolean).join('  ');
      statusText = `[${f.name}]${bonuses ? '  ' + bonuses : ''}`;
    } else if (fid === 'warborn') {
      const rushBonus = game.warbornBloodRush && game.rushStacks > 0
        ? `  rush ×${(1 + game.rushStacks * 0.03).toFixed(2)} dmg`
        : '';
      statusText = `[${f.name}]${rushBonus}`;
    } else if (fid === 'vanguard') {
      const parts = [];
      if (game.vanguardAdvanceGuard && game.vanguardSpeedBonus > 0)
        parts.push(`spd +${Math.round(game.vanguardSpeedBonus * 100)}%`);
      if (game.vanguardSpoilsOfWar)
        parts.push(`spoils +${game.vanguardSpoilsStacks * 5}% dmg/crit`);
      statusText = `[${f.name}]${parts.length ? '  ' + parts.join('  ') : ''}`;
    } else {
      statusText = `[${f.name}]`;
    }
  }
  if (statusLine.textContent !== statusText) statusLine.textContent = statusText;

  // Only render the tree for the active faction
  if (!fid) return;

  if (!_factionTreeBuilt) buildFactionTree(fid);

  const nodes = FACTION_NODES[fid] ?? [];
  for (const node of nodes) {
    const btn = document.querySelector(`.faction-node-btn[data-node-id="${node.id}"]`);
    if (!btn) continue;

    const purchased   = fs.isNodePurchased(node.id);
    const prereqOk    = !node.prereq || fs.isNodePurchased(node.prereq);
    const canAfford   = game.currency >= node.cost;
    const canBuy      = fs.canPurchaseNode(node.id, game);
    const state       = purchased          ? 'purchased'
                      : !prereqOk          ? 'locked'
                      : !canAfford         ? 'cant-afford'
                      :                      'available';

    const wantClass = `faction-node-btn state-${state}`;
    if (btn.className !== wantClass) btn.className = wantClass;
    btn.disabled = purchased || !canBuy;

    // Update cost text — costEl is a sibling of the header row, not of the button
    const costEl = btn.closest('.faction-node')?.querySelector('.faction-node-cost');
    if (costEl) {
      const costText = purchased ? 'owned' : `$ ${fmt(node.cost)}`;
      if (costEl.textContent !== costText) costEl.textContent = costText;
    }
  }

  // Capstone
  const cs  = FACTION_CAPSTONES[fid];
  const csBtn = document.getElementById('faction-capstone-btn');
  const csRank = document.getElementById('faction-capstone-rank');
  if (cs && csBtn) {
    const rank      = fs.capstoneRank(fid);
    const cost      = fs.capstoneCost(fid);
    const unlocked  = fs.capstoneUnlocked(fid);
    const canBuyCs  = unlocked && game.currency >= cost && fid === fs.activeFaction;
    csBtn.disabled  = !canBuyCs;
    const label     = unlocked ? `${cs.name}  $ ${fmt(cost)}` : `${cs.name}  (locked)`;
    if (csBtn.textContent !== label) csBtn.textContent = label;
    if (csRank) {
      let rankText = `Rank ${rank}`;
      if (fid === 'nexus' && rank > 0) {
        const runStacks = Math.max(0, game.neuralStacks - game.permanentNeuralStacks);
        const projection = Math.floor(runStacks * rank / 100);
        rankText += `  — preserves ${rank}% (≈${projection} stacks) of run stacks`;
      } else if (fid === 'warborn' && rank > 0) {
        const mortarPct = (5 + (rank - 1) * 0.1).toFixed(1);
        const projPct   = (rank * 0.1).toFixed(1);
        const cdRed     = Math.min(30, rank * 0.1).toFixed(1);
        rankText += `  — mortar: ${mortarPct}% HP  proj: ${projPct}% HP  cd -${cdRed}s`;
      } else if (fid === 'vanguard' && rank > 0) {
        const checkBoost = (rank * 25).toFixed(0);
        rankText += `  — obliterate check ×${(1 + rank * 0.25).toFixed(2)}  (+${checkBoost}%)`;
      }
      if (csRank.textContent !== rankText) csRank.textContent = rankText;
    }
  }
}

// Faction choice overlay countdown (Endless War capstone — all factions)
let _factionChoiceCountdown   = null; // setInterval handle
let _factionChoiceCountSecs   = 0;

function _startFactionChoiceCountdown(fs) {
  _clearFactionChoiceCountdown();
  // Start countdown if Endless War capstone is unlocked (covers all factions)
  const game = getApex()?.game;
  const endlessWar = (game?.factionSystem?.permanent?.vanguard?.capstoneRank ?? 0) > 0;
  if (!endlessWar) return;

  const prevFaction = fs.activeFaction;
  if (!prevFaction) return;

  _factionChoiceCountSecs = 10;
  _updateCountdownEl(_factionChoiceCountSecs);

  _factionChoiceCountdown = setInterval(() => {
    _factionChoiceCountSecs -= 1;
    _updateCountdownEl(_factionChoiceCountSecs);
    if (_factionChoiceCountSecs <= 0) {
      _clearFactionChoiceCountdown();
      // Auto-select previous faction
      const apex = getApex();
      if (apex && apex.game.pendingFactionChoice) {
        document.getElementById('faction-choice-overlay').classList.add('hidden');
        _factionTreeBuilt = false;
        apex.completeAscend(prevFaction);
        patchShopCards();
        patchPrestigeCards();
        patchFactionTab();
        patchTraitorPanel();
      }
    }
  }, 1000);
}

function _clearFactionChoiceCountdown() {
  if (_factionChoiceCountdown !== null) {
    clearInterval(_factionChoiceCountdown);
    _factionChoiceCountdown = null;
  }
  _updateCountdownEl(null);
}

function _updateCountdownEl(secs) {
  const el = document.getElementById('faction-choice-countdown');
  if (!el) return;
  if (secs === null || secs <= 0) {
    el.textContent = '';
    el.classList.add('hidden');
  } else {
    el.textContent = `Auto-selecting previous faction in ${secs}s...`;
    el.classList.remove('hidden');
  }
}

function _buildFactionChoiceCards(fs) {
  const cardsEl = document.getElementById('faction-choice-cards');
  cardsEl.innerHTML = '';

  for (const fid of ['nexus', 'warborn', 'vanguard']) {
    const f    = FACTIONS[fid];
    const card = document.createElement('div');
    card.className = 'faction-choice-card' + (f.comingSoon ? ' coming-soon' : '');
    if (fs.activeFaction === fid) card.classList.add('current-faction');
    card.style.borderColor = f.color + '50';

    const isCurrent = fs.activeFaction === fid;
    const btnLabel  = f.comingSoon ? 'COMING SOON'
                    : isCurrent ? 'RE-AFFIRM' : 'CHOOSE';

    card.innerHTML = `
      <div class="faction-card-name" style="color:${f.color}">${f.name}</div>
      <div class="faction-card-flavor">${f.flavor}</div>
      <div class="faction-card-desc">${f.description}</div>
      <button class="faction-card-btn"
        style="border:1px solid ${f.color}80;color:${f.color}"
        data-faction-pick="${fid}"
        ${f.comingSoon ? 'disabled' : ''}>${btnLabel}</button>
    `;
    cardsEl.appendChild(card);
  }
}

function wireFactionButtons() {
  // Faction node purchases (delegated from tree)
  document.getElementById('faction-tree').addEventListener('click', e => {
    const btn = e.target.closest('[data-node-id]');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    const { game } = apex;
    if (game.factionSystem?.purchaseNode(btn.dataset.nodeId, game)) {
      // rebuild tree if slot count changed (Apex Protocol changes mergeCount via reapplyAll)
      _factionTreeBuilt = false;
      patchFactionTab();
      patchTraitorPanel();
    }
  });

  // Faction capstone purchase
  document.getElementById('faction-capstone-area').addEventListener('click', e => {
    const btn = e.target.closest('#faction-capstone-btn');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    const { game } = apex;
    const fid = game.factionSystem?.activeFaction;
    if (fid && game.factionSystem.purchaseCapstone(fid, game)) {
      // 4th slot was granted — rebuild traitor panel
      _traitorFingerprint = '';
      _factionTreeBuilt = false;
      patchTraitorPanel();
      patchFactionTab();
    }
  });

  // Faction choice overlay — pick a faction
  document.getElementById('faction-choice-cards').addEventListener('click', e => {
    const btn = e.target.closest('[data-faction-pick]');
    if (!btn || btn.disabled) return;
    const fid = btn.dataset.factionPick;
    document.getElementById('faction-choice-overlay').classList.add('hidden');
    _clearFactionChoiceCountdown();
    _factionTreeBuilt = false;
    getApex()?.completeAscend(fid);
    patchShopCards();
    patchPrestigeCards();
    patchFactionTab();
    patchTraitorPanel();
  });
}

// ── Tab collapse / expand ──────────────────────────────────────────────────

function _saveTabPrefs() {
  const collapsed = {};
  document.querySelectorAll('.tab-header').forEach(header => {
    const tabId = header.dataset.tab;
    if (tabId) collapsed[tabId] = header.nextElementSibling.classList.contains('tab-body--collapsed');
  });
  const prefs = loadPrefs() ?? {};
  savePrefs({ ...prefs, tabCollapsed: collapsed });
}

export function applyTabPrefs(prefs) {
  if (!prefs?.tabCollapsed) return;
  document.querySelectorAll('.tab-header').forEach(header => {
    const tabId = header.dataset.tab;
    if (tabId == null || !(tabId in prefs.tabCollapsed)) return;
    const body      = header.nextElementSibling;
    const collapsed = prefs.tabCollapsed[tabId];
    body.classList.toggle('tab-body--collapsed', collapsed);
    header.classList.toggle('is-collapsed', collapsed);
  });
}

function wireTabHeaders() {
  document.querySelectorAll('.tab-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const collapsed = body.classList.toggle('tab-body--collapsed');
      header.classList.toggle('is-collapsed', collapsed);
      _saveTabPrefs();
    });
  });
}

// ── Button wiring ──────────────────────────────────────────────────────────

function wireButtons() {
  // Tab collapse
  wireTabHeaders();

  // Traitor slots + roster
  wireTraitorButtons();

  // Faction nodes + capstone + choice overlay
  wireFactionButtons();

  // Upgrade purchases (delegated)
  document.getElementById('upgrade-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    apex.shop.purchase(btn.dataset.id);
    patchShopCards();
  });

  // Prestige upgrade purchases (delegated)
  document.getElementById('prestige-upgrade-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-pid]');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    apex.prestigeShop.purchase(btn.dataset.pid);
    patchPrestigeCards();
  });

  // Ascend button — open confirmation overlay
  document.getElementById('ascend-btn').addEventListener('click', () => {
    const apex = getApex();
    if (!apex) return;
    const { game } = apex;
    const totalAfter = game.shards + game.pendingShards;
    let shardCoeff = 0.10;
    if (game.vanguardBattleHardened) shardCoeff *= 1.5;
    if (game.vanguardShardMastery)   shardCoeff *= 2;
    const multAfter  = (1 + (game.totalShardsEarned + game.pendingShards) * shardCoeff).toFixed(1);
    document.getElementById('ascend-confirm-sub').textContent =
      `+${fmt(game.pendingShards)} ◆  →  ${fmt(totalAfter)} ◆ spendable  →  ×${multAfter} shard damage`;
    document.getElementById('ascend-overlay').classList.remove('hidden');
  });

  document.getElementById('ascend-yes').addEventListener('click', () => {
    document.getElementById('ascend-overlay').classList.add('hidden');
    getApex()?.beginAscend();
    // faction choice overlay will appear on next patchFactionTab tick
    patchShopCards();
    patchPrestigeCards();
  });

  document.getElementById('ascend-no').addEventListener('click', () => {
    document.getElementById('ascend-overlay').classList.add('hidden');
  });

  // Hard Reset
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

  // Auto-ascension dropdown (ENDLESS WAR capstone)
  const autoAscEl = document.getElementById('auto-ascension-select');
  if (autoAscEl) {
    autoAscEl.addEventListener('change', e => {
      getApex()?.setAutoAscensionMode?.(e.target.value);
    });
  }

  // Volume slider
  document.getElementById('volume-slider').addEventListener('input', e => {
    const apex = getApex();
    if (!apex) return;
    const vol = parseInt(e.target.value, 10) / 100;
    apex.audio?.setVolume(vol);
    apex.savePrefs({ quality: apex.game.quality, volume: vol, autoQuality: apex.game.autoQuality });
  });

  // FX level buttons (HIGH / MED / LOW)
  document.getElementById('quality-buttons').addEventListener('click', e => {
    const btn = e.target.closest('.quality-btn');
    if (!btn) return;
    const apex = getApex();
    if (!apex) return;
    apex.setQuality(btn.dataset.q);
    syncQualityUI(apex.game);
  });

  // AUTO toggle button
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
    applyTabPrefs(loadPrefs()); // restore collapse state after DOM is ready
    patchShopCards();
    patchPrestigeCards();
    patchTraitorPanel();
    patchFactionTab();
    syncPrefsUI();
    setInterval(patchShopCards, 250);
    setInterval(patchPrestigeCards, 250);
    setInterval(patchTraitorPanel, 250);
    setInterval(patchFactionTab, 250);
  });
});

// Exposed so main.js can sync the UI after an AUTO step-down
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
