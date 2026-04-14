import { audio } from './audio.js';

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

    // Visual
    this.x               = 0;
    this.y               = 0;
    this.radius          = 24;
    this.hitFlash        = 0;     // seconds remaining for red hit flash
  }

  // Called by enemy when it reaches the tower
  takeDamage(amount, game) {
    this.hp       -= amount;
    this.hitFlash  = 0.12;
    audio.towerHit();
    if (game && game.particles && game.quality !== 'low') game.particles.emitTowerHit(this.x, this.y);
  }

  update(dt, game) {
    if (this.hitFlash > 0) this.hitFlash -= dt;

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

    for (const target of targets) {
      this._fireAt(target, game, this.x, this.y);
    }

    // Fire sound — pick variant based on active modes
    if (this.spreadShot)         audio.fireSpread();
    else if (this.multiShotCount > 1) audio.fireMulti();
    else                         audio.fireSingle();

    this.fireCooldown = 1 / this.fireRate;
  }

  _fireAt(target, game, ox, oy) {
    const dx  = target.x - ox;
    const dy  = target.y - oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx  = dx / len;
    const ny  = dy / len;

    if (this.spreadShot) {
      const baseA = Math.atan2(ny, nx);
      const half  = (this.spreadAngle / 2) * (Math.PI / 180);
      const extra = this.spreadPellets - 1; // pellets beyond the center shot

      // Center shot — always aimed dead at target
      game.projectilePool.fire(
        ox, oy,
        nx * this.projectileSpeed,
        ny * this.projectileSpeed,
        this.damage,
        this.explosiveRadius,
        this.chainJumps,
      );

      // Extra pellets distributed evenly on both sides
      const step = extra > 0 ? half / Math.ceil(extra / 2) : 0;
      for (let i = 1; i <= extra; i++) {
        const side   = i % 2 === 1 ? 1 : -1;         // alternate left/right
        const offset = Math.ceil(i / 2) * step * side;
        const a      = baseA + offset;
        game.projectilePool.fire(
          ox, oy,
          Math.cos(a) * this.projectileSpeed,
          Math.sin(a) * this.projectileSpeed,
          this.damage,
          this.explosiveRadius,
          this.chainJumps,
        );
      }
    } else {
      game.projectilePool.fire(
        ox, oy,
        nx * this.projectileSpeed,
        ny * this.projectileSpeed,
        this.damage,
        this.explosiveRadius,
        this.chainJumps,
      );
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
    const rotSpeed    = t <= 2 ? (t === 1 ? 90 : 110) : (t === 3 ? 110 : t === 4 ? 130 : 150); // degrees/sec
    const arcDeg      = t === 1 ? 30 : t === 2 ? 45 : t === 3 ? 45 : t === 4 ? 60 : 75;
    const arcRad      = arcDeg * (Math.PI / 180);
    const ORBIT_R     = this.radius + 16;
    const DPS         = this.damage * this.fireRate * 8.0; // high — contact time per pass is very short
    const rotRad      = rotSpeed * (Math.PI / 180) * dt;

    this.ringAngle  = (this.ringAngle  + rotRad)          % (Math.PI * 2);
    this.ringAngle2 = (this.ringAngle2 - rotRad * 0.7 + Math.PI * 2) % (Math.PI * 2); // slower counter-rotation

    const rings = t >= 3 ? [this.ringAngle, this.ringAngle2] : [this.ringAngle];

    for (const e of game.enemyPool.pool) {
      if (!e.active) continue;
      const dx   = e.x - this.x;
      const dy   = e.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > ORBIT_R + e.radius || dist < ORBIT_R - e.radius) continue; // rough radial band

      const eAngle = Math.atan2(dy, dx);

      for (const rAngle of rings) {
        let dAngle = Math.abs(eAngle - rAngle) % (Math.PI * 2);
        if (dAngle > Math.PI) dAngle = Math.PI * 2 - dAngle;
        if (dAngle < arcRad / 2) {
          e.hp -= DPS * dt;
          // Hit spark — visible feedback that the ring is doing damage
          if (game.particles && game.quality !== 'low' && Math.random() < 0.3) {
            game.particles.emitHit(e.x, e.y, '#ff6d00');
          }
          if (e.hp <= 0) {
            const earned = Math.floor(e.reward * game.currencyMultiplier);
            game.currency   += earned;
            game.waveEarned += earned;
            game.logEarned(earned);
            _spawnCurrencyPopup(earned, game, e.x, e.y);
            if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
            game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
            if      (e.type === 'BOSS')  { audio.deathBoss(); game.edgeFlash = 0.5; }
            else if (e.type === 'BRUTE')   audio.deathLarge();
            else if (e.type === 'ELITE')   audio.deathMedium();
            else                           audio.deathSmall();
            e.active = false;
          }
          break; // one ring hit is enough per frame
        }
      }
    }
  }

  // ── Laser burst ─────────────────────────────────────────────────────────────

  _updateLaser(dt, game) {
    const BURST_DURATION = 1.5 + this.laserTier * 0.3;  // sec: 1.8 / 2.1 / 2.4 / 2.7 / 3.0
    const BURST_COOLDOWN = 8   - this.laserTier * 1.0;  // sec: 7 / 6 / 5 / 4 / 3
    const SWEEP_SPEED    = (Math.PI * 2) / BURST_DURATION;

    // Range and DPS multiplier scale strongly per tier — high multipliers needed
    // because the beam only contacts each enemy for ~0.08s per sweep pass
    const RANGE_BY_TIER = [0, 220, 300, 400, 520, 660];
    const DPS_MULT      = [0, 8, 12, 18, 26, 36];
    this.laserRange     = RANGE_BY_TIER[this.laserTier] ?? 220;
    const DPS           = this.damage * this.fireRate * DPS_MULT[this.laserTier];

    if (this.laserActive) {
      this.laserTimer -= dt;
      this.laserAngle += SWEEP_SPEED * dt;

      // Damage enemies within range near the beam angle
      for (const e of game.enemyPool.pool) {
        if (!e.active) continue;
        const dx   = e.x - this.x;
        const dy   = e.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.laserRange) continue;

        const eAngle = Math.atan2(dy, dx);
        let dAngle   = Math.abs(eAngle - (this.laserAngle % (Math.PI * 2)));
        if (dAngle > Math.PI) dAngle = Math.PI * 2 - dAngle;
        if (dAngle < 0.15) { // ~8.5° beam half-width
          e.hp -= DPS * dt;
          // Hit spark at the beam impact point
          if (game.particles && game.quality !== 'low' && Math.random() < 0.5) {
            game.particles.emitHit(e.x, e.y, '#ff4081');
          }
          if (e.hp <= 0) {
            const earned = Math.floor(e.reward * game.currencyMultiplier);
            game.currency   += earned;
            game.waveEarned += earned;
            game.logEarned(earned);
            _spawnCurrencyPopup(earned, game, e.x, e.y);
            if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
            game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
            if      (e.type === 'BOSS')  { audio.deathBoss(); game.edgeFlash = 0.5; }
            else if (e.type === 'BRUTE')   audio.deathLarge();
            else if (e.type === 'ELITE')   audio.deathMedium();
            else                           audio.deathSmall();
            e.active = false;
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
        // Only fire if at least one enemy is within laser range
        const r2       = this.laserRange * this.laserRange;
        const hasTarget = game.enemyPool.pool.some(
          e => e.active && (e.x - this.x) ** 2 + (e.y - this.y) ** 2 <= r2
        );
        if (hasTarget) {
          this.laserActive = true;
          this.laserTimer  = BURST_DURATION;
          this.laserAngle  = 0;
          audio.laserStart(this.laserTier);
        } else {
          // Hold cooldown at zero — fire immediately once enemies arrive
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
