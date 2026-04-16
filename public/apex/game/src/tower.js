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

    // Prestige: shield
    this.shieldChargesMax  = 0;
    this.shieldCharges     = 0;
    this.invulnTimer       = 0;   // seconds of invulnerability remaining

    // Shop late-game upgrades
    this.overchargeN       = 0;     // 0 = not unlocked; otherwise every Nth shot deals ×4 dmg
    this.overchargeCounter = 0;     // counts shots since last overcharge proc
    this.splashMult        = 0.6;   // explosive splash damage fraction (base 0.6)
    this.leechHp           = 0;     // HP restored per kill
    this.ringDpsMult       = 1.0;   // Ring of Annihilation DPS multiplier
    this.laserDpsMult      = 1.0;   // Apocalypse Laser DPS multiplier

    // Visual
    this.x               = 0;
    this.y               = 0;
    this.radius          = 24;
    this.hitFlash        = 0;     // seconds remaining for red hit flash
  }

  // Called by enemy when it reaches the tower
  takeDamage(amount, game) {
    // Invulnerability window (from shield proc)
    if (this.invulnTimer > 0) return;

    // Shield absorbs the hit and grants invulnerability
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
      this.invulnTimer    = 1.5;
      this.hitFlash       = 0.25;
      audio.towerHit();
      if (game && game.particles && game.quality !== 'low') game.particles.emitTowerHit(this.x, this.y);
      return;
    }

    this.hp       -= amount;
    this.hitFlash  = 0.12;
    audio.towerHit();
    if (game && game.particles && game.quality !== 'low') game.particles.emitTowerHit(this.x, this.y);
  }

  update(dt, game) {
    if (this.hitFlash  > 0) this.hitFlash  -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // Shard passive × traitor pet bonus × base damage for all weapons this frame
    this._dmgMult = game.shardDmgMult() * game.traitorDmgMult();

    this._updateMainGun(dt, game);
    if (this.ringTier > 0)  this._updateRings(dt, game);
    if (this.laserUnlocked) this._updateLaser(dt, game);
  }

  // ── Main gun ────────────────────────────────────────────────────────────────

  _updateMainGun(dt, game) {
    this.fireCooldown -= dt;
    if (this.fireCooldown > 0) return;

    const r2      = this.range * this.range;
    const targets = _nearestEnemies(game.enemyPool.pool, this, this.multiShotCount, r2);
    if (targets.length === 0) return;

    // Overcharge: every Nth shot deals ×4 damage
    let overchargeMult = 1;
    if (this.overchargeN > 0) {
      this.overchargeCounter += 1;
      if (this.overchargeCounter >= this.overchargeN) {
        this.overchargeCounter = 0;
        overchargeMult = 4;
      }
    }

    for (const target of targets) {
      this._fireAt(target, game, this.x, this.y, overchargeMult);
    }

    // Fire sound — pick variant based on active modes
    if (this.spreadShot)              audio.fireSpread();
    else if (this.multiShotCount > 1) audio.fireMulti();
    else                              audio.fireSingle();

    this.fireCooldown = 1 / this.fireRate;
  }

  _fireAt(target, game, ox, oy, overchargeMult = 1) {
    const dx  = target.x - ox;
    const dy  = target.y - oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx  = dx / len;
    const ny  = dy / len;

    // Crit roll — applied to the damage passed into the projectile
    const isCrit = this.critChance > 0 && Math.random() < this.critChance;
    const dmg    = Math.round(this.damage * this._dmgMult * (isCrit ? this.critMult : 1) * overchargeMult);

    if (this.spreadShot) {
      const baseA = Math.atan2(ny, nx);
      const half  = (this.spreadAngle / 2) * (Math.PI / 180);
      const extra = this.spreadPellets - 1;

      game.projectilePool.fire(ox, oy, nx * this.projectileSpeed, ny * this.projectileSpeed,
        dmg, this.explosiveRadius, this.chainJumps, this.executeThreshold);

      const step = extra > 0 ? half / Math.ceil(extra / 2) : 0;
      for (let i = 1; i <= extra; i++) {
        const side   = i % 2 === 1 ? 1 : -1;
        const offset = Math.ceil(i / 2) * step * side;
        const a      = baseA + offset;
        game.projectilePool.fire(ox, oy, Math.cos(a) * this.projectileSpeed, Math.sin(a) * this.projectileSpeed,
          dmg, this.explosiveRadius, this.chainJumps, this.executeThreshold);
      }
    } else {
      game.projectilePool.fire(ox, oy, nx * this.projectileSpeed, ny * this.projectileSpeed,
        dmg, this.explosiveRadius, this.chainJumps, this.executeThreshold);
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
          if (e.hp <= 0 || (this.executeThreshold > 0 && e.hp / e.maxHp < this.executeThreshold)) {
            e.hp = 0;
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
          if (e.hp <= 0 || (this.executeThreshold > 0 && e.hp / e.maxHp < this.executeThreshold)) {
            e.hp = 0;
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
  game.currencyPopups.push({ amount, x, y, t: 0.9 });
}

function _towerKillEnemy(e, game) {
  const earned = Math.floor(e.reward * game.currencyMultiplier);
  game.currency   += earned;
  game.waveEarned += earned;
  game.logEarned(earned);
  _spawnCurrencyPopup(earned, game, e.x, e.y);
  // Traitor capture roll
  const pet = game.traitorSystem?.tryCapture(e, game.wave);
  if (pet) game.pendingTraitorAnnouncements.push(pet);
  // Leech: restore HP on kill
  if (game.tower.leechHp > 0) {
    game.tower.hp = Math.min(game.tower.maxHp, game.tower.hp + game.tower.leechHp);
  }
  if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
  game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
  if (e.type === EnemyType.BOSS) {
    audio.deathBoss(); game.edgeFlash = 0.5; game.awardShards(game.wave);
  } else if (e.type === EnemyType.COLOSSUS) {
    audio.deathBoss();
    // Release 3 drones on death
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 / 3) * i;
      game.enemyPool.spawn(EnemyType.DRONE, Math.max(1, game.wave - 1),
        e.x + Math.cos(angle) * 20, e.y + Math.sin(angle) * 20);
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
