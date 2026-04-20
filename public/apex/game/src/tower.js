import { audio } from './audio.js';
import { EnemyType, _bomberDetonate } from './enemy.js';

export class Tower {
  constructor() {
    this.maxHp           = 1000;
    this.hp              = 1000;
    this.damage          = 35;
    this.fireRate        = 1.5;   // shots per second
    this.projectileSpeed = 400;   // px/sec
    this.range           = 220;   // px
    this.fireCooldown    = 0;

    // Fire mode flags (set by upgrades)
    this.multiShotCount  = 1;
    this.spreadShot      = false;
    this.spreadPellets   = 3;
    this.spreadAngle     = 20;    // degrees
    this.explosiveRadius = 0;
    this.chainJumps      = 0;

    // Laser burst
    this.laserUnlocked   = false;
    this.laserTier       = 0;
    this.laserRange      = 220;   // px — updated each tier by _updateLaser
    this.laserCooldown   = 0;     // time until next burst
    this.laserActive     = false; // currently sweeping
    this.laserAngle      = 0;     // current sweep angle (radians)
    this.laserTimer      = 0;     // time remaining in current burst

    // Orbital Death Ring
    this.ringTier        = 0;     // 0 = not unlocked
    this.ringAngle       = 0;     // angle of ring 1 (radians)
    this.ringAngle2      = 0;     // angle of ring 2 (counter-rotating, tier 3+)

    // Regen (applied between waves as a fraction of maxHp)
    this.regenFraction   = 0;     // e.g. 0.09 = heal 9% of maxHp per wave

    // Prestige: crits
    this.critChance      = 0;     // 0.0–1.0 probability
    this.critMult        = 2.0;   // damage multiplier on crit

    // Prestige: execute threshold
    this.executeThreshold = 0;    // 0.0–0.15 fraction of max HP

    // Prestige: laser slow
    this.laserSlowFactor   = 1.0; // speed fraction while slowed (1.0 = no slow)
    this.laserSlowDuration = 0;   // seconds

    // Prestige: ring stun
    this.ringStunDuration  = 0;   // seconds

    this.invulnTimer       = 0;   // seconds of invulnerability remaining (Resurgence)

    // Shop late-game upgrades
    this.overchargeN       = 0;     // 0 = not unlocked; otherwise every Nth shot deals ×4 dmg
    this.overchargeCounter = 0;     // counts shots since last overcharge proc
    this.splashMult        = 0.6;   // explosive splash damage fraction (base 0.6)
    this.leechHp           = 0;     // HP restored per kill
    this.ringDpsMult       = 1.0;   // Ring of Annihilation DPS multiplier
    this.laserDpsMult      = 1.0;   // Apocalypse Laser DPS multiplier

    // Prestige: ricochet
    this.ricochetCount     = 0;     // extra bounce targets per shot

    // Prestige: poison
    this.poisonFraction    = 0;     // DoT = fraction of hit damage over 3 s (0 = disabled)

    // Prestige: resurgence
    this.resurgenceHp      = 0;     // fraction of maxHp to revive at (0 = disabled)
    this.resurgenceUsed    = false; // one-time per run

    // Prestige: wave rush
    this.waveSkipThreshold = 0;     // 0 = disabled; >0 = fraction of wave that must die to skip

    // Prestige: obliterate
    this.obliterateDelay   = 0;     // seconds countdown after 10× overkill (0 = disabled)

    // Prestige: high-end talents
    this.voidSurgeMult        = 1.0;  // global DPS multiplier (all weapons)
    this.forgeDmg             = 0;    // flat bonus added to tower.damage before multipliers
    this.overchargeAmp        = 0;    // extra overcharge multiplier beyond base ×4
    this.echoShotChance       = 0;    // 0–0.75: chance to fire extra volley (multi-shot only)
    this.arcMasteryJumps      = 0;    // extra chain lightning jumps
    this.arcMasteryDmgMult    = 1.0;  // per-jump escalating damage (1.20 when arcMasteryJumps > 0)
    this.detonationRadiusMult = 1.0;  // explosive radius multiplier (applied on top of shop radius)
    this.detonationSlow       = 0;    // seconds of slow applied by each explosion
    this.arsenalFireRateBonus = 0;    // additive bonus to fire rate (×1.05 per tier = 0.05/tier)
    this.arsenalProjBonus     = 0;    // extra simultaneous targets beyond shop multiShotCount
    this.apexBossExecute      = 0;    // execute threshold that applies specifically to Bosses
    this.apexFireRateBurst    = 0;    // fire rate bonus fraction on execute kill
    this.apexBurstDuration    = 3.0;  // duration of Apex fire rate burst in seconds
    this.apexBurstTimer       = 0;    // countdown for active Apex fire rate burst
    this.shardCovenantBonus   = 1.0;  // wave-start multiplier from Shard Covenant (sampled at beginWave)

    // Visual
    this.x               = 0;
    this.y               = 0;
    this.radius          = 24;
    this.hitFlash        = 0;     // seconds remaining for red hit flash
  }

  // Called by enemy when it reaches the tower
  takeDamage(amount, game) {
    // Invulnerability window (Resurgence proc)
    if (this.invulnTimer > 0) return;

    this.hp       -= amount;

    // Resurgence: one-time death prevention
    if (this.hp <= 0 && this.resurgenceHp > 0 && !this.resurgenceUsed) {
      this.resurgenceUsed = true;
      this.hp             = Math.ceil(this.maxHp * this.resurgenceHp);
      this.invulnTimer    = 2.0;  // brief invulnerability after revival
      this.hitFlash       = 0.5;
      audio.towerHit();
      if (game && game.particles && game.quality !== 'low') game.particles.emitTowerHit(this.x, this.y);
      return;
    }
    this.hitFlash  = 0.12;
    audio.towerHit();
    if (game && game.particles && game.quality !== 'low') game.particles.emitTowerHit(this.x, this.y);
  }

  update(dt, game) {
    if (this.hitFlash  > 0) this.hitFlash  -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // Shard passive × traitor pet bonus × faction (neural stacks) × WARBORN (rush+fury) × VANGUARD (spoils) for all weapons this frame
    this._dmgMult = game.shardDmgMult() * game.traitorDmgMult() * game.factionDmgMult()
      * (game.rushDmgMult?.() ?? 1.0)
      * (game.furyDmgMult?.() ?? 1.0)
      * (game.vanguardSpoilsDmgMult?.() ?? 1.0)
      * this.voidSurgeMult
      * this.shardCovenantBonus;

    // Apex Predator: count down active fire-rate burst
    if (this.apexBurstTimer > 0) this.apexBurstTimer -= dt;

    this._updateMainGun(dt, game);
    if (this.ringTier > 0)  this._updateRings(dt, game);
    if (this.laserUnlocked) this._updateLaser(dt, game);
  }

  // ── Main gun ────────────────────────────────────────────────────────────────

  _updateMainGun(dt, game) {
    this.fireCooldown -= dt;
    if (this.fireCooldown > 0) return;

    // Eternal Arsenal: extend target count beyond shop multiShotCount
    const effectiveShotCount = this.multiShotCount + this.arsenalProjBonus;
    const r2      = this.range * this.range;
    const targets = _nearestEnemies(game.enemyPool.pool, this, effectiveShotCount, r2);
    if (targets.length === 0) return;

    // Overcharge: every Nth shot deals ×(4 + overchargeAmp) damage
    let overchargeMult = 1;
    if (this.overchargeN > 0) {
      this.overchargeCounter += 1;
      if (this.overchargeCounter >= this.overchargeN) {
        this.overchargeCounter = 0;
        overchargeMult = 4 + this.overchargeAmp;
      }
    }

    for (const target of targets) {
      this._fireAt(target, game, this.x, this.y, overchargeMult);
    }

    // Echo Shot: chance to fire a free extra volley (only when multi-shot is active)
    if (this.echoShotChance > 0 && this.multiShotCount > 1 && Math.random() < this.echoShotChance) {
      for (const target of targets) {
        this._fireAt(target, game, this.x, this.y, overchargeMult);
      }
    }

    // Fire sound — pick variant based on active modes
    if (this.spreadShot)              audio.fireSpread();
    else if (effectiveShotCount > 1)  audio.fireMulti();
    else                              audio.fireSingle();

    const overdriveMult = game.overdriveFireRateMult?.() ?? 1.0;
    const rampageMult   = game.rampageFireRateMult?.()   ?? 1.0;
    // Eternal Arsenal: bonus fire rate stacks additively; Apex Predator: +50% burst
    const apexMult      = (this.apexBurstTimer > 0 && this.apexFireRateBurst > 0)
                          ? (1 + this.apexFireRateBurst) : 1.0;
    const arsenalMult   = 1 + this.arsenalFireRateBonus;
    this.fireCooldown = 1 / (this.fireRate * overdriveMult * rampageMult * apexMult * arsenalMult);
  }

  _fireAt(target, game, ox, oy, overchargeMult = 1) {
    const dx  = target.x - ox;
    const dy  = target.y - oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx  = dx / len;
    const ny  = dy / len;

    // Crit roll — applied to the damage passed into the projectile
    const isCrit = this.critChance > 0 && Math.random() < this.critChance;
    // VANGUARD A3: Spoils of War adds flat crit damage bonus
    const spoilsCritAdd = game.vanguardSpoilsCritAdd?.() ?? 0;
    const effectiveCritMult = this.critMult + spoilsCritAdd;
    // forgeDmg: flat bonus applied before all multipliers
    const baseDmg = this.damage + this.forgeDmg;
    const dmg    = Math.round(baseDmg * this._dmgMult * (isCrit ? effectiveCritMult : 1) * overchargeMult);
    const isOC   = overchargeMult > 1;
    // Detonation Field: scale explosive radius by prestige multiplier
    const effExplosiveRadius = this.explosiveRadius > 0
      ? Math.round(this.explosiveRadius * this.detonationRadiusMult)
      : 0;
    // Arc Mastery: extra chain jumps on top of shop chainJumps
    const effChainJumps = this.chainJumps + this.arcMasteryJumps;

    if (this.spreadShot) {
      const baseA = Math.atan2(ny, nx);
      const half  = (this.spreadAngle / 2) * (Math.PI / 180);
      const extra = this.spreadPellets - 1;

      game.projectilePool.fire(ox, oy, nx * this.projectileSpeed, ny * this.projectileSpeed,
        dmg, effExplosiveRadius, effChainJumps, this.executeThreshold, this.ricochetCount, isOC);

      const step = extra > 0 ? half / Math.ceil(extra / 2) : 0;
      for (let i = 1; i <= extra; i++) {
        const side   = i % 2 === 1 ? 1 : -1;
        const offset = Math.ceil(i / 2) * step * side;
        const a      = baseA + offset;
        game.projectilePool.fire(ox, oy, Math.cos(a) * this.projectileSpeed, Math.sin(a) * this.projectileSpeed,
          dmg, effExplosiveRadius, effChainJumps, this.executeThreshold, this.ricochetCount, isOC);
      }
    } else {
      game.projectilePool.fire(ox, oy, nx * this.projectileSpeed, ny * this.projectileSpeed,
        dmg, effExplosiveRadius, effChainJumps, this.executeThreshold, this.ricochetCount, isOC);
    }
  }

  // ── Orbital Death Ring ──────────────────────────────────────────────────────

  _updateRings(dt, game) {
    // Tier 1: 1 ring, 30° arc, 90°/s
    // Tier 2: 1 ring, 45° arc, 110°/s
    // Tier 3: 2 rings (counter-rotating), 45° arc each, 110°/s
    // Tier 4: 2 rings (counter-rotating), 60° arc each, 130°/s
    // Tier 5: 2 rings (counter-rotating), 75° arc each, 150°/s
    const t           = this.ringTier;
    const rotSpeed    = t <= 2 ? (t === 1 ? 90 : 110) : (t === 3 ? 110 : t === 4 ? 130 : 150);
    const arcDeg      = t === 1 ? 30 : t === 2 ? 45 : t === 3 ? 45 : t === 4 ? 60 : 75;
    const arcRad      = arcDeg * (Math.PI / 180);
    const ORBIT_R     = this.radius + 16;
    const DPS         = this.damage * this.fireRate * 8.0 * this._dmgMult * this.ringDpsMult;
    const rotRad      = rotSpeed * (Math.PI / 180) * dt;

    this.ringAngle  = (this.ringAngle  + rotRad)          % (Math.PI * 2);
    this.ringAngle2 = (this.ringAngle2 - rotRad * 0.7 + Math.PI * 2) % (Math.PI * 2);

    const rings = t >= 3 ? [this.ringAngle, this.ringAngle2] : [this.ringAngle];

    for (const e of game.enemyPool.pool) {
      if (!e.active) continue;
      const dx   = e.x - this.x;
      const dy   = e.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > ORBIT_R + e.radius || dist < ORBIT_R - e.radius) continue;

      const eAngle = Math.atan2(dy, dx);

      for (const rAngle of rings) {
        let dAngle = Math.abs(eAngle - rAngle) % (Math.PI * 2);
        if (dAngle > Math.PI) dAngle = Math.PI * 2 - dAngle;
        if (dAngle < arcRad / 2) {
          // Colossus armor: absorb first ring tick per wave
          if (e.type === EnemyType.COLOSSUS && !e.armorRing) {
            e.armorRing = true;
            break;
          }
          e.hp -= DPS * dt;
          if (game.particles && game.quality !== 'low' && Math.random() < 0.3) {
            game.particles.emitHit(e.x, e.y, '#ff6d00');
          }
          // Ring stun (prestige)
          if (this.ringStunDuration > 0) {
            e.stunUntil = (game.elapsed ?? 0) + this.ringStunDuration;
          }
          if (e.hp <= 0 || (this.executeThreshold > 0 && e.hp / e.maxHp < this.executeThreshold)
              || (this.apexBossExecute > 0 && e.type === EnemyType.BOSS && e.hp / e.maxHp < this.apexBossExecute)) {
            const wasExecute = e.hp > 0;
            e.hp = 0;
            if (wasExecute && this.apexFireRateBurst > 0) this.apexBurstTimer = this.apexBurstDuration;
            _towerKillEnemy(e, game);
          }
          break;
        }
      }
    }
  }

  // ── Laser burst ─────────────────────────────────────────────────────────────

  _updateLaser(dt, game) {
    const BURST_DURATION = 1.5 + this.laserTier * 0.3;  // sec: 1.8 / 2.1 / 2.4 / 2.7 / 3.0
    const BURST_COOLDOWN = 8   - this.laserTier * 1.0;  // sec: 7 / 6 / 5 / 4 / 3
    const SWEEP_SPEED    = (Math.PI * 2) / BURST_DURATION;

    const RANGE_BY_TIER = [0, 220, 300, 400, 520, 660];
    const DPS_MULT      = [0, 8, 12, 18, 26, 36];
    this.laserRange     = RANGE_BY_TIER[this.laserTier] ?? 220;
    const DPS           = this.damage * this.fireRate * DPS_MULT[this.laserTier] * this._dmgMult * this.laserDpsMult;

    if (this.laserActive) {
      this.laserTimer -= dt;
      this.laserAngle += SWEEP_SPEED * dt;

      for (const e of game.enemyPool.pool) {
        if (!e.active) continue;
        const dx   = e.x - this.x;
        const dy   = e.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.laserRange) continue;

        const eAngle = Math.atan2(dy, dx);
        let dAngle   = Math.abs(eAngle - (this.laserAngle % (Math.PI * 2)));
        if (dAngle > Math.PI) dAngle = Math.PI * 2 - dAngle;
        if (dAngle < 0.15) {
          // Colossus armor: absorb first laser tick per wave
          if (e.type === EnemyType.COLOSSUS && !e.armorLaser) {
            e.armorLaser = true;
            continue;
          }
          e.hp -= DPS * dt;
          if (game.particles && game.quality !== 'low' && Math.random() < 0.5) {
            game.particles.emitHit(e.x, e.y, '#ff4081');
          }
          // Laser slow (prestige)
          if (this.laserSlowFactor < 1.0) {
            e.slowUntil  = (game.elapsed ?? 0) + this.laserSlowDuration;
            e.slowFactor = this.laserSlowFactor;
          }
          if (e.hp <= 0 || (this.executeThreshold > 0 && e.hp / e.maxHp < this.executeThreshold)
              || (this.apexBossExecute > 0 && e.type === EnemyType.BOSS && e.hp / e.maxHp < this.apexBossExecute)) {
            const wasExecute = e.hp > 0;
            e.hp = 0;
            if (wasExecute && this.apexFireRateBurst > 0) this.apexBurstTimer = this.apexBurstDuration;
            _towerKillEnemy(e, game);
          }
        }
      }

      if (this.laserTimer <= 0) {
        this.laserActive   = false;
        this.laserCooldown = BURST_COOLDOWN;
        audio.laserStop();
      }
    } else {
      this.laserCooldown -= dt;
      if (this.laserCooldown <= 0) {
        const r2        = this.laserRange * this.laserRange;
        const hasTarget = game.enemyPool.pool.some(
          e => e.active && (e.x - this.x) ** 2 + (e.y - this.y) ** 2 <= r2
        );
        if (hasTarget) {
          this.laserActive = true;
          this.laserTimer  = BURST_DURATION;
          this.laserAngle  = 0;
          audio.laserStart(this.laserTier);
        } else {
          this.laserCooldown = 0;
        }
      }
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _nearestEnemies(pool, origin, count, maxR2 = Infinity) {
  return pool
    .filter(e => e.active && _dist2(e, origin) <= maxR2)
    .sort((a, b) => _dist2(a, origin) - _dist2(b, origin))
    .slice(0, count);
}

function _dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function _spawnCurrencyPopup(amount, game, x, y) {
  // Currency popups removed — no-op kept so call sites compile without changes
}

function _towerKillEnemy(e, game) {
  const earned = Math.floor(e.reward * game.currencyMultiplier * game.factionCurrencyMult());
  game.currency   += earned;
  game.waveEarned += earned;
  game.waveKills  += 1;
  game.logEarned(earned);
  _spawnCurrencyPopup(earned, game, e.x, e.y);
  // WARBORN Blood Rush: any kill resets decay timer and grants a stack
  if (game.warbornBloodRush) {
    game.addRushStacks(1);
    game.rushDecayTimer      = 3.0;
    game.rushKillTimer       = 0;
    game.rushDecayProtected  = false;
  }
  // Traitor capture roll
  const pet = game.traitorSystem?.tryCapture(e, game.wave, game);
  if (pet) {
    game.pendingTraitorAnnouncements.push(pet);
    game.traitorSystem.optimizeForNexus(game);
  }
  // Leech: restore HP on kill
  if (game.tower.leechHp > 0) {
    game.tower.hp = Math.min(game.tower.maxHp, game.tower.hp + game.tower.leechHp);
  }
  if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
  game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
  if (e.type === EnemyType.BOSS) {
    audio.deathBoss(); game.edgeFlash = 0.5; game.awardShards(game.wave);
    game.vanguardBossKilledThisWave = true;
  } else if (e.type === EnemyType.COLOSSUS) {
    audio.deathBoss();
    // Release 3 drones on death
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 / 3) * i;
      game.enemyPool.spawn(EnemyType.DRONE, Math.max(1, game.wave - 1),
        e.x + Math.cos(angle) * 20, e.y + Math.sin(angle) * 20, game);
    }
  } else if (e.type === EnemyType.BOMBER) {
    _bomberDetonate(e, game);
    return; // _bomberDetonate sets active = false
  } else if (e.type === EnemyType.BRUTE || e.type === EnemyType.SPAWNER) {
    audio.deathLarge();
  } else if (e.type === EnemyType.ELITE || e.type === EnemyType.PHANTOM) {
    audio.deathMedium();
  } else {
    audio.deathSmall();
  }
  e.active = false;
}

// Returns the expected (normalized) damage of a single regular shot, factoring in:
// base damage (incl. Damage upgrade), shard multiplier, traitor bonus, faction stacks,
// WARBORN rush/fury, and expected crit value — but NOT overcharge, spread, explosive, or other modifiers.
// Returns the expected (normalized) damage of a single shot event against a single target, factoring in:
// base damage (incl. Damage upgrade + forgeDmg), shard multiplier, traitor bonus, faction stacks,
// WARBORN rush/fury, VANGUARD spoils, voidSurgeMult, shardCovenantBonus, crit (chance × mult),
// overcharge expected factor, execute HP skip factor, spread pellet count, and echo shot chance.
// NOTE: WARBORN capstone HP%-removal is NOT included here — it is added at the call site in
// checkObliterateAtWaveStart() because it scales with enemy HP, not a flat dmg multiplier.
export function normalizedShotDamage(tower, game) {
  const dmgMult        = game.shardDmgMult() * game.traitorDmgMult() * game.factionDmgMult()
                         * (game.rushDmgMult?.() ?? 1.0)
                         * (game.furyDmgMult?.() ?? 1.0)
                         * (game.vanguardSpoilsDmgMult?.() ?? 1.0)
                         * tower.voidSurgeMult
                         * tower.shardCovenantBonus;
  const spoilsCritAdd  = game.vanguardSpoilsCritAdd?.() ?? 0;
  const effectiveCritMult = tower.critMult + spoilsCritAdd;
  const critFactor     = 1 + tower.critChance * (effectiveCritMult - 1);
  // Overcharge: every N-th shot is ×(4 + overchargeAmp); expected factor = (N−1 + mult) / N
  const ochMult        = 4 + tower.overchargeAmp;
  const overchargeFactor = tower.overchargeN > 0 ? 1 + (ochMult - 1) / tower.overchargeN : 1;
  // Execute: skips the last `threshold` fraction of every enemy's HP
  const executeFactor  = tower.executeThreshold > 0 ? 1 / (1 - tower.executeThreshold) : 1;
  // forgeDmg: flat bonus before multipliers
  const baseDmg        = tower.damage + tower.forgeDmg;
  // Spread shot: all pellets hit the same primary target simultaneously — multiply by pellet count
  const spreadFactor   = tower.spreadShot ? tower.spreadPellets : 1;
  // Echo Shot: expected extra volley factor when multi-shot is active
  const echoFactor     = (tower.echoShotChance > 0 && tower.multiShotCount > 1)
                         ? (1 + tower.echoShotChance) : 1;

  return baseDmg * dmgMult * critFactor * overchargeFactor * executeFactor * spreadFactor * echoFactor;
}
