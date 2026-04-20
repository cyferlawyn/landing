---
title: "APEX 1.11.6 — WARBORN, VANGUARD, and Prestige Overhaul"
description: "1.11.6 completes the three-faction covenant system, adds a large batch of new prestige upgrades, and rebalances existing shard costs and tiers."
date: 2026-04-20
tags: ["apex", "devlog"]
draft: false
---

APEX 1.11.6 is live. Here is what changed since 1.7.18.

## Two new factions: WARBORN and VANGUARD

Both factions are now fully playable. Like NEXUS, all faction nodes and capstone ranks are **permanent** — they survive ascension and hard reset. The faction choice overlay appears at every ascension.

### THE WARBORN

An ability-driven faction built around burst damage and kill momentum.

**Column A — Mortar artillery:**

- **Field Artillery (A1):** A crosshair tracks your cursor, locks, then fires a mortar (~1 shot/s) dealing 100% normalized shot damage in a 50 px radius. Click to freeze/unfreeze the crosshair.
- **Heavy Ordnance (A2):** Mortar radius expands to 150 px, damage triples to 300%, hits stun for 0.5 s.
- **Carpet Bombing (A3):** Each mortar strike fires 4 additional blasts 100 px N/S/E/W from the primary impact.

**Column B — Active abilities (keyboard):**

- **Rallying Cry (B1):** Key `1` — Overdrive: ×3 fire rate for 5 s, 60 s cooldown. Each wave clear shaves 1 s off all cooldowns.
- **Fury (B2):** Key `2` — all damage ×2 for 4 s, 60 s cooldown. Each wave clear extends active ability durations by 0.5 s.
- **Avatar of War (B3):** Key `3` — Annihilation: strips 30% current HP from every enemy, 60 s cooldown. Each wave clear removes another 1 s from all cooldowns (−2 s/wave total with B1).

**Column C — Rush Stacks:**

- **Blood Rush (C1):** Kills grant Rush Stacks (+3% damage each, cap 1000). Stacks decay 3 s after the last kill.
- **Rampage (C2):** +1% fire rate per 10 Rush Stacks.
- **Unstoppable (C3):** Decay is paused at wave start until the first kill. Mortar hits reset the decay timer; mortar kills grant stacks; overkills grant 2.

**Capstone — ETERNAL WARRIOR:** Each rank raises the Rush Stack cap, reduces all ability cooldowns, and causes projectiles to deal bonus current-HP% damage to enemies.

---

### THE VANGUARD

A long-game faction centered on wave farming and shard compounding.

**Column A — Wave weaving:**

- **Advance Guard (A1):** Enemies gain +2% movement speed per wave cleared within the run. Wave 10: +20%. Wave 50: +100%. Demands faster clears — pairs naturally with Tide Surge.
- **Tide Surge (A2):** Killing 50% of a wave (boss must die first on boss waves) immediately advances to the next, carrying survivors over. This replaces the old Wave Rush prestige upgrade.
- **Spoils of War (A3):** On an early switch (Tide Surge trigger), each surviving enemy grants +5% damage and +5% crit damage until the next switch.

**Column B — Shard scaling:**

- **Eternal Tithe (B1):** Each ascension grants bonus shards equal to the ascension count (3rd ascension = +3 extra shards).
- **Shard Mastery (B2):** Doubles the per-shard passive damage coefficient. Stacks with Battle Hardened: 0.10 × 1.5 × 2 = 0.30 per shard.
- **Iron Vault (B3):** On ascension, gain 1% of current shards as bonus shards.

**Column C — Ascension engine:**

- **Battle Hardened (C1):** ×1.5 to the per-shard coefficient (0.10 → 0.15).
- **Momentum (C2):** Shards awarded on ascension multiplied by (1 + 0.1 × ascension count).
- **Tidal Convergence (C3):** Every wave advance via Tide Surge skips 10 waves simultaneously.

**Capstone — ENDLESS WAR:** Each rank raises the Tide Surge threshold across all factions to 75% and multiplies the obliterate check power.

---

## New prestige upgrades

Several high-end shard upgrades have been added:

| Upgrade | Effect |
|---|---|
| **Void Surge** | ×1.20 global DPS multiplier per tier — all weapons (5 tiers) |
| **Echo Shot** | Chance to fire a free extra volley after a multi-shot salvo — up to 75% at tier 5 (5 tiers) |
| **Forge Eternal** | +50 flat base damage per tier, applied before all multipliers (5 tiers) |
| **Shard Covenant** | Wave-start damage bonus proportional to total shards (3 tiers) |
| **Eternal Arsenal** | +5% fire rate and +1 simultaneous target per tier, beyond the shop caps (4 tiers) |
| **Apex Predator** | Execute threshold applies to Bosses; +50% fire rate burst for 3 s on any execute kill (3 tiers) |
| **Overcharge Amplifier** | Extends the overcharge shot multiplier from ×4 up to ×6.5 (5 tiers) |
| **Detonation Field** | +15% explosion radius per tier plus a 1 s slow on blast (4 tiers) |
| **Arc Mastery** | +1–3 extra chain lightning jumps with ×1.20 escalating damage per jump (3 tiers) |

## Wave Rush removed

The Wave Rush prestige upgrade is gone. Any previously purchased tiers are refunded in shards on load. Its function is replaced by **VANGUARD A2 (Tide Surge)**, which works identically but integrates with the rest of the VANGUARD tree.

## Prestige upgrade rebalancing

All existing prestige upgrades had their base costs and cost multipliers adjusted to fit the expanded shop. Notable changes:

- **Auto-Buyer:** baseCost 1 → 2, costMult 3.0 → 2.5
- **War Chest:** extended to 10 tiers (up to 1M starting currency), costs scaled accordingly
- **Critical Strike:** extended to 10 tiers (100% crit chance at max), baseCost raised
- **Bounty II:** baseCost raised, costMult 1.8 → 2.0

## NEXUS node updates

- **A2 (formerly "Optimal Roster"):** Now grants +1% damage per filled pet slot rather than auto-managing slot assignments. The description and tooltip have been updated.
- **A3 (Stack Cascade):** Tooltip now lists all 10 rarity tiers by name for clarity.
- **C3 (Recursive Growth):** Tooltip now shows the concrete example with 4 slots filled.

## Chain lightning

The chain lightning damage model changed: each jump now deals **60% of the previous jump's damage** rather than full damage. This reduces the runaway scaling that made chain lightning dominant in long runs.

## Pool size tuning

Pool sizes were reduced to better fit the actual gameplay budget: enemy pool 512 → 2048 (corrected), projectile pool 8192 → 1024, particle pool 8192 → 1024. The previous values were over-allocated relative to typical wave sizes.

## Auto-ascension mode

A new `autoAscensionMode` preference is saved to `apex_prefs`. When active, the game ascends automatically as soon as `pendingShards > 0`. State is restored on page load alongside quality and volume preferences.

## Save key additions

- `apex_faction_capstones` — new key storing permanent capstone ranks for all three factions (SINGULARITY, ETERNAL WARRIOR, ENDLESS WAR). Capstone ranks now survive hard reset.
- `apex_save` — now also persists VANGUARD per-run state: `vanguardSpeedBonus` and `vanguardSpoilsStacks`.
