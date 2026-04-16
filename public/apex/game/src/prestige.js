// prestige.js — Prestige (Ascension) upgrade catalogue and shop
// Costs are in Shards. All upgrades persist across Ascensions.
// The PrestigeShop interface mirrors Shop so ui.js can drive both identically.

const PRESTIGE_UPGRADES = [
  // ── Quality of Life ──────────────────────────────────────────────────────
  {
    id: 'startCurrency',
    name: 'War Chest',
    tooltip: 'Start each run with bonus currency.\nTier 1: +500  Tier 2: +1 000  Tier 3: +2 000\nTier 4: +4 000  Tier 5: +8 000',
    maxTier: 5,
    baseCost: 1,
    costMult: 2.0,
    apply(tower, game, tier) {
      // Applied once at run start in main.js — stored as game.prestigeStartCurrency
      const bonus = [0, 500, 1000, 2000, 4000, 8000];
      game.prestigeStartCurrency = bonus[tier] ?? 8000;
    },
  },
  {
    id: 'skipWaves',
    name: 'Head Start',
    tooltip: 'Run begins at a later wave, skipping the early grind.\nTier 1: wave 6  Tier 2: wave 11  Tier 3: wave 16\nTier 4: wave 21  Tier 5: wave 26',
    maxTier: 5,
    baseCost: 2,
    costMult: 2.0,
    apply(tower, game, tier) {
      const starts = [1, 6, 11, 16, 21, 26];
      game.prestigeStartWave = starts[tier] ?? 26;
    },
  },
  {
    id: 'bounty2',
    name: 'Bounty II',
    tooltip: 'Further multiplies all kill rewards by ×1.10 per tier.\nStacks multiplicatively with Bounty I.\nMax (tier 10): ×2.59 additional multiplier.',
    maxTier: 10,
    baseCost: 3,
    costMult: 1.8,
    apply(tower, game, tier) {
      game.currencyMultiplier *= 1.10;
    },
  },

  // ── Damage Scaling ───────────────────────────────────────────────────────
  {
    id: 'critChance',
    name: 'Critical Strike',
    tooltip: 'Main gun projectiles have a chance to deal double damage.\nTier 1: 10%  Tier 2: 20%  Tier 3: 30%\nTier 4: 40%  Tier 5: 50% crit chance.',
    maxTier: 5,
    baseCost: 5,
    costMult: 1.8,
    apply(tower, game, tier) {
      tower.critChance = tier * 0.10;
    },
  },
  {
    id: 'critDamage',
    name: 'Critical Power',
    tooltip: 'Increases the damage multiplier of critical hits.\nBase crit: ×2.0.  Each tier adds ×0.25.\nMax (tier 5): ×3.25 crit damage.',
    maxTier: 5,
    baseCost: 4,
    costMult: 1.8,
    apply(tower, game, tier) {
      tower.critMult = 2.0 + tier * 0.25;
    },
  },
  {
    id: 'execute',
    name: 'Execute',
    tooltip: 'Projectile hits instantly kill enemies below an HP threshold.\nTier 1: 5%  Tier 2: 10%  Tier 3: 15% remaining HP.\nApplies to all enemy types including Bosses.',
    maxTier: 3,
    baseCost: 8,
    costMult: 2.0,
    apply(tower, game, tier) {
      tower.executeThreshold = tier * 0.05;
    },
  },

  // ── Utility / CC ─────────────────────────────────────────────────────────
  {
    id: 'laserSlow',
    name: 'Laser Chill',
    tooltip: 'Laser Burst hits slow enemy movement speed for 2 seconds.\nTier 1: −25%  Tier 2: −40%  Tier 3: −55% speed.',
    maxTier: 3,
    baseCost: 6,
    costMult: 2.0,
    apply(tower, game, tier) {
      tower.laserSlowFactor    = [0, 0.75, 0.60, 0.45][tier];
      tower.laserSlowDuration  = 2.0;
    },
  },
  {
    id: 'ringSlow',
    name: 'Ring Stun',
    tooltip: 'Orbital Death Ring contact briefly stuns enemies (stops movement).\nTier 1: 0.3 s  Tier 2: 0.5 s  Tier 3: 0.75 s stun.',
    maxTier: 3,
    baseCost: 8,
    costMult: 2.0,
    apply(tower, game, tier) {
      tower.ringStunDuration = [0, 0.3, 0.5, 0.75][tier];
    },
  },
  {
    id: 'shield',
    name: 'Shield',
    tooltip: 'Tower gains a shield charge that absorbs one hit per wave,\nthen grants 1.5 s of invulnerability.\nTier 1: 1 charge  Tier 2: 2 charges  Tier 3: 3 charges per wave.',
    maxTier: 3,
    baseCost: 10,
    costMult: 2.2,
    apply(tower, game, tier) {
      tower.shieldChargesMax = tier;
      // Charges are refreshed at wave start in main.js
      if (tower.shieldCharges === undefined || tower.shieldCharges < tier) {
        tower.shieldCharges = tier;
      }
    },
  },
];

export class PrestigeShop {
  constructor(game) {
    this.game      = game;
    this.catalogue = PRESTIGE_UPGRADES;
  }

  tier(id) {
    return this.game.prestigeUpgrades[id] ?? 0;
  }

  cost(id) {
    const entry = this._entry(id);
    if (!entry) return Infinity;
    const t = this.tier(id);
    return Math.round(entry.baseCost * Math.pow(entry.costMult, t));
  }

  canAfford(id) {
    return this.game.shards >= this.cost(id);
  }

  isMaxed(id) {
    const entry = this._entry(id);
    if (!entry) return true;
    if (entry.maxTier === null) return false;
    return this.tier(id) >= entry.maxTier;
  }

  purchase(id) {
    if (this.isMaxed(id) || !this.canAfford(id)) return false;
    const entry = this._entry(id);
    this.game.shards -= this.cost(id);
    this.game.prestigeUpgrades[id] = this.tier(id) + 1;
    entry.apply(this.game.tower, this.game, this.game.prestigeUpgrades[id]);
    return true;
  }

  // Re-apply all prestige upgrades from scratch.
  // Must be called after tower is rebuilt (reapplyAll in shop.js).
  reapplyAll(prestigeUpgrades) {
    // Reset prestige-driven tower fields to defaults before replaying
    this.game.tower.critChance          = 0;
    this.game.tower.critMult            = 2.0;
    this.game.tower.executeThreshold    = 0;
    this.game.tower.laserSlowFactor     = 1.0;  // 1.0 = no slow
    this.game.tower.laserSlowDuration   = 0;
    this.game.tower.ringStunDuration    = 0;
    this.game.tower.shieldChargesMax    = 0;
    this.game.tower.shieldCharges       = 0;
    this.game.tower.invulnTimer         = 0;
    this.game.prestigeStartCurrency     = 0;
    this.game.prestigeStartWave         = 1;

    for (const entry of this.catalogue) {
      const tiers = prestigeUpgrades[entry.id] ?? 0;
      for (let t = 1; t <= tiers; t++) {
        entry.apply(this.game.tower, this.game, t);
      }
      if (tiers > 0) this.game.prestigeUpgrades[entry.id] = tiers;
    }
  }

  _entry(id) {
    return this.catalogue.find(u => u.id === id) ?? null;
  }
}
