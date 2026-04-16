// traitor.js — Traitor (pet) system
// Defeated enemies have a small chance to desert and join the player.
// Active pets provide a stacking additive damage bonus multiplied into total DPS.

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_COLOR = {
  common:    '#9e9e9e',
  uncommon:  '#4caf50',
  rare:      '#2196f3',
  epic:      '#ab47bc',
  legendary: '#ff9800',
};

// Additive bonus to damage when this pet is in an active slot (base, before type multiplier)
export const RARITY_BONUS = {
  common:    0.05,
  uncommon:  0.12,
  rare:      0.25,
  epic:      0.50,
  legendary: 1.00,
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

// Weighted rarity roll — weights sum to 100 (index matches RARITIES order)
const RARITY_WEIGHTS = [60, 25, 10, 4, 1];

// Capture chance scales from 0.01% at wave 1 to 0.1% at wave 100+
const CHANCE_MIN  = 0.0001;
const CHANCE_MAX  = 0.001;
const MAX_ROSTER  = 100;
const SLOT_COUNT  = 3;
const MERGE_COUNT = 5;

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
    this.roster  = [];                      // [{ id, type, rarity }]
    this.slots   = [null, null, null];      // active slot pet ids (or null)
    this._nextId = 1;
  }

  // Called from every kill path. Returns the captured pet object or null.
  tryCapture(enemy, wave) {
    if (this.roster.length >= MAX_ROSTER) return null;
    const chance = CHANCE_MIN + (CHANCE_MAX - CHANCE_MIN) * Math.min(wave, 100) / 100;
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
    if (ridx < 0 || ridx >= RARITIES.length - 1) return false; // legendary can't merge up
    return (this.groupCounts()[`${type}|${rarity}`] ?? 0) >= MERGE_COUNT;
  }

  // Consume MERGE_COUNT pets of type+rarity, produce 1 of the next rarity.
  // Returns the new pet, or null if merge not possible.
  merge(type, rarity) {
    if (!this.canMerge(type, rarity)) return null;

    let consumed = 0;
    const keep = [];
    for (const p of this.roster) {
      if (p.type === type && p.rarity === rarity && consumed < MERGE_COUNT) {
        // Remove from any active slot
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
    if (slotIdx < 0 || slotIdx >= SLOT_COUNT) return false;
    if (!this.roster.find(p => p.id === petId)) return false;
    // Remove from any existing slot first
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
    if (slotIdx >= 0 && slotIdx < SLOT_COUNT) this.slots[slotIdx] = null;
  }

  // Returns the pet objects currently in active slots (excludes nulls).
  activePets() {
    return this.slots
      .map(id => (id != null ? this.roster.find(p => p.id === id) : null))
      .filter(Boolean);
  }

  // Sum of (RARITY_BONUS × TYPE_BONUS_MULT) for all active pets — additive between pets.
  damageBonus() {
    return this.activePets().reduce((sum, p) => {
      const base = RARITY_BONUS[p.rarity] ?? 0;
      const mult = TYPE_BONUS_MULT[p.type]  ?? 1.0;
      return sum + base * mult;
    }, 0);
  }

  serialize() {
    return { roster: this.roster, slots: this.slots, nextId: this._nextId };
  }

  deserialize(data) {
    if (!data) return;
    this.roster  = data.roster ?? [];
    this.slots   = (data.slots ?? [null, null, null]).slice(0, SLOT_COUNT);
    // Pad slots to SLOT_COUNT if saved with fewer
    while (this.slots.length < SLOT_COUNT) this.slots.push(null);
    this._nextId = data.nextId ?? 1;
    // Validate: drop slot references to pets no longer in roster
    const ids = new Set(this.roster.map(p => p.id));
    this.slots = this.slots.map(id => (id != null && ids.has(id)) ? id : null);
  }
}
