// prestige.js — Prestige (Ascension) upgrade catalogue and shop
// Costs are in Shards. All upgrades persist across Ascensions.
// The PrestigeShop interface mirrors Shop so ui.js can drive both identically.

const PRESTIGE_UPGRADES = [
  // baseCost: 2
  {
    id: 'autoBuy',
    name: 'Auto-Buyer',
    tooltip: 'Automatically purchases the cheapest available upgrade every N seconds.\nTier 1: 30 s  Tier 2: 24 s  Tier 3: 18 s\nTier 4: 12 s  Tier 5: 6 s  Tier 6: instant (every tick)',
    maxTier: 6,
    baseCost: 2,
    costMult: 2.5,
    apply(tower, game, tier) {
      const intervals = [0, 30, 24, 18, 12, 6, 0];
      game.autoBuyInterval = intervals[tier] ?? 0;
    },
  },

  // baseCost: 10
  {
    id: 'startCurrency',
    name: 'War Chest',
    tooltip: 'Start each run with bonus currency.\nTier 1: +1k  Tier 2: +2.5k  Tier 3: +5k  Tier 4: +10k  Tier 5: +25k\nTier 6: +50k  Tier 7: +100k  Tier 8: +250k  Tier 9: +500k  Tier 10: +1M',
    maxTier: 10,
    baseCost: 10,
    costMult: 2.5,
    apply(tower, game, tier) {
      const bonus = [0, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
      game.prestigeStartCurrency = bonus[tier] ?? 1000000;
    },
  },
  // Wave Rush was removed in v1.9.0 — replaced by THE VANGUARD A2 (Tide Surge).
  // Any previously purchased tiers are refunded in shards at load time (see reapplyAll).
  {
    id: 'bounty2',
    name: 'Bounty II',
    tooltip: 'Further multiplies all kill rewards by ×1.10 per tier.\nStacks multiplicatively with Bounty I.\nMax (tier 10): ×2.59 additional multiplier.',
    maxTier: 10,
    baseCost: 10,
    costMult: 2.0,
    apply(tower, game, tier) {
      game.currencyMultiplier *= 1.10;
    },
  },
  {
    id: 'critChance',
    name: 'Critical Strike',
    tooltip: 'Main gun projectiles have a chance to deal double damage.\nTier 1: 10%  Tier 2: 20%  …  Tier 10: 100% crit chance.',
    maxTier: 10,
    baseCost: 10,
    costMult: 2.2,
    apply(tower, game, tier) {
      tower.critChance = Math.min(1.0, tier * 0.10);
    },
  },

  // baseCost: 15
  {
    id: 'critDamage',
    name: 'Critical Power',
    tooltip: 'Increases the damage multiplier of critical hits.\nBase crit: ×2.0.  Each tier adds ×0.25.\nMax (tier 5): ×3.25 crit damage.',
    maxTier: 5,
    baseCost: 15,
    costMult: 2.2,
    apply(tower, game, tier) {
      tower.critMult = 2.0 + tier * 0.25;
    },
  },
  {
    id: 'laserSlow',
    name: 'Laser Chill',
    tooltip: 'Laser Burst hits slow enemy movement speed for 2 seconds.\nTier 1: −25%  Tier 2: −40%  Tier 3: −55% speed.',
    maxTier: 3,
    baseCost: 15,
    costMult: 2.0,
    apply(tower, game, tier) {
      tower.laserSlowFactor    = [0, 0.75, 0.60, 0.45][tier];
      tower.laserSlowDuration  = 2.0;
    },
  },

  // baseCost: 20
  {
    id: 'ricochet',
    name: 'Ricochet',
    tooltip: 'Projectiles bounce to an additional enemy after each hit.\nTier 1: 1 bounce  Tier 2: 2 bounces  Tier 3: 3 bounces.\nBounces inherit explosive and chain effects at 75% damage.',
    maxTier: 3,
    baseCost: 20,
    costMult: 2.5,
    apply(tower, game, tier) {
      tower.ricochetCount = tier;
    },
  },
  {
    id: 'ringSlow',
    name: 'Ring Stun',
    tooltip: 'Orbital Death Ring contact briefly stuns enemies (stops movement).\nTier 1: 0.3 s  Tier 2: 0.5 s  Tier 3: 0.75 s stun.',
    maxTier: 3,
    baseCost: 20,
    costMult: 2.0,
    apply(tower, game, tier) {
      tower.ringStunDuration = [0, 0.3, 0.5, 0.75][tier];
    },
  },

  // baseCost: 25
  {
    id: 'poisonTouch',
    name: 'Poison Touch',
    tooltip: 'Projectile hits apply a poison that deals bonus damage over 3 seconds in ticks every 0.1s.\nTier 1: 25%  Tier 2: 40%  Tier 3: 55% of hit damage as DoT.\nPoison stacks additively and refreshes duration on each new hit.',
    maxTier: 3,
    baseCost: 25,
    costMult: 2.5,
    apply(tower, game, tier) {
      tower.poisonFraction = [0, 0.25, 0.40, 0.55][tier];
    },
  },

  // baseCost: 30
  {
    id: 'veteranBounty',
    name: "Veteran's Bounty",
    tooltip: 'When ascending, earn bonus shards based on the wave you reached.\nTier 1: +1 shard per 20 waves  Tier 2: per 15 waves  Tier 3: per 10 waves.\nStacks with all other shard sources.',
    maxTier: 3,
    baseCost: 30,
    costMult: 3.5,
    apply(tower, game, tier) {
      game.veteranBonusDivisor = [0, 20, 15, 10][tier];
    },
  },

  // baseCost: 50
  {
    id: 'shardTithe',
    name: 'Shard Tithe',
    tooltip: 'Boss kills yield more shards.\nEach tier multiplies shard rewards by ×1.25.\nMax (tier 10): 9.31× shard income.\nCosts: 50 / 150 / 450 / … shards.',
    maxTier: 10,
    baseCost: 50,
    costMult: 3.0,
    apply(tower, game, tier) {
      game.shardBonusMult *= 1.25;
    },
  },

  // baseCost: 100
  {
    id: 'execute',
    name: 'Execute',
    tooltip: 'Projectile hits instantly kill enemies below an HP threshold.\nTier 1: 5%  Tier 2: 10%  Tier 3: 15% remaining HP.\nApplies to all enemy types except Bosses (see Apex Predator for bosses).',
    maxTier: 3,
    baseCost: 100,
    costMult: 3.5,
    apply(tower, game, tier) {
      tower.executeThreshold = tier * 0.05;
    },
  },

  // baseCost: 200
  {
    id: 'resurgence',
    name: 'Resurgence',
    tooltip: 'Once per run, when the tower would be destroyed, it survives at reduced HP.\nTier 1: revive at 25% HP  Tier 2: revive at 50% HP.\nGrants 2 s of invulnerability on proc.',
    maxTier: 2,
    baseCost: 200,
    costMult: 4.0,
    apply(tower, game, tier) {
      tower.resurgenceHp = [0, 0.25, 0.50][tier];
    },
  },

  // baseCost: 500
  {
    id: 'overchargeAmp',
    name: 'Overcharge Amplifier',
    tooltip: 'Increases the Overcharge shot damage multiplier beyond the base ×4.\n+×0.5 per tier. Max (tier 5): ×6.5 per overcharge shot.\nRequires Overcharge shop upgrade to be purchased.\nCosts: 500 / 2k / 8k / 32k / 128k shards.',
    maxTier: 5,
    baseCost: 500,
    costMult: 4.0,
    apply(tower, game, tier) {
      tower.overchargeAmp += 0.5;
    },
  },

  // baseCost: 1000
  {
    id: 'obliterate',
    name: 'Obliterate',
    tooltip: 'When your shot damage exceeds 10× the weakest enemy\'s current HP,\na countdown begins — then the entire wave is wiped instantly.\nTier 1: 5 s  Tier 2: 4 s  Tier 3: 3 s  Tier 4: 2 s  Tier 5: 1 s countdown.\nCosts: 1k / 5k / 25k / 125k / 625k shards.',
    maxTier: 5,
    baseCost: 1000,
    costMult: 5.0,
    apply(tower, game, tier) {
      tower.obliterateDelay = [0, 5, 4, 3, 2, 1][tier];
    },
  },
  {
    id: 'detonationField',
    name: 'Detonation Field',
    tooltip: 'Multiplies total explosion radius and applies a 1s slow to all enemies caught in the blast.\n+15% total radius per tier.\nTier 1: ×1.15  Tier 2: ×1.30  Tier 3: ×1.45  Tier 4: ×1.60 total radius.\nRequires Explosive Rounds shop upgrade.\nCosts: 1k / 5k / 25k / 125k shards.',
    maxTier: 4,
    baseCost: 1000,
    costMult: 5.0,
    apply(tower, game, tier) {
      tower.detonationRadiusMult = 1 + tier * 0.15;
      tower.detonationSlow = tier > 0 ? 1.0 : 0;
    },
  },

  // baseCost: 2000
  {
    id: 'voidSurge',
    name: 'Void Surge',
    tooltip: 'Permanently multiplies ALL damage output by ×1.20 per tier.\nAffects main gun, laser, orbital ring, explosions, chain lightning, and poison.\nTier 1: ×1.20  Tier 2: ×1.44  Tier 3: ×1.73  Tier 4: ×2.07  Tier 5: ×2.49.\nCosts: 2k / 8k / 32k / 128k / 512k shards.',
    maxTier: 5,
    baseCost: 2000,
    costMult: 4.0,
    apply(tower, game, tier) {
      tower.voidSurgeMult *= 1.20;
    },
  },

  // baseCost: 3000
  {
    id: 'echoShot',
    name: 'Echo Shot',
    tooltip: 'After a multi-shot volley fires, a chance to instantly fire a free extra volley.\nRequires Multi-Shot shop upgrade.\nTier 1: 15%  Tier 2: 30%  Tier 3: 45%  Tier 4: 60%  Tier 5: 75% chance.\nCosts: 3k / 12k / 48k / 192k / 768k shards.',
    maxTier: 5,
    baseCost: 3000,
    costMult: 4.0,
    apply(tower, game, tier) {
      tower.echoShotChance = tier * 0.15;
    },
  },

  // baseCost: 5000
  {
    id: 'forgeEternal',
    name: 'Forge Eternal',
    tooltip: 'Permanently adds flat bonus damage applied before all multipliers.\n+50 damage per tier, stacking across ascensions.\nTier 5: +250 base damage (stacks with Damage shop upgrade).\nCosts: 5k / 20k / 80k / 320k / 1.28M shards.',
    maxTier: 5,
    baseCost: 5000,
    costMult: 4.0,
    apply(tower, game, tier) {
      tower.forgeDmg += 50;
    },
  },
  {
    id: 'arcMastery',
    name: 'Arc Mastery',
    tooltip: 'Chain Lightning jumps an additional time per tier.\nEach jump deals ×1.20 the previous jump\'s damage (escalating rather than decaying).\nTier 1: +1 jump  Tier 2: +2 jumps  Tier 3: +3 extra jumps.\nRequires Chain Lightning shop upgrade.\nCosts: 5k / 25k / 125k shards.',
    maxTier: 3,
    baseCost: 5000,
    costMult: 5.0,
    apply(tower, game, tier) {
      tower.arcMasteryJumps = tier;
      tower.arcMasteryDmgMult = tier > 0 ? 1.20 : 1.0;
    },
  },

  // baseCost: 8000
  {
    id: 'eternalArsenal',
    name: 'Eternal Arsenal',
    tooltip: 'Permanently grants bonus fire rate and an extra simultaneous target per tier.\n+5% fire rate and +1 target per tier, stacking on top of shop upgrades.\nTier 4: +20% fire rate and 4 extra targets.\nCosts: 8k / 40k / 200k / 1M shards.',
    maxTier: 4,
    baseCost: 8000,
    costMult: 5.0,
    apply(tower, game, tier) {
      tower.arsenalFireRateBonus = tier * 0.05;
      tower.arsenalProjBonus     = tier;
    },
  },

  // baseCost: 10000
  {
    id: 'shardCovenant',
    name: 'Shard Covenant',
    tooltip: 'At the start of each wave, your shard balance is converted into a bonus damage multiplier.\nTier 1: ×(1 + shards × 0.01%)  Tier 2: ×(1 + shards × 0.02%)  Tier 3: ×(1 + shards × 0.04%).\nExample at tier 1 with 10k shards: ×2.0 bonus.\nCosts: 10k / 50k / 250k shards.',
    maxTier: 3,
    baseCost: 10000,
    costMult: 5.0,
    apply(tower, game, tier) {
      game.shardCovenantMult = [0, 0.0001, 0.0002, 0.0004][tier];
    },
  },

  // baseCost: 50000
  {
    id: 'apexPredator',
    name: 'Apex Predator',
    tooltip: 'Execute now works on Boss enemies up to a HP threshold (additive with base Execute).\nOn any execute kill, gain +50% fire rate for 3 s.\nTier 1: 5%  Tier 2: 10%  Tier 3: 15% Boss execute threshold.\nCosts: 50k / 200k / 800k shards.',
    maxTier: 3,
    baseCost: 50000,
    costMult: 4.0,
    apply(tower, game, tier) {
      tower.apexBossExecute    = tier * 0.05;
      tower.apexFireRateBurst  = tier > 0 ? 0.50 : 0;
      tower.apexBurstDuration  = 3.0;
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
    const entry = this._entry(id);
    if (!entry || entry.disabled || this.isMaxed(id) || !this.canAfford(id)) return false;
    this.game.shards -= this.cost(id);
    this.game.prestigeUpgrades[id] = this.tier(id) + 1;
    entry.apply(this.game.tower, this.game, this.game.prestigeUpgrades[id]);
    return true;
  }

  // Re-apply all prestige upgrades from scratch.
  // Must be called after tower is rebuilt (reapplyAll in shop.js).
  reapplyAll(prestigeUpgrades) {
    // Wave Rush was removed in v1.9.0. Refund shards for any prior purchase.
    // Cost table was: baseCost 2, costMult 2.0 → tiers 1-5 cost 2, 4, 8, 16, 32 = 62 total
    const waveRushTiers = prestigeUpgrades['waveRush'] ?? 0;
    if (waveRushTiers > 0) {
      let refund = 0;
      const baseCost = 2, costMult = 2.0;
      for (let t = 0; t < waveRushTiers; t++) refund += Math.round(baseCost * Math.pow(costMult, t));
      this.game.shards += refund;
      delete prestigeUpgrades['waveRush'];
      console.log(`Wave Rush refunded: +${refund} shards`);
    }

    // Reset prestige-driven tower fields to defaults before replaying
    this.game.tower.critChance          = 0;
    this.game.tower.critMult            = 2.0;
    this.game.tower.executeThreshold    = 0;
    this.game.tower.laserSlowFactor     = 1.0;  // 1.0 = no slow
    this.game.tower.laserSlowDuration   = 0;
    this.game.tower.ringStunDuration    = 0;
    this.game.tower.invulnTimer         = 0;
    this.game.tower.ricochetCount       = 0;
    this.game.tower.poisonFraction      = 0;
    this.game.tower.resurgenceHp        = 0;
    this.game.tower.resurgenceUsed      = false;
    this.game.tower.waveSkipThreshold   = 0;
    this.game.tower.obliterateDelay     = 0;
    this.game.prestigeStartCurrency     = 0;
    this.game.prestigeStartWave         = 1;
    this.game.autoBuyInterval           = 0;
    this.game.autoBuyTimer              = 0;
    this.game.shardBonusMult            = 1.0;
    this.game.veteranBonusDivisor       = 0;
    // New high-end talent fields
    this.game.tower.voidSurgeMult       = 1.0;
    this.game.tower.forgeDmg            = 0;
    this.game.tower.overchargeAmp       = 0;
    this.game.tower.echoShotChance      = 0;
    this.game.shardCovenantMult         = 0;
    this.game.tower.arcMasteryJumps     = 0;
    this.game.tower.arcMasteryDmgMult   = 1.0;
    this.game.tower.detonationRadiusMult = 1.0;
    this.game.tower.detonationSlow      = 0;
    this.game.tower.arsenalFireRateBonus = 0;
    this.game.tower.arsenalProjBonus    = 0;
    this.game.tower.apexBossExecute     = 0;
    this.game.tower.apexFireRateBurst   = 0;
    this.game.tower.apexBurstDuration   = 3.0;
    this.game.tower.apexBurstTimer      = 0;
    this.game.tower.shardCovenantBonus  = 1.0;

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
