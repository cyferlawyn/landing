---
title: "idle-rpg devlog: exhaustion pools and offline progress"
description: "The toon now gets tired. HP, fatigue, and concentration pools force it to rotate between combat, gathering, and crafting on their own — and progress now keeps ticking while your browser tab is closed."
date: 2026-08-29
tags: ["idle-rpg", "devlog", "game-dev"]
draft: false
---

I've started a new project: [idle-rpg](https://github.com/cyferlawyn/idle-rpg), a near-zero-player browser RPG. You don't control a character in the usual sense — you have a toon (a paladin spreading their faith through the world) that walks, fights, gathers, crafts, and completes quests entirely on its own. Load the page, and it's already living its life. Close the tab, and it keeps living it without you.

The pitch is somewhere between a Progress Quest clone and a tiny agent playing an RPG for you. Your job isn't to press the "attack" button — it's to be the toon's god: you nudge it toward a goal ("focus on quests," "grind woodcutting," "go pick a fight with that boss") and it figures out how to get there, folding your wish into everything else it's already juggling. The interesting design problem was never the RPG systems themselves — auto-battlers and skill grinds are well-trodden ground — it's that autonomy layer: how much of a brain does the toon get, and how does a player's "nudge" actually bias its decisions without turning into a chat window or a full manual control scheme dressed up as an idle game.

Mechanically, the core loop is a fixed-interval world tick. Each tick, the toon's decision layer looks at its current state — location, skill levels, active quests, whatever pools are full or empty — and picks an action: travel somewhere, swing at a monster, chop wood, turn in a quest, or just rest. Actions resolve over one or more ticks (a fight is several rounds, a trip across the map takes real travel time), loot and XP land as they're earned, and the log/stat panels update with no input required to keep any of it moving. Left alone, the toon should look like it's making its own reasonable calls that happen to line up with plausible RPG behavior, rather than mashing whatever action scored highest a tick ago and then continuing to mash it forever.

Where you come in: prayer. Quests (framed as converting or impressing townsfolk) generate prayer, which flows to you as the toon's god rather than staying with the toon — that's the in-fiction reason your influence grows over time. You spend prayer to issue directives that get pushed onto the toon's queue and worked through autonomously — pathing, fighting, retrying — until done, at which point it falls back to its own ambient judgment. It's meant to feel like being a quest-giver, not a puppeteer.

Since the first commit, the game has grown a real skill set — nine progression skills across combat, three gathering skills (woodcutting, mining, fishing, plus thieving), and three crafting skills (cooking, smithing, alchemy) — a six-zone overworld with a difficulty gradient the toon actually has to travel across, a monster/loot/quest system with kill-steps that route into real fights, and a rendered 2D map with a collapsible combat/skills/stats HUD instead of a flat text log. The two most recent systems are the ones this post is actually about.

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
- The XP curve is unified to quadratic across all nine skills, fixing a mismatch where combat and gathering leveled at different felt paces.
- HUD overlays (combat/skills/stats) got a pass for narrow viewports — no more overlapping panels under 640px — and the fight screen is now a bounded bottom panel instead of covering the whole canvas.
- Test coverage grew alongside all of this: unit tests for fatigue and concentration depletion/regen, an end-to-end combat integration test, and a cross-category suite that exercises HP/fatigue/concentration together rather than in isolation.

## What's next

The three-pool exhaustion model and offline catch-up were the two biggest gaps between "toon that reacts" and "toon that lives its own life while you're not watching." With both in place, the next devlog will likely dig into deepening the ambient decision-maker itself — how the ambient picker weighs candidate activities — and expanding the quest and monster roster now that travel and exhaustion give the world more texture to react to.

Following along? The [repo](https://github.com/cyferlawyn/idle-rpg) is public, and `DESIGN.md` has the full core-loop writeup if you want the long version.
