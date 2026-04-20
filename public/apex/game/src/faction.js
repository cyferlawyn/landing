// faction.js — Faction (Covenant) system
// NEXUS is fully implemented. THE WARBORN is implemented. THE VANGUARD is implemented.

// Rarity tier index used by Stack Cascade (1 = common … 10 = apex)
export const RARITY_TIER = {
  common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5,
  mythic: 6, divine: 7, celestial: 8, transcendent: 9, apex: 10,
};

// ── Faction metadata ───────────────────────────────────────────────────────

export const FACTIONS = {
  nexus: {
    id:          'nexus',
    name:        'NEXUS',
    color:       '#00e5ff',
    flavor:      '"The machine never sleeps. Join us, and neither will your tower."',
    description: 'Deepens the traitor system. Neural Stacks amplify all damage and currency. Passive compounding.',
    comingSoon:  false,
  },
  conclave: {
    id:          'conclave',
    name:        'THE CONCLAVE',
    color:       '#ffd600',
    flavor:      '"We have seen a thousand wars. We know where every battle is won."',
    description: 'Coming soon.',
    comingSoon:  true,
  },
  warborn: {
    id:          'warborn',
    name:        'THE WARBORN',
    color:       '#ff1744',
    flavor:      '"The tower fights for you. Now fight for it."',
    description: 'Mortar artillery, active abilities, and escalating Rush Stacks. Aggression rewarded.',
    comingSoon:  false,
  },
  vanguard: {
    id:          'vanguard',
    name:        'THE VANGUARD',
    color:       '#76ff03',
    flavor:      '"Every wave is a resource. Learn to spend it wisely."',
    description: 'Wave farming and shard scaling. Carry enemies between waves for mounting damage. Long-game capstone synergies for all factions.',
    comingSoon:  false,
  },
};

// ── Node definitions ───────────────────────────────────────────────────────
// col: 0=A, 1=B, 2=C   tier: 1-3   prereq: nodeId or null

export const FACTION_NODES = {
  warborn: [
    // ── Column A: Mortar ──────────────────────────────────────────────────────
    {
      id: 'warborn_a1', col: 0, tier: 1, prereq: null,
      name: 'Field Artillery',
      shortName: 'Artillery',
      tooltip: 'Mortar loop: 0.75 s shrinking crosshair tracks cursor → locks → 0.25 s flight → 50 px AoE at 100% normalized shot damage → repeat.\nFires roughly once per second. Click to freeze/unfreeze the crosshair.',
      cost: 500_000,
      apply(game) { game.warbornMortar = true; },
    },
    {
      id: 'warborn_a2', col: 0, tier: 2, prereq: 'warborn_a1',
      name: 'Heavy Ordnance',
      shortName: 'Heavy Ord.',
      tooltip: 'Mortar blast radius 150 px. Mortar deals 300% normalized shot damage. Mortar hits stun enemies for 0.5 s.',
      cost: 2_500_000,
      apply(game) { game.warbornHeavyOrdnance = true; },
    },
    {
      id: 'warborn_a3', col: 0, tier: 3, prereq: 'warborn_a2',
      name: 'Carpet Bombing',
      shortName: 'Carpet Bomb',
      tooltip: '4 extra mortars detonate 100 px N/S/E/W from the primary impact point.',
      cost: 12_500_000,
      apply(game) { game.warbornCarpetBombing = true; },
    },
    // ── Column B: Active Abilities ────────────────────────────────────────────
    {
      id: 'warborn_b1', col: 1, tier: 1, prereq: null,
      name: 'Rallying Cry',
      shortName: 'Rally (1)',
      tooltip: 'OVERDRIVE [key 1]: 3× fire rate for 5 s, 60 s cooldown.\nPassive: each wave clear removes 1 s from all ability cooldowns.',
      cost: 500_000,
      apply(game) { game.warbornRallyCry = true; },
    },
    {
      id: 'warborn_b2', col: 1, tier: 2, prereq: 'warborn_b1',
      name: 'Fury',
      shortName: 'Fury (2)',
      tooltip: 'FURY [key 2]: all damage ×2 for 4 s, 60 s cooldown.\nPassive: each wave clear extends all currently-active ability durations by 0.5 s.',
      cost: 2_500_000,
      apply(game) { game.warbornFury = true; },
    },
    {
      id: 'warborn_b3', col: 1, tier: 3, prereq: 'warborn_b2',
      name: 'Avatar of War',
      shortName: 'Avatar (3)',
      tooltip: 'ANNIHILATION [key 3]: all enemies instantly lose 30% of their current HP, 60 s cooldown.\nPassive: each wave clear removes another 1 s from all ability cooldowns (total −2 s/wave with Rallying Cry).',
      cost: 12_500_000,
      apply(game) { game.warbornAvatarOfWar = true; },
    },
    // ── Column C: Rush Stacks ─────────────────────────────────────────────────
    {
      id: 'warborn_c1', col: 2, tier: 1, prereq: null,
      name: 'Blood Rush',
      shortName: 'Blood Rush',
      tooltip: 'Kills grant a Rush Stack. Each stack: +3% damage. Stacks decay after 3 s with no kill.\nCap: 1000 stacks (raised by Eternal Warrior).',
      cost: 500_000,
      apply(game) { game.warbornBloodRush = true; },
    },
    {
      id: 'warborn_c2', col: 2, tier: 2, prereq: 'warborn_c1',
      name: 'Rampage',
      shortName: 'Rampage',
      tooltip: '+1% fire rate bonus per 10 Rush Stacks (scales with stack cap).',
      cost: 2_500_000,
      apply(game) { game.warbornRampage = true; },
    },
    {
      id: 'warborn_c3', col: 2, tier: 3, prereq: 'warborn_c2',
      name: 'Unstoppable',
      shortName: 'Unstoppable',
      tooltip: 'Wave-start: decay is paused until the first kill, then resumes normally.\nMortar hits reset the decay timer. Mortar kills grant a Rush Stack. Overkill grants 2 stacks.',
      cost: 12_500_000,
      apply(game) { game.warbornUnstoppable = true; },
    },
  ],
  nexus: [
    {
      id: 'nexus_a1', col: 0, tier: 1, prereq: null,
      name: 'Lure Protocols',
      shortName: 'Lure',
      tooltip: 'One random enemy type per wave has 3× capture chance.\nThe favoured type is shown in the HUD.',
      cost: 500_000,
      apply(game) { game.lureProtocols = true; },
    },
    {
      id: 'nexus_a2', col: 0, tier: 2, prereq: 'nexus_a1',
      name: 'Optimal Roster',
      shortName: 'Optimal',
      tooltip: 'After every capture or merge, automatically slots the three highest-value traitors.\nAuto-merges inactive (unslotted) traitors when the merge threshold is met.\nProtection rule: a merge is skipped if it would remove a type+rarity needed by the optimal lineup.',
      cost: 2_500_000,
      apply(game) { game.optimalRoster = true; },
    },
    {
      id: 'nexus_a3', col: 0, tier: 3, prereq: 'nexus_a2',
      name: 'Stack Cascade',
      shortName: 'Cascade',
      tooltip: 'When a traitor merges, gain Neural Stacks equal to the resulting rarity\'s tier index.\nCommon=1  Uncommon=2  Rare=3  Epic=4  Legendary=5\nMythic=6  Divine=7  Celestial=8  Transcendent=9  Apex=10.',
      cost: 12_500_000,
      apply(game) { game.stackCascade = true; },
    },
    {
      id: 'nexus_b1', col: 1, tier: 1, prereq: null,
      name: 'Signal Harvest',
      shortName: 'Signal',
      tooltip: 'Traitor capture chance doubled globally.\nStacks multiplicatively with Lure Protocols.',
      cost: 500_000,
      apply(game) { game.signalHarvest = true; },
    },
    {
      id: 'nexus_b2', col: 1, tier: 2, prereq: 'nexus_b1',
      name: 'Resonance Field',
      shortName: 'Resonance',
      tooltip: 'Active traitor pets grant double their normal damage bonus.',
      cost: 2_500_000,
      apply(game) { game.resonanceField = true; },
    },
    {
      id: 'nexus_b3', col: 1, tier: 3, prereq: 'nexus_b2',
      name: 'Apex Protocol',
      shortName: 'Apex Proto',
      tooltip: 'Merge cost reduced from 5 to 4 pets per merge.',
      cost: 12_500_000,
      apply(game) { game.apexProtocol = true; if (game.traitorSystem) game.traitorSystem.mergeCount = 4; },
    },
    {
      id: 'nexus_c1', col: 2, tier: 1, prereq: null,
      name: 'Data Harvest',
      shortName: 'Data',
      tooltip: '+1 Neural Stack per wave cleared. Stacks persist the run.\nAmplified by Stack Amplifier and Recursive Growth.',
      cost: 500_000,
      apply(game) { game.dataHarvest = true; },
    },
    {
      id: 'nexus_c2', col: 2, tier: 2, prereq: 'nexus_c1',
      name: 'Stack Amplifier',
      shortName: 'Amplifier',
      tooltip: 'Each Neural Stack grants +0.8% multiplicative damage and +0.3% currency multiplier.',
      cost: 2_500_000,
      apply(game) { game.stackAmplifier = true; },
    },
    {
      id: 'nexus_c3', col: 2, tier: 3, prereq: 'nexus_c2',
      name: 'Recursive Growth',
      shortName: 'Recursive',
      tooltip: 'Requires Data Harvest (C1). Neural Stacks gained per wave are multiplied by the number of filled active traitor slots.\nWith 4 slots filled (Singularity rank 1): ×4 stacks per wave.',
      cost: 12_500_000,
      apply(game) { game.recursiveGrowth = true; },
    },
  ],
  vanguard: [
    // ── Column A: Wave Weaving ────────────────────────────────────────────────
    {
      id: 'vanguard_a1', col: 0, tier: 1, prereq: null,
      name: 'Advance Guard',
      shortName: 'Adv. Guard',
      tooltip: 'Enemies gain +2% movement speed per wave cleared (stacks within run, resets on ascension).\nWave 10: +20% speed. Wave 50: +100% speed.\nHigher enemy speed demands faster clearing — pairs well with Tide Surge.',
      cost: 500_000,
      apply(game) { game.vanguardAdvanceGuard = true; },
    },
    {
      id: 'vanguard_a2', col: 0, tier: 2, prereq: 'vanguard_a1',
      name: 'Tide Surge',
      shortName: 'Tide Surge',
      tooltip: 'Killing 50% of a wave immediately triggers the next wave, carrying survivors over.\nOn boss waves, the boss must be killed first.\nReplaces the Wave Rush prestige upgrade.',
      cost: 2_500_000,
      apply(game) { game.vanguardTideSurge = true; },
    },
    {
      id: 'vanguard_a3', col: 0, tier: 3, prereq: 'vanguard_a2',
      name: 'Spoils of War',
      shortName: 'Spoils',
      tooltip: 'On an early-switch (Tide Surge), each enemy alive at the switch grants\n+5% damage and +5% crit damage until the next early-switch.\nStacks additive. Resets at each switch.',
      cost: 12_500_000,
      apply(game) { game.vanguardSpoilsOfWar = true; },
    },
    // ── Column B: Shard Scaling ───────────────────────────────────────────────
    {
      id: 'vanguard_b1', col: 1, tier: 1, prereq: null,
      name: 'Eternal Tithe',
      shortName: 'Et. Tithe',
      tooltip: 'Each ascension grants bonus shards equal to the current ascension count.\nExample: 3rd ascension = +3 bonus shards on top of normal award.',
      cost: 500_000,
      apply(game) { game.vanguardEternalTithe = true; },
    },
    {
      id: 'vanguard_b2', col: 1, tier: 2, prereq: 'vanguard_b1',
      name: 'Shard Mastery',
      shortName: 'Shard Mast.',
      tooltip: 'Doubles the per-shard passive damage coefficient.\nWith Battle Hardened (C1) also active: ×3 total (0.10 × 1.5 × 2 = 0.30 per shard).',
      cost: 2_500_000,
      apply(game) { game.vanguardShardMastery = true; },
    },
    {
      id: 'vanguard_b3', col: 1, tier: 3, prereq: 'vanguard_b2',
      name: 'Iron Vault',
      shortName: 'Iron Vault',
      tooltip: 'On ascension, gain 1% of your current shards as bonus shards (rounded down, min 1).\nScale: 100 shards → +1, 1000 shards → +10, 10000 shards → +100.',
      cost: 12_500_000,
      apply(game) { game.vanguardIronVault = true; },
    },
    // ── Column C: Ascension Engine ────────────────────────────────────────────
    {
      id: 'vanguard_c1', col: 2, tier: 1, prereq: null,
      name: 'Battle Hardened',
      shortName: 'Batt. Hard.',
      tooltip: '×1.5 to the per-shard passive damage coefficient (0.10 → 0.15).\nStacks with Shard Mastery (B2): 0.10 × 1.5 × 2 = 0.30.',
      cost: 500_000,
      apply(game) { game.vanguardBattleHardened = true; },
    },
    {
      id: 'vanguard_c2', col: 2, tier: 2, prereq: 'vanguard_c1',
      name: 'Momentum',
      shortName: 'Momentum',
      tooltip: 'Shards awarded on ascension are multiplied by (1 + 0.1 × ascensionCount).\nExample: 10th ascension → ×2 shards.',
      cost: 2_500_000,
      apply(game) { game.vanguardMomentum = true; },
    },
    {
      id: 'vanguard_c3', col: 2, tier: 3, prereq: 'vanguard_c2',
      name: 'Tidal Convergence',
      shortName: 'Tidal Conv.',
      tooltip: 'Merges every 10-wave decade into one gigantic wave.\nWaves 1–10 become one wave; 11–20 become one; and so on.\nThe merged wave always includes a boss scaled to the boss-wave HP of that decade.\nClearing the merged wave advances the wave counter by 10.\nMakes VANGUARD the fastest faction for wave-per-second progression.',
      cost: 12_500_000,
      apply(game) { game.vanguardTidalConvergence = true; },
    },
  ],
};

// ── Capstone definitions ───────────────────────────────────────────────────

export const FACTION_CAPSTONES = {
  warborn: {
    id:       'warborn_cs',
    name:     'ETERNAL WARRIOR',
    tooltip:  'Rank 1: mortar hits remove 5% of current HP in blast radius.\nEach rank: +0.1% mortar current-HP removal (rank 10 = 6%, rank 20 = 7%).\nEach rank: regular projectiles remove (rank × 0.1)% current HP — active regardless of faction.\nEach rank: all ability cooldowns −0.1 s (cap −30 s).\nEach rank: Rush Stack cap +25 (base 1000).',
    baseCost: 1_000_000,
    costMult: 1.30,
  },
  nexus: {
    id:       'nexus_cs',
    name:     'SINGULARITY',
    tooltip:  'At ascension, (rank)% of Neural Stacks earned this run are permanently preserved\nand start active at the beginning of every future run.\nRank 1: permanently unlocks a 4th active traitor slot for all future runs.\nThe Nexus remembers.',
    baseCost: 1_000_000,
    costMult: 1.30,
  },
  vanguard: {
    id:       'vanguard_cs',
    name:     'ENDLESS WAR',
    tooltip:  'All factions: once 75% of a wave is killed, the next wave triggers (boss not required; VANGUARD keeps 50% + boss-dead).\nAll factions: auto-ascension dropdown on the ascension overlay — Off / On overkill end / On defeat.\nAll factions: faction choice overlay gains a 10-second countdown that re-selects the previous faction.\nEach rank: the obliterate overkill check treats your shot as ×(1 + rank × 0.25) stronger — does NOT change actual damage.',
    baseCost: 1_000_000,
    costMult: 1.30,
  },
};

// ── FactionSystem ──────────────────────────────────────────────────────────

export class FactionSystem {
  constructor() {
    // Per-run state
    this.activeFaction = null;   // 'nexus' | 'conclave' | 'warborn' | 'vanguard' | null

    // Permanent state — survives ascension, wiped only by hard reset
    // { nexus: { nodes: {id:true}, capstoneRank: N, permanentNeuralStacks: N } }
    this.permanent = {
      nexus:    { nodes: {}, capstoneRank: 0, permanentNeuralStacks: 0 },
      conclave: { nodes: {}, capstoneRank: 0 },
      warborn:  { nodes: {}, capstoneRank: 0 },
      vanguard: { nodes: {}, capstoneRank: 0 },
    };
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  isNodePurchased(nodeId) {
    for (const fid of Object.keys(this.permanent)) {
      if (this.permanent[fid].nodes?.[nodeId]) return true;
    }
    return false;
  }

  capstoneRank(factionId) {
    return this.permanent[factionId]?.capstoneRank ?? 0;
  }

  capstoneCost(factionId) {
    const cs = FACTION_CAPSTONES[factionId];
    if (!cs) return Infinity;
    const rank = this.capstoneRank(factionId);
    return Math.round(cs.baseCost * Math.pow(cs.costMult, rank));
  }

  // True when any full column (all 3 tiers) for this faction is purchased
  capstoneUnlocked(factionId) {
    const nodes = FACTION_NODES[factionId] ?? [];
    for (let col = 0; col < 3; col++) {
      const colNodes = nodes.filter(n => n.col === col);
      if (colNodes.length === 3 && colNodes.every(n => this.isNodePurchased(n.id))) {
        return true;
      }
    }
    return false;
  }

  canPurchaseNode(nodeId, game) {
    if (this.isNodePurchased(nodeId)) return false;
    const node = this._findNode(nodeId);
    if (!node) return false;
    if (this._factionForNode(nodeId) !== this.activeFaction) return false;
    if (node.prereq && !this.isNodePurchased(node.prereq)) return false;
    return game.currency >= node.cost;
  }

  // ── Purchases ────────────────────────────────────────────────────────────

  purchaseNode(nodeId, game) {
    if (!this.canPurchaseNode(nodeId, game)) return false;
    const node = this._findNode(nodeId);
    const fid  = this._factionForNode(nodeId);
    game.currency -= node.cost;
    this.permanent[fid].nodes[nodeId] = true;
    node.apply(game);
    return true;
  }

  purchaseCapstone(factionId, game) {
    if (factionId !== this.activeFaction) return false;
    if (!this.capstoneUnlocked(factionId)) return false;
    const cost = this.capstoneCost(factionId);
    if (game.currency < cost) return false;
    game.currency -= cost;
    this.permanent[factionId].capstoneRank += 1;

    // Rank 1 unlocks 4th traitor slot immediately
    if (factionId === 'nexus' && this.permanent.nexus.capstoneRank === 1) {
      if (game.traitorSystem) {
        game.traitorSystem.slotCount = 4;
        while (game.traitorSystem.slots.length < 4) game.traitorSystem.slots.push(null);
      }
    }

    // WARBORN: sync cross-faction capstone rank into game
    if (factionId === 'warborn') {
      game.warbornCapstoneRank = this.permanent.warborn.capstoneRank;
    }

    // VANGUARD: sync cross-faction capstone rank into game
    if (factionId === 'vanguard') {
      game.vanguardCapstoneRank = this.permanent.vanguard.capstoneRank;
    }

    return true;
  }

  // ── Join / reapply ────────────────────────────────────────────────────────

  join(factionId) {
    this.activeFaction = factionId;
  }

  // Re-apply all purchased nodes for the active faction.
  // Call after shop + prestige reapplyAll, so tower is fully rebuilt first.
  reapplyAll(game) {
    // Reset all faction flags
    game.lureProtocols   = false;
    game.optimalRoster   = false;
    game.stackCascade    = false;
    game.signalHarvest   = false;
    game.resonanceField  = false;
    game.apexProtocol    = false;
    game.dataHarvest     = false;
    game.stackAmplifier  = false;
    game.recursiveGrowth = false;
    // WARBORN flags
    game.warbornMortar        = false;
    game.warbornHeavyOrdnance = false;
    game.warbornCarpetBombing = false;
    game.warbornRallyCry      = false;
    game.warbornFury          = false;
    game.warbornAvatarOfWar   = false;
    game.warbornBloodRush     = false;
    game.warbornRampage       = false;
    game.warbornUnstoppable   = false;
    // VANGUARD flags
    game.vanguardAdvanceGuard   = false;
    game.vanguardTideSurge      = false;
    game.vanguardSpoilsOfWar    = false;
    game.vanguardEternalTithe   = false;
    game.vanguardShardMastery   = false;
    game.vanguardIronVault      = false;
    game.vanguardBattleHardened = false;
    game.vanguardMomentum       = false;
    game.vanguardIronWill          = false; // legacy — kept so old saves don't crash
    game.vanguardTidalConvergence  = false;

    // Restore permanent neural stacks
    game.permanentNeuralStacks = this.permanent.nexus?.permanentNeuralStacks ?? 0;
    if (this._runNeuralStacks != null) {
      game.neuralStacks    = this._runNeuralStacks;
      this._runNeuralStacks = null;
    } else {
      game.neuralStacks = game.permanentNeuralStacks;
    }

    if (!this.activeFaction) return;

    const nodes = FACTION_NODES[this.activeFaction] ?? [];
    for (const node of nodes) {
      if (this.isNodePurchased(node.id)) node.apply(game);
    }

    // Apply 4th slot if Singularity rank >= 1
    if (this.activeFaction === 'nexus' && this.capstoneRank('nexus') >= 1) {
      if (game.traitorSystem) {
        game.traitorSystem.slotCount = 4;
        while (game.traitorSystem.slots.length < 4) game.traitorSystem.slots.push(null);
      }
    }

    // Always sync WARBORN capstone rank (cross-faction benefit)
    game.warbornCapstoneRank = this.permanent.warborn?.capstoneRank ?? 0;

    // Always sync VANGUARD capstone rank (cross-faction benefit)
    game.vanguardCapstoneRank = this.permanent.vanguard?.capstoneRank ?? 0;

    // Apply merge count reduction from Apex Protocol
    if (game.traitorSystem) {
      game.traitorSystem.mergeCount = game.apexProtocol ? 4 : 5;
    }
  }

  // Called at ascension before run reset — preserve neural stacks via Singularity
  onAscend(game) {
    const rank = this.capstoneRank('nexus');
    if (rank > 0 && this.activeFaction === 'nexus') {
      const runStacks = Math.max(0, game.neuralStacks - game.permanentNeuralStacks);
      const preserved = Math.floor(runStacks * rank / 100);
      this.permanent.nexus.permanentNeuralStacks += preserved;
    }
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  serializeRun(neuralStacks = 0) {
    return { activeFaction: this.activeFaction, neuralStacks };
  }

  deserializeRun(data) {
    if (!data) return;
    this.activeFaction   = data.activeFaction ?? null;
    this._runNeuralStacks = (data.neuralStacks != null) ? data.neuralStacks : null;
  }

  serializeCapstones() {
    return { permanent: this.permanent };
  }

  deserializeCapstones(data) {
    if (!data) return;
    const p = data.permanent ?? {};
    for (const fid of Object.keys(this.permanent)) {
      if (!p[fid]) continue;
      this.permanent[fid].nodes        = p[fid].nodes        ?? {};
      this.permanent[fid].capstoneRank = p[fid].capstoneRank ?? 0;
      if (fid === 'nexus') {
        this.permanent.nexus.permanentNeuralStacks =
          p.nexus.permanentNeuralStacks ?? 0;
      }
    }
    // Legacy: if saved data has old keys not in this.permanent, ignore them
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _findNode(nodeId) {
    for (const nodes of Object.values(FACTION_NODES)) {
      const n = nodes.find(n => n.id === nodeId);
      if (n) return n;
    }
    return null;
  }

  _factionForNode(nodeId) {
    for (const [fid, nodes] of Object.entries(FACTION_NODES)) {
      if (nodes.find(n => n.id === nodeId)) return fid;
    }
    return null;
  }
}
