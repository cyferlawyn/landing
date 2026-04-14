// ui.js — shop panel and button wiring
// Patches DOM in-place to avoid hover flicker from full re-renders.

function getApex() { return window.__apex; }

// ── Initial DOM build (runs once) ──────────────────────────────────────────

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

function patchShopCards() {
  const apex = getApex();
  if (!apex) return;

  const { shop, game } = apex;

  // Currency
  document.getElementById('currency-value').textContent = game.currency;

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
      let label = `$ ${cost}`;
      if (!afford && game.recentEarned > 0) {
        const deficit = cost - game.currency;
        // recentEarned is per 60s window; convert to per-second rate
        const rate = game.recentEarned / 60;
        const secs = Math.min(999, Math.ceil(deficit / rate));
        label = `$ ${cost}  ~${secs}s`;
      }
      setBtn(btn, label, !afford, false);
      // Ensure data-id stays (shouldn't change but be safe)
      if (btn.dataset.id !== entry.id) btn.dataset.id = entry.id;
    }
  }
}

function setBtn(btn, text, disabled, maxed) {
  if (btn.textContent !== text) btn.textContent = text;
  if (btn.disabled !== disabled) btn.disabled = disabled;
  if (btn.classList.contains('maxed') !== maxed) btn.classList.toggle('maxed', maxed);
}

// ── Button wiring ──────────────────────────────────────────────────────────

function wireButtons() {
  // Upgrade purchases (delegated — single listener on the list)
  document.getElementById('upgrade-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-id]');
    if (!btn || btn.disabled) return;
    const apex = getApex();
    if (!apex) return;
    apex.shop.purchase(btn.dataset.id);
    patchShopCards();
  });

  // Self-destruct — voluntary defeat, no confirmation needed
  document.getElementById('self-destruct-btn').addEventListener('click', () => {
    getApex()?.selfDestruct();
  });

  // New Game
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

  // Volume slider
  document.getElementById('volume-slider').addEventListener('input', e => {
    const apex = getApex();
    if (!apex) return;
    const vol = parseInt(e.target.value, 10) / 100;
    apex.audio?.setVolume(vol);
    apex.savePrefs({ quality: apex.game.quality, volume: vol, autoQuality: apex.game.autoQuality });
  });

  // FX level buttons (HIGH / MED / LOW) — clicking one disables AUTO
  document.getElementById('quality-buttons').addEventListener('click', e => {
    const btn = e.target.closest('.quality-btn');
    if (!btn) return;
    const apex = getApex();
    if (!apex) return;
    apex.setQuality(btn.dataset.q); // sets autoQuality = false
    syncQualityUI(apex.game);
  });

  // AUTO toggle button
  document.getElementById('auto-quality-btn').addEventListener('click', () => {
    const apex = getApex();
    if (!apex) return;
    if (apex.game.autoQuality) {
      // Turn AUTO off — revert to the quality AUTO currently holds
      apex.setQuality(apex.game.quality);
    } else {
      apex.setQuality('auto');
    }
    syncQualityUI(apex.game);
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  // Give main.js one tick to set window.__apex
  requestAnimationFrame(() => {
    buildShopCards();
    wireButtons();
    patchShopCards();
    syncPrefsUI();
    setInterval(patchShopCards, 250);
  });
});

// Exposed so main.js can sync the UI after an AUTO step-down
window.__syncQualityUI = () => {
  const apex = getApex();
  if (apex) syncQualityUI(apex.game);
};

// Reflect saved prefs back onto the controls
function syncPrefsUI() {
  const apex = getApex();
  if (!apex) return;
  syncQualityUI(apex.game);

  // Volume slider
  const vol = apex.audio?.volume ?? 0.4;
  document.getElementById('volume-slider').value = Math.round(vol * 100);
}

// Sync quality buttons to current game state.
// Called on load, on manual quality change, and after AUTO steps down.
function syncQualityUI(game) {
  const isAuto = game.autoQuality;
  const q      = game.quality ?? 'high';

  // Level buttons: cyan .active when manually chosen, yellow .auto-active when AUTO picked it
  document.querySelectorAll('.quality-btn').forEach(b => {
    b.classList.toggle('active',      !isAuto && b.dataset.q === q);
    b.classList.toggle('auto-active',  isAuto && b.dataset.q === q);
  });

  // AUTO toggle button
  document.getElementById('auto-quality-btn').classList.toggle('active', isAuto);
}
