---
title: "APEX 1.0: a browser tower defense game"
description: "APEX is a zero-dependency, browser-based tower defense game. One tower, endless waves, thirteen upgrade categories, six fire modes, and procedural Web Audio sound — all in vanilla JS with no install required."
date: 2026-04-14
tags: ["APEX", "Release", "Game", "Vanilla JS", "Canvas"]
draft: false
---

Today I'm releasing [APEX](/apex) — a browser-based tower defense game I've been building over the past few weeks.

One tower. Endless waves. Countless upgrades.

## What it is

APEX is a zero-player-combat tower defense. You don't aim or shoot — the tower does that automatically. All interaction happens in the upgrade shop on the right: spend the currency you earn from kills on permanent stat boosts and fire mode unlocks, then watch the tower get progressively more absurd.

The loop is simple on purpose:

1. Enemies spawn off-screen and march straight toward the tower
2. The tower fires automatically at the nearest enemy in range
3. Kills earn currency; spend it on upgrades at any time
4. Survive the wave → the next one starts immediately
5. Tower HP hits zero → you restart from wave 1, **keeping all upgrades and currency**

That last point matters. Defeat is a setback, not a reset. The tower only ever grows stronger.

## Enemy types

Five enemy types, each introduced progressively as waves climb:

| Type | Shape | Behavior |
|---|---|---|
| Drone | Cyan circle | Baseline — fast and numerous |
| Swarm | Green dot | Spawns in clusters of 10–20 |
| Brute | Orange square | Slow, high HP, high reward |
| Elite | Magenta triangle | Fast and durable, appears from wave 5 |
| Boss | Red hexagon | Single unit every 10 waves, very high HP |

Enemy HP and speed scale exponentially with wave number. Bosses use a gentler curve so they stay killable deep into a run.

## Upgrade shop

Thirteen upgrade categories across two types:

**Stat upgrades** — permanent flat boosts, no tier cap on some:

- Damage, Fire Rate, Projectile Speed, Range
- Max HP, HP Regen (heals a percentage between waves)
- Bounty (kill reward multiplier)

**Fire mode unlocks** — each purchased at a base cost, then scaled through up to five tiers:

- **Spread Shot** — fans out a cone of pellets toward the nearest enemy; up to 8 pellets at max tier
- **Orbital Death Ring** — an energy arc orbits the tower, burning everything it sweeps through; up to two counter-rotating rings at max tier
- **Explosive Rounds** — projectiles detonate on impact, dealing splash damage in a radius
- **Chain Lightning** — on hit, arcs to nearby enemies, each jump dealing 60% of the previous damage; up to 5 jumps
- **Laser Burst** — a sweeping 360° beam fires periodically; damage, range, and uptime scale with tier
- **Multi-Shot** — the main gun targets multiple enemies simultaneously; up to 6 targets at max tier

All fire modes are cumulative — once unlocked they all fire at the same time.

## Sound

All audio is synthesized at runtime via the Web Audio API. No audio files, no extra downloads. Each weapon type has its own sound signature, enemies have size-differentiated death sounds, and the boss announces itself with a three-pulse sub throb. There's a volume slider in the shop footer and an AUTO quality mode that scales particle effects down if the frame rate drops.

## Tech

No framework, no bundler, no build step required. Vanilla JS ES modules served as static files.

- **Rendering:** Canvas 2D API
- **Audio:** Web Audio API (fully procedural)
- **Persistence:** `localStorage` — save survives browser close, restores exactly where you left off
- **Performance:** object pools for enemies, projectiles, and particles; a spatial grid for collision detection; batched canvas draw calls by entity shape and color

The full source is on [GitHub](https://github.com/cyferlawyn/APEX).

## Play it

[APEX is playable here](/apex). Click anywhere in the game to activate audio. Progress saves automatically — no account needed.
