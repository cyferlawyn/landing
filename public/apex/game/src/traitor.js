// traitor.js — Traitor (pet) system
// Defeated enemies have a small chance to desert and join the player.
// Active pets provide a stacking additive damage bonus multiplied into total DPS.

// First 5 are obtainable by capture roll; last 5 are merge-only.
export const RARITIES = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
  'mythic', 'divine', 'celestial', 'transcendent', 'apex',
];

export const MERGE_ONLY_RARITIES = new Set(['mythic', 'divine', 'celestial', 'transcendent', 'apex']);

export const RARITY_COLOR = {
  common:       '#9e9e9e',
  uncommon:     '#4caf50',
  rare:         '#2196f3',
  epic:         '#ab47bc',
  legendary:    '#ff9800',
  mythic:       '#ff1744',   // merge-only
  divine:       '#00e5ff',   // merge-only
  celestial:    '#d4e157',   // merge-only
  transcendent: '#ea80fc',   // merge-only
  apex:         '#ffffff',   // merge-only — ultimate
};

// Additive bonus to damage when this pet is in an active slot (base, before type multiplier)
export const RARITY_BONUS = {
  common:       0.05,   //   5%
  uncommon:     0.12,   //  12%
  rare:         0.25,   //  25%
  epic:         0.50,   //  50%
  legendary:    1.00,   // 100%
  mythic:       2.00,   // 200% — merge-only
  divine:       4.50,   // 450% — merge-only
  celestial:   10.00,   // 1000% — merge-only
  transcendent: 22.00,  // 2200% — merge-only
  apex:         50.00,  // 5000% — merge-only
};

// Per-type multiplier applied on top of rarity bonus.
// Harder/rarer enemy types grant a higher bonus when captured.
export const TYPE_BONUS_MULT = {
  SWARM:    0.4,
  DRONE:    0.6,
  DASHER:   0.75,
  BOMBER:   0.9,
  ELITE:    1.0,
  BRUTE:    1.1,
  PHANTOM:  1.3,
  SPAWNER:  1.4,
  COLOSSUS: 1.8,
  BOSS:     2.5,
};

// Weighted rarity roll — weights sum to 100 (natural rarities only; merge-only tiers excluded)
const RARITY_WEIGHTS = [60, 25, 10, 4, 1];

// Capture chance scales from 0.01% at wave 1 to 0.1% at wave 100+
const CHANCE_MIN  = 0.0001;
const CHANCE_MAX  = 0.001;

function rollRarity() {
  let roll = Math.random() * 100;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    roll -= RARITY_WEIGHTS[i];
    if (roll <= 0) return RARITIES[i];
  }
  return RARITIES[0];
}

// Helper — actual bonus value for a given type+rarity combination.
export function petBonus(type, rarity) {
  return (RARITY_BONUS[rarity] ?? 0) * (TYPE_BONUS_MULT[type] ?? 1.0);
}

export class TraitorSystem {
  constructor() {
    this.roster     = [];               // [{ id, type, rarity }]
    this.slots      = [null, null, null]; // active slot pet ids (or null)
    this._nextId    = 1;
    this.slotCount  = 3;                // increased to 4 by Singularity rank 1
    this.mergeCount = 5;                // reduced to 4 by Apex Protocol (NEXUS B3)
  }

  // Called from every kill path. Returns the captured pet object or null.
  // game is optional; when provided, NEXUS bonuses (A1, B1) are applied.
  tryCapture(enemy, wave, game) {
    // No roster cap — merging to apex requires far more than any previous limit.
    let chance = CHANCE_MIN + (CHANCE_MAX - CHANCE_MIN) * Math.min(wave, 100) / 100;

    // NEXUS B1: Signal Harvest — double global capture chance
    if (game?.signalHarvest) chance *= 2;
    // NEXUS A1: Lure Protocols — 3× chance for the lure type this wave
    if (game?.lureProtocols && game.lureType && enemy.type === game.lureType) chance *= 3;

    if (Math.random() > chance) return null;
    const pet = { id: this._nextId++, type: enemy.type, rarity: rollRarity() };
    this.roster.push(pet);
    return pet;
  }

  // Returns { 'TYPE|rarity': count } for every group with ≥ 1 pet.
  groupCounts() {
    const counts = {};
    for (const p of this.roster) {
      const k = `${p.type}|${p.rarity}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }

  canMerge(type, rarity) {
    const ridx = RARITIES.indexOf(rarity);
    if (ridx < 0 || ridx >= RARITIES.length - 1) return false;
    return (this.groupCounts()[`${type}|${rarity}`] ?? 0) >= this.mergeCount;
  }

  // Consume mergeCount pets of type+rarity, produce 1 of the next rarity.
  // Returns the new pet, or null if merge not possible.
  merge(type, rarity) {
    if (!this.canMerge(type, rarity)) return null;

    let consumed = 0;
    const keep = [];
    for (const p of this.roster) {
      if (p.type === type && p.rarity === rarity && consumed < this.mergeCount) {
        for (let i = 0; i < this.slots.length; i++) {
          if (this.slots[i] === p.id) this.slots[i] = null;
        }
        consumed++;
      } else {
        keep.push(p);
      }
    }
    this.roster = keep;

    const nextRarity = RARITIES[RARITIES.indexOf(rarity) + 1];
    const pet = { id: this._nextId++, type, rarity: nextRarity };
    this.roster.push(pet);
    return pet;
  }

  // Assign a specific pet id to a slot index.
  assign(petId, slotIdx) {
    if (slotIdx < 0 || slotIdx >= this.slotCount) return false;
    if (!this.roster.find(p => p.id === petId)) return false;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] === petId) this.slots[i] = null;
    }
    this.slots[slotIdx] = petId;
    return true;
  }

  // Assign a pet to the first empty slot. Returns slot index or -1.
  assignToFirstEmpty(petId) {
    const idx = this.slots.indexOf(null);
    if (idx === -1) return -1;
    this.assign(petId, idx);
    return idx;
  }

  unassign(slotIdx) {
    if (slotIdx >= 0 && slotIdx < this.slotCount) this.slots[slotIdx] = null;
  }

  // Returns the pet objects currently in active slots (excludes nulls).
  activePets() {
    return this.slots
      .map(id => (id != null ? this.roster.find(p => p.id === id) : null))
      .filter(Boolean);
  }

  // Sum of (RARITY_BONUS × TYPE_BONUS_MULT) for all active pets — additive between pets.
  // Resonance Field doubling is applied in game.traitorDmgMult() rather than here.
  damageBonus() {
    return this.activePets().reduce((sum, p) => {
      const base = RARITY_BONUS[p.rarity] ?? 0;
      const mult = TYPE_BONUS_MULT[p.type]  ?? 1.0;
      return sum + base * mult;
    }, 0);
  }

  // ── NEXUS A2: Optimal Roster ────────────────────────────────────────────
  // Called after every capture or merge when optimalRoster is active.
  // 1. Re-slots the top slotCount pets by petBonus value.
  // 2. Auto-merges inactive-excess traitors respecting the protection rule.
  // game is passed to enable Stack Cascade (A3) on auto-merges.
  optimizeForNexus(game) {
    if (!game?.optimalRoster) return;

    // Step 1: determine top slotCount pets and assign them
    const sorted = [...this.roster].sort(
      (a, b) => petBonus(b.type, b.rarity) - petBonus(a.type, a.rarity)
    );
    const newSlots = Array(this.slotCount).fill(null);
    for (let i = 0; i < Math.min(this.slotCount, sorted.length); i++) {
      newSlots[i] = sorted[i].id;
    }
    this.slots = newSlots;

    // Step 2: auto-merge inactive-excess groups
    // How many of each type|rarity are needed by the optimal slot assignment?
    const slottedSet  = new Set(this.slots.filter(Boolean));
    const slottedNeed = {};
    for (const id of slottedSet) {
      const pet = this.roster.find(p => p.id === id);
      if (!pet) continue;
      const k = `${pet.type}|${pet.rarity}`;
      slottedNeed[k] = (slottedNeed[k] ?? 0) + 1;
    }

    const counts = this.groupCounts();
    let anyMerge = false;
    for (const [key, total] of Object.entries(counts)) {
      const needed    = slottedNeed[key] ?? 0;
      const available = total - needed;
      if (available < this.mergeCount) continue;

      const [type, rarity] = key.split('|');
      const ridx = RARITIES.indexOf(rarity);
      if (ridx < 0 || ridx >= RARITIES.length - 1) continue; // apex or unknown

      // Merge using only non-slotted pets
      const newPet = this._mergeExcess(type, rarity, slottedSet);
      if (newPet) {
        anyMerge = true;
        // NEXUS A3: Stack Cascade — gain stacks equal to resulting rarity tier (1-indexed)
        if (game.stackCascade) {
          game.neuralStacks += RARITIES.indexOf(newPet.rarity) + 1;
        }
      }
    }

    // If any merge happened, recurse once to re-slot with the new pets
    if (anyMerge) this.optimizeForNexus(game);
  }

  // Merge mergeCount non-slotted pets of type+rarity. Returns new pet or null.
  _mergeExcess(type, rarity, slottedSet) {
    const ridx = RARITIES.indexOf(rarity);
    if (ridx < 0 || ridx >= RARITIES.length - 1) return null;

    // Find non-slotted pets of this group
    const available = this.roster.filter(
      p => p.type === type && p.rarity === rarity && !slottedSet.has(p.id)
    );
    if (available.length < this.mergeCount) return null;

    // Consume mergeCount of them
    const toRemove = new Set(available.slice(0, this.mergeCount).map(p => p.id));
    this.roster = this.roster.filter(p => !toRemove.has(p.id));

    const nextRarity = RARITIES[ridx + 1];
    const pet        = { id: this._nextId++, type, rarity: nextRarity };
    this.roster.push(pet);
    return pet;
  }

  serialize() {
    return { roster: this.roster, slots: this.slots, nextId: this._nextId,
             slotCount: this.slotCount, mergeCount: this.mergeCount };
  }

  deserialize(data) {
    if (!data) return;
    this.roster     = data.roster  ?? [];
    this.slotCount  = data.slotCount  ?? 3;
    this.mergeCount = data.mergeCount ?? 5;
    this.slots      = (data.slots ?? []).slice(0, this.slotCount);
    while (this.slots.length < this.slotCount) this.slots.push(null);
    this._nextId = data.nextId ?? 1;
    // Validate: drop slot references to pets no longer in roster
    const ids = new Set(this.roster.map(p => p.id));
    this.slots = this.slots.map(id => (id != null && ids.has(id)) ? id : null);
  }
}
