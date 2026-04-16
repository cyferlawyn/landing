---
title: "APEX Update: Prestige, Traitors, and Five New Enemy Types"
description: "The first major content update to APEX adds an Ascension system, enemy pets (Traitors), five new enemy types, five new late-game upgrades, and a reworked boss encounter."
date: 2026-04-16
tags: ["apex", "gamedev", "update"]
draft: false
---

APEX has received its first major content update. Here is what changed.

## Ascension (Prestige)

Once you reach wave 50, boss kills award Shards. These accumulate as pending Shards until you Ascend — wiping your current run in exchange for banking them permanently.

Shards feed two separate systems:

- **Passive damage bonus**: `×(1 + totalShardsEarned × 0.10)`. This multiplier is based on *all shards ever earned*, including spent ones. It never goes down.
- **Prestige upgrade tree**: spendable Shard balance unlocks nine persistent upgrades that carry across every future run — War Chest (starting currency), Head Start (skip early waves), Bounty II (extra kill rewards), Critical Strike and Critical Power (crit system for the main gun), Execute (instant-kill below HP threshold), Laser Chill (laser slows enemies), Ring Stun (ring contact stuns enemies), and Shield (absorbs hits, grants invulnerability window).

The Ascension tab is hidden until you earn your first Shard or complete your first Ascension.

## Traitors (Pet System)

Every enemy kill now has a small chance to capture that enemy as a Traitor pet (0.01% at wave 1, scaling to 0.1% at wave 100+). Captured enemies receive a random rarity roll: Common, Uncommon, Rare, Epic, or Legendary.

- Assign up to 3 pets to active slots. Each active pet contributes an additive damage bonus calculated as `RARITY_BONUS × TYPE_BONUS_MULT`. Harder enemy types (Colossus, Boss) carry a higher type multiplier.
- The Traitor panel shows the total bonus and how many active slots are filled.
- Merge 5 pets of the same type and rarity to produce one of the next rarity tier (up to Legendary).
- When a new Traitor is captured, a toast notification appears mid-screen showing the rarity and bonus.
- Traitor state persists across runs and Ascensions. Only a Hard Reset clears it.

## Five New Enemy Types

| Type | Behaviour |
|------|-----------|
| **Dasher** | Alternates between 0.8 s dashes at 3× speed and 0.3–0.5 s pauses |
| **Bomber** | Explodes on contact with the tower or on death (80 px blast, damages nearby enemies) |
| **Spawner** | Slow, tanky square that emits a Drone or Swarm every second while alive |
| **Phantom** | Cycles 1 s intangible / 2 s solid — projectiles pass through during intangible phase |
| **Colossus** | Armored hexagon that absorbs the first hit from each weapon source (projectile, ring, laser) per wave; spawns 3 Drones on death |

New types start appearing from waves 4 (Dasher), 7 (Bomber), 14 (Phantom), 18 (Spawner), and 20 (Colossus).

Boss waves from wave 20 onwards include Colossus escorts (one more every 20 waves, up to 5). Boss waves from wave 50 add Brute crashers.

## Boss Rework

- Enrages at 40% HP: speed +60%.
- Rewards Shards on kill if wave ≥ 50.
- Kill rewards for all enemies now scale with wave: `base × (1 + 0.02 × wave)`.

## Five New Late-Game Upgrades

| Upgrade | Effect |
|---------|--------|
| **Overcharge** | Every Nth main-gun shot deals ×4 damage (tier 1: every 8th; tier 5: every 3rd) |
| **Volatile Rounds** | Increases Explosive Rounds splash fraction from 60% up to 110% at tier 5 |
| **Leech** | Restores 2–10 HP per kill |
| **Ring of Annihilation** | Multiplies Orbital Death Ring DPS up to ×5 at tier 5 |
| **Apocalypse Laser** | Multiplies Laser Burst DPS up to ×5 at tier 5 |

## Defeat Restart Change

On defeat you no longer restart at wave 1. Instead you restart at the last x1 wave before where you fell — e.g. die on wave 38 and you restart at wave 31. Your upgrades and currency are kept.

## UI Refactor

The side panel is now organised into collapsible tabs: **Upgrades**, **Ascension**, **Traitors**, and **Settings**. Currency is shown in the Upgrades tab header. The Ascension and Traitors tabs are hidden until relevant content is unlocked.

## Balance Changes

- All base enemy speeds increased ~50%.
- Non-boss spawner interval halved to 0.2 s (from 0.4 s), making waves noticeably denser.
- HP scaling exponents reduced across the board to keep late-game viable: Drone/Elite/Brute at `1.07^wave` (down from higher), Colossus at `1.06^wave`, Boss at `1.09^wave`.
- Bounty cost curve adjusted (from `1.65` to `1.638` costMult) to keep the multiplier accessible.
