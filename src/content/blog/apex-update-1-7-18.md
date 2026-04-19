---
title: "APEX 1.7.18 — Factions, Obliterate, and Traitor Overhaul"
description: "1.7.18 adds the NEXUS faction covenant system, the Obliterate blastwave mechanic, major traitor system changes, and a stack of smaller improvements."
date: 2026-04-19
tags: ["apex", "devlog"]
draft: false
---

APEX 1.7.18 is live. Here is what changed since 1.3.0.

## Faction / Covenant system (NEXUS)

A new post-ascension layer called **Factions** unlocks after your first ascension. At each ascension you choose a faction — currently only NEXUS is available; Conclave and Warborn are coming soon.

NEXUS has a 3×3 talent tree (9 nodes across 3 columns, 3 tiers deep) purchased with regular currency during a run:

| Column | Node | Effect |
|--------|------|--------|
| A1 | Lure Protocols | 3× capture chance for the wave's lure enemy type |
| A2 | Optimal Roster | Auto-slots and auto-merges traitors to maximize active DPS |
| A3 | Stack Cascade | Gain neural stacks equal to the resulting rarity tier on every auto-merge |
| B1 | Signal Harvest | Double global traitor capture chance |
| B2 | Stack Amplifier | Neural stacks give a multiplicative damage and currency bonus |
| B3 | Apex Protocol | Merge threshold drops to 4 (from 5); unlocks the Apex rarity tier |
| C1–C3 | (support nodes) | Various synergy unlocks |

The **Singularity** capstone (purchasable once all 9 nodes are owned) ranks up with repeated purchases. Each rank preserves a percentage of your run's neural stacks into the next run as permanent stacks, compounding across ascensions.

Neural stack counts are saved per-run and persist across page refreshes via a new `apex_faction` save key.

## Obliterate

A new prestige upgrade. When a single shot deals at least 10× a drone's base HP in damage, it triggers an **Obliterate** event: an expanding blastwave that kills every enemy it contacts. Kill sites emit a fiery burst followed by long-lived afterglow embers. The wave fully expands and visual effects are preserved across wave transitions.

The normalized shot damage calculation (used by the obliterate threshold check) now factors in overcharge and execute multipliers in addition to the existing crit, shard, traitor, and faction multipliers.

## Traitor system changes

- **No roster cap.** The previous hard cap is gone. Reaching Apex rarity requires hundreds of merges, making any cap impractical.
- **Auto-merge before cap check.** Traitors are now auto-merged before the old cap would have triggered, so captures are never silently dropped.
- **Roster sorted by DPS contribution.** Groups are displayed in descending damage-percentage order within each rarity tier.
- **Resonance Field displayed correctly.** The ×2 bonus from the Resonance Field prestige upgrade is now reflected in the displayed percentages in the roster and toast notifications.
- **Singularity rank label.** Shows the projected number of stacks that will be preserved at the next ascension based on current run stacks and the Singularity rank percentage.
- **Apex Protocol fix.** Purchasing the Apex Protocol NEXUS node now immediately sets `mergeCount = 4` rather than waiting for the next game load.

## Damage upgrade

- Cap raised: the Damage upgrade is now capped at **50 tiers** (previously unlimited, which caused numerical instability at high wave counts).
- Multiplier raised from **×1.15** to **×1.25** per tier to compensate.

## Pool sizes

Projectile and particle pools increased from 2,048 to **8,192** slots, reducing visible pop-in during heavy wave Obliterate chains.

## Tab state persistence

Sidebar tab collapse/expand state is now saved to `apex_prefs` and restored on page load.

## Bug fixes

- Tab body `overflow` set to `visible` so tooltip boxes are no longer clipped by the scrollable panel.
- Faction node tooltips anchor to the cell element rather than the icon, with column-aware left/right positioning so they don't overflow the panel edge.
- Currency display colour in the Upgrades tab header now matches the label style.
