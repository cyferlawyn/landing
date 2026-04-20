import { Game, State }    from './game.js';
import { Tower }           from './tower.js';
import { EnemyType, EnemyPool } from './enemy.js';
import { ProjectilePool, killEnemy, obliterateWave, checkObliterateAtWaveStart } from './projectile.js';
import { normalizedShotDamage } from './tower.js';
import { WaveSpawner }     from './wave.js';
import { Renderer }        from './renderer.js';
import { Shop }            from './shop.js';
import { PrestigeShop }    from './prestige.js';
import { TraitorSystem }   from './traitor.js';
import { FactionSystem }   from './faction.js';
import { ParticleSystem }  from './particles.js';
import { audio }           from './audio.js';
import { save, load, clear, hasSave, savePrefs, loadPrefs,
         savePrestige, loadPrestige, clearPrestige,
         saveTraitors, loadTraitors, clearTraitors,
         saveFaction, loadFaction, clearFaction,
         saveFactionCapstones, loadFactionCapstones, clearFactionCapstones } from './storage.js';

const canvas        = document.getElementById('gameCanvas');
const game          = new Game();
const renderer      = new Renderer(canvas, game);
const shop          = new Shop(game);
const prestigeShop  = new PrestigeShop(game);

// --- bootstrap ---
function bootstrap() {
  const saved   = load();
  const prefs   = loadPrefs();
  const prestige = loadPrestige();

  game.tower          = new Tower();
  game.enemyPool      = new EnemyPool(2048);
  game.projectilePool = new ProjectilePool(1024);
  game.waveSpawner    = new WaveSpawner(game);
  game.particles      = new ParticleSystem(1024);
  game.traitorSystem  = new TraitorSystem();
  game.factionSystem  = new FactionSystem();

  // Restore preferences (quality, volume) — independent of save data
  if (prefs) {
    if (prefs.quality)             game.quality          = prefs.quality;
    if (prefs.autoQuality != null) game.autoQuality      = prefs.autoQuality;
    if (prefs.volume != null)      audio.setVolume(prefs.volume);
    if (prefs.autoAscensionMode)   game.autoAscensionMode = prefs.autoAscensionMode;
    // Tab collapse state is applied in ui.js load handler (after DOM is ready)
  }

  // Restore prestige state — persists across runs and New Game
  if (prestige) {
    game.shards             = prestige.shards            ?? 0;
    game.pendingShards      = prestige.pendingShards     ?? 0;
    game.totalShardsEarned  = prestige.totalShardsEarned ?? prestige.shards ?? 0;
    game.prestigeUpgrades   = prestige.prestigeUpgrades  ?? {};
    game.ascensionCount     = prestige.ascensionCount    ?? 0;
  }

  // Restore traitor system — persists across runs and ascensions, wiped only on hard reset
  game.traitorSystem.deserialize(loadTraitors());

  // Restore faction capstones (permanent) then run state
  game.factionSystem.deserializeCapstones(loadFactionCapstones());
  game.factionSystem.deserializeRun(loadFaction());
  // Sync cross-faction capstone ranks into game state
  game.warbornCapstoneRank  = game.factionSystem.permanent.warborn?.capstoneRank  ?? 0;
  game.vanguardCapstoneRank = game.factionSystem.permanent.vanguard?.capstoneRank ?? 0;

  // Apply prestige upgrades on top of fresh tower (before run save overwrites tiers)
  prestigeShop.reapplyAll(game.prestigeUpgrades);

  if (saved) {
    game.wave               = saved.wave               ?? 1;
    game.currency           = saved.currency           ?? 0;
    game.upgrades           = saved.upgrades           ?? {};
    game.bestWave           = saved.bestWave           ?? 1;
    game.currencyMultiplier = saved.currencyMultiplier ?? 1.0;
    // VANGUARD per-run state
    game.vanguardSpeedBonus   = saved.vanguardSpeedBonus   ?? 0;
    game.vanguardSpoilsStacks = saved.vanguardSpoilsStacks ?? 0;
    shop.reapplyAll(game.upgrades);
    // Re-apply prestige after run upgrades (prestige is additive on top)
    prestigeShop.reapplyAll(game.prestigeUpgrades);
    // Apply faction nodes on top (resets flags then re-applies active faction nodes)
    game.factionSystem.reapplyAll(game);
    // Restore tower HP after reapplyAll rebuilt the tower
    game.tower.hp = Math.min(saved.towerHP ?? game.tower.maxHp, game.tower.maxHp);
  } else {
    // No run save — still apply faction nodes (permanent stacks, 4th slot, etc.)
    game.factionSystem.reapplyAll(game);
  }

  beginWave();
}

function beginWave(keepEnemies = false) {
  if (!keepEnemies) game.enemyPool.reset();
  game.projectilePool.reset();
  // Do NOT clear particle/FX arrays — let active animations finish naturally.
  // Mark any in-flight blastwaves as kill-done so they don't kill new-wave enemies.
  for (const w of game.blastwaves) w.killDone = true;
  game.obliterateTimer    = -1;
  game.obliterateInFlight = false;
  game.obliterateOverkill = 0;
  game.elapsed        = 0;  // reset per-wave timestamp used by slow/stun
  // Apply regen between waves; full heal only on wave 1 (fresh start)
  if (game.wave === 1) {
    game.tower.hp = game.tower.maxHp;
  } else {
    game.tower.hp = Math.min(
      game.tower.hp + Math.floor(game.tower.maxHp * game.tower.regenFraction),
      game.tower.maxHp
    );
  }
  game.tower.invulnTimer = 0;
  game.tower.overchargeCounter = 0;
  // Shard Covenant: sample current shard count at wave start to compute bonus multiplier
  if (game.shardCovenantMult > 0) {
    game.tower.shardCovenantBonus = 1 + game.shards * game.shardCovenantMult;
  } else {
    game.tower.shardCovenantBonus = 1.0;
  }
  game.waveSpawner.begin(game.wave);

  // Check obliterate overkill threshold at wave start.
  // If the tower is strong enough, fire the countdown immediately.
  // If not and auto-ascension is set to 'overkill', this is the signal to ascend.
  if (game.tower.obliterateDelay > 0) {
    const fires = checkObliterateAtWaveStart(game);
    if (!fires && game.autoAscensionMode === 'overkill' && game.pendingShards > 0) {
      setTimeout(() => beginAscend(), 400);
    }
  }
  game.waveEarned = 0;
  game.waveKills  = 0;
  // NEXUS A1: pick a random lure type for this wave
  if (game.lureProtocols) {
    const types = Object.values(EnemyType);
    game.lureType = types[Math.floor(Math.random() * types.length)];
  } else {
    game.lureType = null;
  }
  // VANGUARD: reset boss-killed flag at wave start
  game.vanguardBossKilledThisWave = false;
  game.transition(State.COMBAT);
}

// --- main loop ---
let lastTime = 0;

// FPS tracking — ring buffer of last 120 frame durations
const FPS_BUF_SIZE = 120;
const _fpsBuf      = new Float32Array(FPS_BUF_SIZE);
let   _fpsCursor   = 0;
let   _fpsSum      = 0;

// AUTO quality state
let _autoLowTimer  = 0;   // seconds of sustained sub-55 fps
let _autoCooldown  = 0;   // seconds until next AUTO step-down is allowed

const AUTO_THRESHOLD = 55;   // fps below this triggers the timer
const AUTO_SUSTAIN   = 3.0;  // seconds below threshold before stepping down
const AUTO_COOLDOWN  = 10.0; // seconds locked out after a step-down

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  // Rolling FPS average
  _fpsSum -= _fpsBuf[_fpsCursor];
  _fpsBuf[_fpsCursor] = dt;
  _fpsSum += dt;
  _fpsCursor = (_fpsCursor + 1) % FPS_BUF_SIZE;
  const avgDt = _fpsSum / FPS_BUF_SIZE;
  game.fps = Math.round(1 / avgDt);

  // AUTO quality step-down
  if (game.autoQuality && game.quality !== 'low') {
    if (_autoCooldown > 0) {
      _autoCooldown -= dt;
    } else if (game.fps < AUTO_THRESHOLD) {
      _autoLowTimer += dt;
      if (_autoLowTimer >= AUTO_SUSTAIN) {
        _autoLowTimer = 0;
        _autoCooldown = AUTO_COOLDOWN;
        const next = game.quality === 'high' ? 'medium' : 'low';
        game.quality = next;
        savePrefs({ quality: next, volume: audio.volume, autoQuality: true });
        // Sync quality UI (defined in ui.js, exposed on window)
        window.__syncQualityUI?.();
      }
    } else {
      _autoLowTimer = 0; // reset timer whenever FPS recovers
    }
  }

  update(dt);
  renderer.render();

  requestAnimationFrame(loop);
}

function tickAutoBuy(dt) {
  const interval = game.autoBuyInterval ?? 0;
  if (interval === 0 && (game.prestigeUpgrades?.autoBuy ?? 0) === 0) return;

  if (interval > 0) {
    game.autoBuyTimer = (game.autoBuyTimer ?? 0) + dt;
    if (game.autoBuyTimer < interval) return;
    // Do NOT reset the timer yet — only reset on a successful purchase so that
    // if nothing is affordable we keep retrying each frame until currency allows it.
  }

  // Find cheapest non-maxed shop upgrade
  let bestId   = null;
  let bestCost = Infinity;
  for (const entry of shop.catalogue) {
    if (shop.isMaxed(entry.id)) continue;
    const c = shop.cost(entry.id);
    if (c < bestCost) { bestCost = c; bestId = entry.id; }
  }
  if (bestId !== null && shop.canAfford(bestId)) {
    shop.purchase(bestId);
    game.autoBuyTimer = 0;  // restart interval only after a successful purchase
  }
}

function update(dt) {
  // Pause everything while the faction choice overlay is open
  if (game.pendingFactionChoice) return;

  switch (game.state) {
    case State.COMBAT:
      game.elapsed = (game.elapsed ?? 0) + dt;
      game.enemyPool.update(dt, game);
      game.projectilePool.update(dt, game);
      game.tower.update(dt, game);
      if (game.particles) game.particles.update(dt);
      if (game.resultsTimer > 0) game.resultsTimer -= dt;
      game.tickEarnLog(dt);
      tickAutoBuy(dt);
      tickWarborn(dt);

      // Obliterate countdown
      if (game.obliterateTimer > 0) {
        game.obliterateTimer -= dt;
        if (game.obliterateTimer <= 0) {
          game.obliterateTimer = -1;
          const tx = game.tower.x, ty = game.tower.y;
          const margin = 300;
          const maxR = Math.sqrt(
            Math.max(tx, canvas.width  - tx + margin) ** 2 +
            Math.max(ty, canvas.height - ty + margin) ** 2
          );
          const speed = maxR / 0.35; // full visual sweep in 0.35 s
          game.blastwaves.push({ x: tx, y: ty, r: game.tower.radius + 4,
            maxR, speed, t: 0.8, life: 0.8, killDone: false });
          game.obliterateInFlight = true;
          setTimeout(() => {
            obliterateWave(game);
            setTimeout(() => {
              obliterateWave(game);
              game.obliterateInFlight = false;
              // Let the game loop's activeCount() === 0 check fire onWaveComplete
              // naturally on the next tick — do NOT call it here to avoid double-advance.
            }, 50);
          }, 300);
        }
      }

      // Blastwave visual expansion only — kill logic handled by the setTimeout above.
      for (const w of game.blastwaves) {
        if (w.r < w.maxR) w.r += w.speed * dt;
        if (!w.killDone && w.r >= w.maxR) w.killDone = true;
      }

      if (game.tower.hp <= 0) {
        onDefeated();
      } else if (!game.obliterateInFlight && game.enemyPool.activeCount() === 0 && game.waveSpawner.totalSpawned > 0) {
        onWaveComplete();
      } else {
        // ── Wave skip checks (suppressed while obliterate kill is in flight) ──
        const total = game.waveSpawner.totalSpawned;
        if (!game.obliterateInFlight && total > 0) {
          const killPct = game.waveKills / total;

          // VANGUARD A2: Tide Surge — 50% of wave killed triggers next wave.
          // On boss waves (or Tidal Convergence merged waves) the boss must die first.
          if (game.vanguardTideSurge && killPct >= 0.50) {
            const hasBoss = game.wave % 10 === 0 || game.vanguardTidalConvergence;
            if (!hasBoss || game.vanguardBossKilledThisWave) {
              onWaveComplete(true);
            }
          }
          // ENDLESS WAR capstone: all factions get 75% threshold (non-boss, non-merged waves)
          else if (game.vanguardCapstoneRank > 0 && game.wave % 10 !== 0 && !game.vanguardTidalConvergence) {
            if (killPct >= 0.75) {
              onWaveComplete(true);
            }
          }
          // Prestige Wave Rush (now removed but waveSkipThreshold may still be set
          // by an old save — keep for safety, non-boss waves only)
          else if (game.tower.waveSkipThreshold > 0 && game.wave % 10 !== 0) {
            if (killPct >= game.tower.waveSkipThreshold) {
              onWaveComplete(true);
            }
          }
        }
      }
      break;

    case State.DEFEATED:
      if (game.tickOverlay(dt)) {
        resetToWaveOne();
      }
      break;
  }
}

function tickWarborn(dt) {
  if (!game.warbornMortar && !game.warbornRallyCry && !game.warbornBloodRush) return;

  // ── Overdrive (B1) ──────────────────────────────────────────────────────
  if (game.warbornRallyCry) {
    if (game.overdriveCooldown > 0) game.overdriveCooldown -= dt;
    if (game.overdriveActive) {
      game.overdriveTimer -= dt;
      if (game.overdriveTimer <= 0) {
        game.overdriveActive = false;
        game.overdriveTimer  = 0;
      }
    }
  }

  // ── Fury (B2) ──────────────────────────────────────────────────────────
  if (game.warbornFury) {
    if (game.furyCooldown > 0) game.furyCooldown -= dt;
    if (game.furyActive) {
      game.furyTimer -= dt;
      if (game.furyTimer <= 0) {
        game.furyActive = false;
        game.furyTimer  = 0;
      }
    }
  }

  // ── Annihilation (B3) ──────────────────────────────────────────────────
  if (game.warbornAvatarOfWar) {
    if (game.annihilationCooldown > 0) game.annihilationCooldown -= dt;
  }

  // ── Rush Stack decay (C1) ──────────────────────────────────────────────
  if (game.warbornBloodRush && game.rushStacks > 0) {
    game.rushKillTimer += dt;
    if (!game.rushDecayProtected) {
      game.rushDecayTimer -= dt;
      if (game.rushDecayTimer <= 0) {
        game.rushStacks    = 0;
        game.rushDecayTimer = 0;
      }
    }
  }

  // ── Mortar loop (A1) ──────────────────────────────────────────────────
  if (!game.warbornMortar) return;

  if (!game.mortarInFlight && !game.mortarLocked) {
    // Tracking phase: shrinking crosshair for 0.75s
    game.mortarTrackTimer += dt;
    if (game.mortarTrackTimer >= 0.75) {
      // Lock on cursor position
      game.mortarTrackTimer  = 0;
      game.mortarLocked      = true;
      game.mortarLockedX     = game.mortarCursorX;
      game.mortarLockedY     = game.mortarCursorY;
    }
  } else if (game.mortarLocked && !game.mortarInFlight) {
    // Brief pause before launch (0.05s)
    game.mortarFlightTimer += dt;
    if (game.mortarFlightTimer >= 0.05) {
      game.mortarFlightTimer = 0.25; // flight duration countdown
      game.mortarInFlight    = true;
      game.mortarLocked      = false;
    }
  } else if (game.mortarInFlight) {
    game.mortarFlightTimer -= dt;
    if (game.mortarFlightTimer <= 0) {
      // Impact!
      _mortarImpact(game.mortarLockedX, game.mortarLockedY);
      game.mortarInFlight    = false;
      game.mortarFlightTimer = 0;
      game.mortarTrackTimer  = 0; // restart loop
    }
  }
}

function _mortarImpact(ix, iy) {
  const baseDmg  = normalizedShotDamage(game.tower, game);
  const dmgMult  = game.warbornHeavyOrdnance ? 3.0 : 1.0;
  // Rush stack bonus already factored into factionDmgMult via game.rushDmgMult()? No — we fold it in here
  const rushMult = game.rushDmgMult?.() ?? 1.0;
  const furyMult = game.furyDmgMult?.() ?? 1.0;
  const dmg      = baseDmg * dmgMult * rushMult * furyMult;
  const blastR   = game.warbornHeavyOrdnance ? 150 : 50;
  const stunDur  = game.warbornHeavyOrdnance ? 0.5 : 0;

  _mortarBlast(ix, iy, dmg, blastR, stunDur, true);

  // Carpet Bombing (A3): 4 extra blasts N/S/E/W
  if (game.warbornCarpetBombing) {
    const offsets = [[0, -100], [0, 100], [-100, 0], [100, 0]];
    for (const [ox, oy] of offsets) {
      _mortarBlast(ix + ox, iy + oy, dmg, blastR, stunDur, false);
    }
  }
}

function _mortarBlast(ix, iy, dmg, blastR, stunDur, isMain) {
  const r2 = blastR * blastR;
  const hpPct = game.warbornMortarHpPct?.() ?? 0;
  let killedCount = 0;
  let overkillTotal = 0;

  for (const e of game.enemyPool.pool) {
    if (!e.active) continue;
    const dx = e.x - ix, dy = e.y - iy;
    if (dx * dx + dy * dy > r2) continue;

    // Stun
    if (stunDur > 0) {
      e.stunUntil = (game.elapsed ?? 0) + stunDur;
    }

    // Damage
    const prevHp = e.hp;
    e.hp -= dmg;

    // Capstone current-HP removal
    if (hpPct > 0 && e.hp > 0) {
      e.hp -= e.hp * hpPct;
    }

    // Rush stack mechanics (C3 Unstoppable: mortar hits reset decay timer)
    if (game.warbornUnstoppable) {
      game.rushDecayTimer = 3.0;
    }

    if (e.hp <= 0) {
      e.hp = 0;
      const overkill = Math.max(0, -e.hp);
      overkillTotal += overkill;
      killedCount   += 1;

      // C3 Unstoppable: mortar kills grant extra stack
      if (game.warbornUnstoppable && game.warbornBloodRush) {
        game.addRushStacks(1);
        game.rushDecayTimer   = 3.0;
        // Overkill = 2 stacks
        if (overkill > 0) game.addRushStacks(1);
      }

      // Award kill (reuse killEnemy path)
      if (e.active) {
        // Manually award and deactivate
        const earned = Math.floor(e.reward * game.currencyMultiplier * game.factionCurrencyMult());
        game.currency   += earned;
        game.waveEarned += earned;
        game.waveKills  += 1;
        game.logEarned(earned);
        if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
        game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
        e.active = false;
      }
    }
  }

  // Explosion visual
  game.explosions.push({ x: ix, y: iy, r: blastR, t: 0.5, life: 0.5 });

  // Blood Rush kill-streak stacking for non-mortar-kill deaths is handled in main kill path
  // For mortar kills we track via killedCount above
  if (game.warbornBloodRush && killedCount > 0) {
    game.rushKillTimer  = 0;
    game.rushDecayTimer = 3.0;
    if (!game.warbornUnstoppable) {
      // Each kill in blast = 1 stack (Unstoppable already added them above)
      game.addRushStacks(killedCount);
    }
  }
}

function onWaveComplete(keepEnemies = false) {
  game.lastWaveEarned = game.waveEarned; // display value only — already credited live
  game.lastWave       = game.wave;
  game.waveEarned     = 0;

  // NEXUS C1: Data Harvest — +1 neural stack per wave (× filled slots if C3 active)
  if (game.dataHarvest) {
    let stacks = 1;
    if (game.recursiveGrowth) {
      const ts = game.traitorSystem;
      // Count filled slots up to slotCount (covers 4th slot when Singularity rank ≥ 1)
      const filled = ts
        ? ts.slots.slice(0, ts.slotCount).filter(Boolean).length
        : 0;
      stacks = Math.max(1, filled);
    }
    game.neuralStacks += stacks;
  }

  // WARBORN B1 passive: each wave clear removes 1s from all cooldowns
  if (game.warbornRallyCry) {
    const cdReduce = 1 + (game.warbornAvatarOfWar ? 1 : 0);  // +1 from B3
    game.overdriveCooldown    = Math.max(0, game.overdriveCooldown    - cdReduce);
    game.furyCooldown         = Math.max(0, game.furyCooldown         - cdReduce);
    game.annihilationCooldown = Math.max(0, game.annihilationCooldown - cdReduce);
  }

  // WARBORN B2 passive: each wave clear extends active ability durations by 0.5s
  if (game.warbornFury) {
    if (game.overdriveActive) game.overdriveTimer += 0.5;
    if (game.furyActive)      game.furyTimer      += 0.5;
  }

  // WARBORN C3 Unstoppable: 10s decay protection at wave start
  if (game.warbornUnstoppable) {
    game.rushDecayProtected = true;
    setTimeout(() => { game.rushDecayProtected = false; }, 10_000);
  }

  // VANGUARD A1: Advance Guard — accumulate +2% per wave cleared
  if (game.vanguardAdvanceGuard) {
    game.vanguardSpeedBonus += 0.02;
  }

  // VANGUARD A3: Spoils of War — if this was an early switch, count survivors
  if (keepEnemies && game.vanguardSpoilsOfWar) {
    game.vanguardSpoilsStacks = game.enemyPool.activeCount();
  } else if (!keepEnemies && game.vanguardSpoilsOfWar) {
    // Normal wave end (all enemies dead) — Spoils stacks reset
    game.vanguardSpoilsStacks = 0;
  }

  game.wave += game.vanguardTidalConvergence ? 10 : 1;
  if (game.wave - 1 > game.bestWave) game.bestWave = game.wave - 1;

  saveGame();
  audio.waveComplete();

  // Show results overlay but start next wave immediately
  game.resultsTimer = game.RESULTS_DURATION;
  beginWave(keepEnemies);
}

function onDefeated() {
  game.waveEarned = 0;

  if (game.wave > game.bestWave) game.bestWave = game.wave;

  saveGame();
  audio.laserStop(); // cut laser drone if it was active
  audio.defeated();
  game.transition(State.DEFEATED);

  // ENDLESS WAR capstone: auto-ascension on defeat
  if (game.autoAscensionMode === 'defeat' && game.pendingShards > 0) {
    setTimeout(() => {
      if (game.state === State.DEFEATED) beginAscend();
    }, 500);
  }
}

function resetToWaveOne() {
  // Fall back to the last x1 wave (e.g. die on 38 → restart at 31, die on 93 → restart at 91)
  game.wave = Math.max(1, Math.floor((game.wave - 1) / 10) * 10 + 1);
  // Reset VANGUARD per-run state (but keep speed bonus — earned via waves)
  game.vanguardBossKilledThisWave = false;
  // Upgrades and currency are kept — tower is rebuilt from upgrades
  shop.reapplyAll(game.upgrades);
  prestigeShop.reapplyAll(game.prestigeUpgrades);
  beginWave();
}

function saveGame() {
  save({
    wave:               game.wave,
    currency:           game.currency,
    towerHP:            game.tower.hp,
    upgrades:           game.upgrades,
    bestWave:           game.bestWave,
    currencyMultiplier: game.currencyMultiplier,
    // VANGUARD per-run state
    vanguardSpeedBonus:  game.vanguardSpeedBonus,
    vanguardSpoilsStacks: game.vanguardSpoilsStacks,
  });
  _savePrestigeState();
  saveTraitors(game.traitorSystem.serialize());
  saveFaction(game.factionSystem.serializeRun(game.neuralStacks));
  saveFactionCapstones(game.factionSystem.serializeCapstones());
}

function _savePrestigeState() {
  savePrestige({
    shards:             game.shards,
    pendingShards:      game.pendingShards,
    totalShardsEarned:  game.totalShardsEarned,
    prestigeUpgrades:   game.prestigeUpgrades,
    ascensionCount:     game.ascensionCount,
  });
}

// --- new game (full reset, keeps prestige) ---
export function newGame(confirmed) {
  if (!confirmed && hasSave()) return;
  clear();
  clearTraitors();
  clearFaction();
  game.wave               = 1;
  game.currency           = 0;
  game.upgrades           = {};
  game.currencyMultiplier = 1.0;
  game.bestWave           = 1;
  game.resultsTimer       = 0;
  game.pendingFactionChoice = false;
  // Reset VANGUARD per-run state
  game.vanguardSpeedBonus           = 0;
  game.vanguardSpoilsStacks         = 0;
  game.vanguardBossKilledThisWave   = false;
  game.tower              = new Tower();
  shop.reapplyAll({});
  prestigeShop.reapplyAll(game.prestigeUpgrades);
  game.factionSystem.activeFaction = null;
  game.factionSystem.reapplyAll(game);
  // Apply War Chest start currency
  game.currency = game.prestigeStartCurrency ?? 0;
  game.wave     = game.prestigeStartWave ?? 1;
  beginWave();
}

// --- ascend: step 1 — bank shards, call onAscend, show faction choice overlay ---
export function beginAscend() {
  // Veteran's Bounty: award bonus shards based on wave reached this run
  if (game.veteranBonusDivisor > 0) {
    game.pendingShards += Math.floor(game.wave / game.veteranBonusDivisor);
  }

  // VANGUARD C2: Momentum — multiply pending shards by (1 + 0.1 × ascensionCount)
  if (game.vanguardMomentum && game.pendingShards > 0) {
    const mult = 1 + 0.1 * game.ascensionCount;
    game.pendingShards = Math.floor(game.pendingShards * mult);
  }

  // Bank pending shards — now they count toward the passive damage bonus
  game.totalShardsEarned += game.pendingShards;
  game.shards            += game.pendingShards;
  game.pendingShards      = 0;
  game.ascensionCount    += 1;

  // VANGUARD B1: Eternal Tithe — +ascensionCount bonus shards
  if (game.vanguardEternalTithe) {
    const bonus = game.ascensionCount; // already incremented above
    game.shards            += bonus;
    game.totalShardsEarned += bonus;
  }

  // VANGUARD B3: Iron Vault — +1% of current shards (rounded down, min 1)
  if (game.vanguardIronVault && game.shards > 0) {
    const bonus = Math.max(1, Math.floor(game.shards * 0.01));
    game.shards            += bonus;
    game.totalShardsEarned += bonus;
  }

  // Preserve neural stacks via Singularity before run resets
  game.factionSystem.onAscend(game);

  // Save permanent faction capstones immediately
  saveFactionCapstones(game.factionSystem.serializeCapstones());
  _savePrestigeState();

  // Signal UI to show faction choice overlay (ui.js reads this flag)
  game.pendingFactionChoice = true;
}

// --- ascend: step 2 — complete run reset after faction is chosen ---
export function completeAscend(factionId) {
  game.pendingFactionChoice = false;

  // Join (or re-join) the chosen faction
  if (factionId) game.factionSystem.join(factionId);

  // Wipe run state
  clearFaction();
  clear();
  game.wave               = 1;
  game.currency           = 0;
  game.upgrades           = {};
  game.currencyMultiplier = 1.0;
  game.resultsTimer       = 0;
  game.tower              = new Tower();
  // Reset VANGUARD per-run state
  game.vanguardSpeedBonus           = 0;
  game.vanguardSpoilsStacks         = 0;
  game.vanguardBossKilledThisWave   = false;
  shop.reapplyAll({});
  prestigeShop.reapplyAll(game.prestigeUpgrades);
  game.factionSystem.reapplyAll(game);

  // Apply run-start bonuses from prestige
  game.currency = game.prestigeStartCurrency ?? 0;
  game.wave     = game.prestigeStartWave ?? 1;

  saveFaction(game.factionSystem.serializeRun());
  _savePrestigeState();
  beginWave();
}

// --- self-destruct: treat as a voluntary defeat (keeps upgrades + currency) ---
export function selfDestruct() {
  onDefeated();
}

// --- quality setting ---
export function setQuality(q) {
  if (q === 'auto') {
    game.autoQuality = true;
    // Reset timers so it starts fresh from current quality
    _autoLowTimer = 0;
    _autoCooldown = 0;
  } else {
    game.autoQuality = false;
    game.quality     = q;
    _autoLowTimer    = 0;
    _autoCooldown    = 0;
  }
  savePrefs({ quality: game.quality, volume: audio.volume, autoQuality: game.autoQuality });
}

// --- set auto-ascension mode (ENDLESS WAR capstone pref) ---
export function setAutoAscensionMode(mode) {
  game.autoAscensionMode = mode;
  const prefs = { quality: game.quality, volume: audio.volume, autoQuality: game.autoQuality, autoAscensionMode: mode };
  savePrefs(prefs);
}

// Expose to UI
window.__apex = { newGame, beginAscend, completeAscend, selfDestruct, setAutoAscensionMode, shop, prestigeShop, game, hasSave, audio, setQuality, savePrefs, saveTraitors };

// Init AudioContext on first user gesture (browser autoplay policy)
document.addEventListener('click',    () => audio.init(), { once: true });
document.addEventListener('keydown',  () => audio.init(), { once: true });
document.addEventListener('pointerdown', () => audio.init(), { once: true });

// ── WARBORN: mortar cursor tracking ────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  if (game.mortarCursorFrozen) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  game.mortarCursorX = (e.clientX - rect.left) * scaleX;
  game.mortarCursorY = (e.clientY - rect.top)  * scaleY;
});

canvas.addEventListener('click', () => {
  if (!game.warbornMortar) return;
  game.mortarCursorFrozen = !game.mortarCursorFrozen;
});

// ── WARBORN: ability keys 1 / 2 / 3 ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (game.state !== State.COMBAT) return;
  if (e.key === '1' && game.warbornRallyCry && !game.overdriveActive && game.overdriveCooldown <= 0) {
    game.overdriveActive  = true;
    game.overdriveTimer   = 5;
    const baseCd = 60 - game.warbornCooldownReduction();
    game.overdriveCooldown = Math.max(5, baseCd);
  }
  if (e.key === '2' && game.warbornFury && !game.furyActive && game.furyCooldown <= 0) {
    game.furyActive  = true;
    game.furyTimer   = 4;
    const baseCd = 60 - game.warbornCooldownReduction();
    game.furyCooldown = Math.max(4, baseCd);
  }
  if (e.key === '3' && game.warbornAvatarOfWar && game.annihilationCooldown <= 0) {
    // Instantly remove 30% current HP from all active enemies
    for (const e of game.enemyPool.pool) {
      if (!e.active) continue;
      e.hp -= e.hp * 0.30;
      if (e.hp <= 0) {
        e.hp = 0;
        // award kill via projectile module helper (re-uses existing logic)
        // We use a minimal inline kill — full kill award not needed for balance
      }
    }
    const baseCd = 60 - game.warbornCooldownReduction();
    game.annihilationCooldown = Math.max(5, baseCd);
  }
});

// --- go ---
bootstrap();
requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });
