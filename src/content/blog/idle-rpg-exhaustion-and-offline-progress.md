---
title: "idle-rpg devlog: exhaustion pools and offline progress"
description: "The toon now gets tired. HP, fatigue, and concentration pools force it to rotate between combat, gathering, and crafting on their own — and progress now keeps ticking while your browser tab is closed."
date: 2026-08-29
tags: ["idle-rpg", "devlog", "game-dev"]
draft: false
---

Two more systems landed in [idle-rpg](https://github.com/cyferlawyn/idle-rpg), the near-zero-player browser RPG I'm building in the open: **exhaustion pools** and **offline fast-forward**. Together they're the difference between "a toon that mashes one button forever" and something that actually behaves like it's living its own life.

## What's new

**Exhaustion pools.** The toon no longer grinds a single activity indefinitely. Three pools now gate behavior:

- **HP** for combat — falls during a fight, and at 0 the fight ends and the toon is forcibly reassigned to a random non-combat activity while HP slowly recovers. This is distinct from the existing flee-at-25%-HP logic; fleeing and collapsing are separate outcomes that both had to keep working.
- **Fatigue** for all gathering skills — woodcutting, mining, fishing, and thieving share one pool. It empties, the activity stops, and the toon falls through to the ambient picker to choose something else.
- **Concentration** for all crafting skills — cooking, smithing, and alchemy share the other pool, with the same depletion behavior as fatigue.

This replaced an earlier, more generic 5-pool draft (`stamina/energy/focus/vitality/nerve`) that turned out to be more machinery than the design actually called for. The ruling: HP already existed on the toon and *is* the combat pool, so it made no sense to shadow it with a redundant generic one — three pools, not five.

The result is the loop the design doc was aiming for: a few minutes of gathering until fatigue bottoms out, a fight or few until HP drops and the toon gets reassigned, some crafting while HP and fatigue both recover in the background, then back to gathering — all without anyone touching the controls.

**Offline progress.** Close the tab and the toon doesn't stop existing. On reload, the game computes elapsed wall-clock time since the last save and fast-forwards the simulation — up to a 24-hour cap — using the same tick loop the live game runs, just batched with no rendering in between. A summary modal then reports what happened while you were away: gold and prayer gained, XP and levels per skill, kills per monster, and any quests completed.

The fast-forward deliberately doesn't try to shortcut this analytically. Combat and the ambient decision-maker are both randomized and branch on live state every tick, so a closed-form projection would only ever approximate the *expected* outcome — not the actual run a correctness test could replay and check against. Instead it just runs the real tick loop fast: 86,400 ticks (a full day at 1 tick/sec) complete in low milliseconds since there's no per-tick rendering or DOM work to slow it down.

Backing this is a new `localStorage` persistence layer — autosave on an interval and on page unload, with a version tag on the save envelope so a future state-shape change can reject old saves cleanly instead of feeding the sim a shape it doesn't understand.

## Improvements

- Movement now has a proper stat: an Agility skill drives real travel-speed formulas instead of a flat map-crossing time.
- The XP curve is unified to quadratic across all eight skills, fixing a mismatch where combat and gathering leveled at different felt paces.
- HUD overlays (combat/skills/stats) got a pass for narrow viewports — no more overlapping panels under 640px — and the fight screen is now a bounded bottom panel instead of covering the whole canvas.
- Test coverage grew alongside all of this: unit tests for fatigue and concentration depletion/regen, an end-to-end combat integration test, and a cross-category suite that exercises HP/fatigue/concentration together rather than in isolation.

## What's next

The three-pool exhaustion model and offline catch-up were the two biggest gaps between "toon that reacts" and "toon that lives its own life while you're not watching." With both in place, the next devlog will likely dig into deepening the ambient decision-maker itself — how the ambient picker weighs candidate activities — and expanding the quest and monster roster now that travel and exhaustion give the world more texture to react to.

Following along? The [repo](https://github.com/cyferlawyn/idle-rpg) is public, and `DESIGN.md` has the full core-loop writeup if you want the long version.
