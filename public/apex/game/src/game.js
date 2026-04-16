export const State = Object.freeze({
  COMBAT:   'COMBAT',
  DEFEATED: 'DEFEATED',
});

export class Game {
  constructor() {
    this.state              = State.COMBAT;
    this.wave               = 1;
    this.currency           = 0;
    this.currencyMultiplier = 1.0;
    this.waveEarned         = 0;  // display accumulator only — not banked at end
    this.lastWave           = 0;
    this.lastWaveEarned     = 0;
    this.bestWave           = 1;
    this.upgrades           = {};
    this.tower              = null;
    this.enemyPool          = null;
    this.projectilePool     = null;
    this.waveSpawner        = null;
    this.overlayTimer       = 0;
    this.DEFEATED_DURATION  = 3;
    this.resultsTimer       = 0;  // counts down; results overlay shown while > 0
    this.RESULTS_DURATION   = 2;

    // Short-lived visual effects (drained each frame by renderer)
    this.explosions    = []; // { x, y, r, t } — t counts down to 0
    this.lightningArcs = []; // { x1, y1, x2, y2, t }
    this.deathRings    = []; // { x, y, r, t, color } — expanding ring on enemy death
    this.edgeFlash     = 0;  // seconds remaining for boss screen-edge flash
    this.currencyPopups = []; // { amount, x, y, t } — +$N floaters above killed enemies

    // Particle system — initialized in main.js after bootstrap
    this.particles = null;

    // Visual quality: 'high' | 'medium' | 'low'
    // Loaded from localStorage in main.js; default high.
    this.quality     = 'high';
    this.autoQuality = false;  // when true, AUTO mode may step quality down

    // FPS tracking — maintained by main.js loop, read by renderer
    this.fps         = 60;     // smoothed display value

    // Rolling 60-second earned tally — used by shop UI to estimate time-to-afford.
    // _earnLog entries: { amount, age } where age counts up; purged when age > 60s.
    this._earnLog    = [];
    this.recentEarned = 0;     // sum of _earnLog amounts (kept in sync)

    // ── Prestige (Ascension) ────────────────────────────────────────────────
    // pendingShards: earned this run from wave-50+ boss kills; locked until Ascension
    // shards: spendable balance (spent shards are deducted from this)
    // totalShardsEarned: monotonically increasing — never decremented; drives passive dmg bonus
    // prestigeUpgrades: purchased prestige tiers, persist across Ascensions
    // ascensionCount: number of times player has ascended (cosmetic / future use)
    this.pendingShards      = 0;
    this.shards             = 0;
    this.totalShardsEarned  = 0;
    this.prestigeUpgrades   = {};
    this.ascensionCount     = 0;

    // ── Traitor (pet) system ────────────────────────────────────────────────
    this.traitorSystem              = null; // set in main.js bootstrap
    this.pendingTraitorAnnouncements = [];  // [{ type, rarity }] drained by ui.js
  }

  transition(newState) {
    this.state        = newState;
    this.overlayTimer = 0;
  }

  tickOverlay(dt) {
    this.overlayTimer += dt;
    return this.overlayTimer >= this.DEFEATED_DURATION;
  }

  // Call once per frame from main.js to age out old entries.
  tickEarnLog(dt) {
    const WINDOW = 60; // seconds
    for (const e of this._earnLog) e.age += dt;
    const before = this._earnLog.length;
    this._earnLog = this._earnLog.filter(e => e.age < WINDOW);
    if (this._earnLog.length !== before) {
      this.recentEarned = this._earnLog.reduce((s, e) => s + e.amount, 0);
    }
  }

  // Record a kill reward in the rolling window.
  logEarned(amount) {
    this._earnLog.push({ amount, age: 0 });
    this.recentEarned += amount;
  }

  // Award pending shards for killing a boss on wave >= 50.
  // Formula: floor(1 + (wave-50)/10) × milestone multiplier
  // Milestone ×3 at x00 waves, ×10 at x000 waves.
  awardShards(wave) {
    if (wave < 50) return;
    const base = Math.floor(1 + (wave - 50) / 10);
    const mult = wave % 1000 === 0 ? 10
               : wave % 100  === 0 ? 3
               : 1;
    this.pendingShards += base * mult;
    // totalShardsEarned is incremented in ascend() when pending shards are claimed
  }

  // Passive damage multiplier from total shards ever earned (spent shards still count).
  shardDmgMult() {
    return 1 + this.totalShardsEarned * 0.10;
  }

  // Multiplicative damage bonus from active traitor pets (additive per-pet, then ×1+sum).
  traitorDmgMult() {
    return 1 + (this.traitorSystem?.damageBonus() ?? 0);
  }
}
