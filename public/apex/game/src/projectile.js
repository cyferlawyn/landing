import { audio } from './audio.js';

// ── Spatial grid ─────────────────────────────────────────────────────────────
// Divides the canvas into fixed-size cells. Enemies register themselves each
// frame; projectiles query only the cells they overlap, cutting collision work
// from O(projectiles × enemies) to roughly O(projectiles × local_density).

class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells    = new Map(); // key = "cx,cy" → Enemy[]
  }

  _key(cx, cy) { return (cx << 16) | (cy & 0xffff); }

  clear() { this.cells.clear(); }

  insert(e) {
    const cs  = this.cellSize;
    const cx  = Math.floor(e.x / cs);
    const cy  = Math.floor(e.y / cs);
    const key = this._key(cx, cy);
    let   arr = this.cells.get(key);
    if (!arr) { arr = []; this.cells.set(key, arr); }
    arr.push(e);
  }

  // Return all enemies in cells overlapping the circle (x,y,r)
  query(x, y, r) {
    const cs      = this.cellSize;
    const minCx   = Math.floor((x - r) / cs);
    const maxCx   = Math.floor((x + r) / cs);
    const minCy   = Math.floor((y - r) / cs);
    const maxCy   = Math.floor((y + r) / cs);
    const results = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.cells.get(this._key(cx, cy));
        if (arr) for (const e of arr) results.push(e);
      }
    }
    return results;
  }
}

// Module-level grid; rebuilt every update call from the current enemy pool.
const _grid = new SpatialGrid(64);

export class Projectile {
  constructor() {
    this.active          = false;
    this.x               = 0;
    this.y               = 0;
    this.vx              = 0;
    this.vy              = 0;
    this.damage          = 0;
    this.explosiveRadius = 0;   // 0 = no splash
    this.chainJumps      = 0;   // 0 = no chain
    this.chainDamage     = 0;   // damage for chain (set on fire)
  }

  init(x, y, vx, vy, damage, explosiveRadius = 0, chainJumps = 0) {
    this.active          = true;
    this.x               = x;
    this.y               = y;
    this.vx              = vx;
    this.vy              = vy;
    this.damage          = damage;
    this.explosiveRadius = explosiveRadius;
    this.chainJumps      = chainJumps;
    this.chainDamage     = damage * 0.6;
  }

  update(dt, game, bounds) {
    if (!this.active) return;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Deactivate if off-screen
    if (this.x < -20 || this.x > bounds.w + 20 ||
        this.y < -20 || this.y > bounds.h + 20) {
      this.active = false;
      return;
    }

    // Collision vs enemies — query grid instead of full pool scan
    const QUERY_R = 32; // slightly larger than max enemy radius (28)
    for (const e of _grid.query(this.x, this.y, QUERY_R)) {
      if (!e.active) continue;
      const dx = this.x - e.x;
      const dy = this.y - e.y;
      if (dx * dx + dy * dy <= e.radius * e.radius) {
        this._onHit(e, game);
        return;
      }
    }
  }

  _onHit(target, game) {
    this.active = false;

    // Particle hit sparks (skip on low quality)
    if (game.particles && game.quality !== 'low') {
      game.particles.emitHit(this.x, this.y, target.color);
    }

    // Direct hit
    _damageEnemy(target, this.damage, game);

    // Explosive splash
    if (this.explosiveRadius > 0) {
      const r2 = this.explosiveRadius * this.explosiveRadius;
      for (const e of game.enemyPool.pool) {
        if (!e.active || e === target) continue;
        const dx = this.x - e.x;
        const dy = this.y - e.y;
        if (dx * dx + dy * dy <= r2) {
          _damageEnemy(e, this.damage * 0.6, game);
        }
      }
      // Register explosion flash for renderer — extended lifetime + shrapnel
      game.explosions.push({ x: this.x, y: this.y, r: this.explosiveRadius, t: 0.45 });
      audio.fireExplosive();
      // Shrapnel burst: full on high, skip on medium/low
      if (game.particles && game.quality === 'high') {
        const count = 18;
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
          const speed = 90 + Math.random() * 160;
          game.particles._emit(
            this.x, this.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            0.35 + Math.random() * 0.2,
            2.5 + Math.random() * 2,
            Math.random() < 0.5 ? '#ff9100' : '#ffffff',
          );
        }
      }
    }

    // Chain lightning
    if (this.chainJumps > 0) {
      _chainFrom(this.x, this.y, target, this.chainDamage, this.chainJumps, game);
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _damageEnemy(e, dmg, game) {
  e.hp -= dmg;
  if (e.hp <= 0) {
    const earned = Math.floor(e.reward * game.currencyMultiplier);
    game.currency   += earned;
    game.waveEarned += earned;
    game.logEarned(earned);
    _spawnCurrencyPopup(earned, game, e.x, e.y);
    // Death burst particles + expanding ring
    if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
    game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
    // Death sound — sized by enemy type
    if      (e.type === 'BOSS')              audio.deathBoss();
    else if (e.type === 'BRUTE')             audio.deathLarge();
    else if (e.type === 'ELITE')             audio.deathMedium();
    else                                     audio.deathSmall();
    // Boss arrival / death edge flash
    if (e.type === 'BOSS') game.edgeFlash = 0.5;
    e.active = false;
  }
}

function _spawnCurrencyPopup(amount, game, x, y) {
  game.currencyPopups.push({ amount, x, y, t: 0.9 });
}

function _chainFrom(x, y, lastHit, damage, jumpsLeft, game) {
  const CHAIN_RANGE = 220;
  const r2 = CHAIN_RANGE * CHAIN_RANGE;

  // Find nearest active enemy not already hit in this chain
  let best = null, bestD2 = Infinity;
  for (const e of game.enemyPool.pool) {
    if (!e.active || e === lastHit) continue;
    const dx = x - e.x, dy = y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < r2 && d2 < bestD2) { best = e; bestD2 = d2; }
  }

  if (!best) return;

  // Register arc for renderer
  game.lightningArcs.push({ x1: x, y1: y, x2: best.x, y2: best.y, t: 0.35 });
  audio.fireChain();

  // Spark burst at the chain impact point (skip on low quality)
  if (game.particles && game.quality !== 'low') game.particles.emitHit(best.x, best.y, '#e040fb');

  _damageEnemy(best, damage, game);

  if (jumpsLeft > 1) {
    _chainFrom(best.x, best.y, best, damage * 0.6, jumpsLeft - 1, game);
  }
}

// ── pool ─────────────────────────────────────────────────────────────────────

export class ProjectilePool {
  constructor(size) {
    this.pool    = Array.from({ length: size }, () => new Projectile());
    this._bounds = { w: 800, h: 600 };
  }

  acquire() {
    return this.pool.find(p => !p.active) ?? null;
  }

  fire(x, y, vx, vy, damage, explosiveRadius = 0, chainJumps = 0) {
    const p = this.acquire();
    if (p) p.init(x, y, vx, vy, damage, explosiveRadius, chainJumps);
    return p;
  }

  update(dt, game) {
    // Rebuild spatial grid once for the entire frame
    _grid.clear();
    for (const e of game.enemyPool.pool) {
      if (e.active) _grid.insert(e);
    }

    for (const p of this.pool) {
      if (p.active) p.update(dt, game, this._bounds);
    }
  }

  activeCount() {
    return this.pool.filter(p => p.active).length;
  }

  reset() {
    for (const p of this.pool) p.active = false;
  }
}
