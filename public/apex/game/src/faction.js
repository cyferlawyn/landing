// faction.js — Faction (Covenant) system
// Only NEXUS is implemented. THE CONCLAVE and THE WARBORN are stubs.

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
    description: 'Coming soon.',
    comingSoon:  true,
  },
};

// ── Node definitions ───────────────────────────────────────────────────────
// col: 0=A, 1=B, 2=C   tier: 1-3   prereq: nodeId or null

export const FACTION_NODES = {
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
      tooltip: 'When a traitor merges, gain Neural Stacks equal to the resulting rarity\'s tier index.\ncommon=1 … apex=10.',
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
      tooltip: 'Neural Stacks gained per wave are multiplied by the number of filled active traitor slots.',
      cost: 12_500_000,
      apply(game) { game.recursiveGrowth = true; },
    },
  ],
};

// ── Capstone definitions ───────────────────────────────────────────────────

export const FACTION_CAPSTONES = {
  nexus: {
    id:       'nexus_cs',
    name:     'SINGULARITY',
    tooltip:  'At ascension, (rank)% of Neural Stacks earned this run are permanently preserved\nand start active at the beginning of every future run.\nRank 1: permanently unlocks a 4th active traitor slot for all future runs.\nThe Nexus remembers.',
    baseCost: 1_000_000,
    costMult: 1.30,
  },
};

// ── FactionSystem ──────────────────────────────────────────────────────────

export class FactionSystem {
  constructor() {
    // Per-run state
    this.activeFaction = null;   // 'nexus' | 'conclave' | 'warborn' | null

    // Permanent state — survives ascension, wiped only by hard reset
    // { nexus: { nodes: {id:true}, capstoneRank: N, permanentNeuralStacks: N } }
    this.permanent = {
      nexus:    { nodes: {}, capstoneRank: 0, permanentNeuralStacks: 0 },
      conclave: { nodes: {}, capstoneRank: 0 },
      warborn:  { nodes: {}, capstoneRank: 0 },
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
