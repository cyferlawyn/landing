import { audio } from './audio.js';
import { EnemyType, _bomberDetonate, droneHp } from './enemy.js';
import { normalizedShotDamage } from './tower.js';

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
    this.active           = false;
    this.x                = 0;
    this.y                = 0;
    this.vx               = 0;
    this.vy               = 0;
    this.damage           = 0;
    this.explosiveRadius  = 0;   // 0 = no splash
    this.chainJumps       = 0;   // 0 = no chain
    this.chainDamage      = 0;   // damage for chain (set on fire)
    this.executeThreshold = 0;   // 0 = no execute
    this.ricochetCount    = 0;   // remaining bounces
    this.overcharge       = false; // true = ×4 overcharge shot, distinct visual
  }

  init(x, y, vx, vy, damage, explosiveRadius = 0, chainJumps = 0, executeThreshold = 0, ricochetCount = 0, overcharge = false) {
    this.active           = true;
    this.x                = x;
    this.y                = y;
    this.vx               = vx;
    this.vy               = vy;
    this.damage           = damage;
    this.explosiveRadius  = explosiveRadius;
    this.chainJumps       = chainJumps;
    this.chainDamage      = damage * 0.6;
    this.executeThreshold = executeThreshold;
    this.ricochetCount    = ricochetCount;
    this.overcharge       = overcharge;
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
    const QUERY_R = 32;
    for (const e of _grid.query(this.x, this.y, QUERY_R)) {
      if (!e.active) continue;
      // Phantom: projectiles pass through while intangible
      if (e.intangible) continue;
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
    _damageEnemy(target, this.damage, game, this.executeThreshold, 'projectile');

    // Explosive splash
    if (this.explosiveRadius > 0) {
      const r2 = this.explosiveRadius * this.explosiveRadius;
      for (const e of game.enemyPool.pool) {
        if (!e.active || e === target) continue;
        const dx = this.x - e.x;
        const dy = this.y - e.y;
        if (dx * dx + dy * dy <= r2) {
          _damageEnemy(e, this.damage * game.tower.splashMult, game, 0, 'projectile');
        }
      }
      // Register explosion flash for renderer — extended lifetime + shrapnel
      game.explosions.push({ x: this.x, y: this.y, r: this.explosiveRadius, t: 0.45, life: 0.45 });
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

    // Ricochet — instant hit like chain lightning, gold tracer visual
    if (this.ricochetCount > 0) {
      _ricochetFrom(this.x, this.y, target, this.damage * 0.75, this.ricochetCount,
        this.explosiveRadius, this.chainJumps, this.executeThreshold, game);
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function _damageEnemy(e, dmg, game, executeThreshold = 0, source = 'projectile') {
  // Colossus armor: absorb the first hit from each weapon source per wave
  if (e.type === EnemyType.COLOSSUS) {
    if (source === 'projectile' && !e.armorProjectile) { e.armorProjectile = true; return; }
    if (source === 'ring'       && !e.armorRing)       { e.armorRing       = true; return; }
    if (source === 'laser'      && !e.armorLaser)      { e.armorLaser      = true; return; }
  }

  e.hp -= dmg;

  // Obliterate — trigger when normalized shot damage is 10× a drone's HP at this wave
  if (source === 'projectile' && game.tower.obliterateDelay > 0 &&
      game.obliterateTimer < 0) {
    const baseline = droneHp(game.wave);
    const normShot = normalizedShotDamage(game.tower, game);
    if (normShot >= baseline * 10) {
      game.obliterateTimer    = game.tower.obliterateDelay;
      game.obliterateOverkill = Math.floor(normShot / baseline);
    }
  }

  // Poison DoT — stacks additively per hit, duration refreshes each time
  if (source === 'projectile' && game.tower.poisonFraction > 0) {
    const dotDmg  = dmg * game.tower.poisonFraction;
    e.poisonDps  += dotDmg / 3.0;  // stack on top of existing DoT
    e.poisonTimer = 3.0;            // refresh duration
    if (e.poisonTickTimer <= 0) e.poisonTickTimer = 0.1; // ensure next tick fires promptly
  }

  if (e.hp <= 0 || (executeThreshold > 0 && e.hp / e.maxHp < executeThreshold)) {
    const wasExecuted = executeThreshold > 0 && e.hp > 0 && e.hp / e.maxHp < executeThreshold;
    e.hp = 0;

    if (wasExecuted) {
      game.skullPopups.push({ x: e.x, y: e.y - e.radius - 8, t: 1.0 });
    }

    // Bomber detonates on death
    if (e.type === EnemyType.BOMBER) {
      _bomberDetonate(e, game);
      // _bomberDetonate sets e.active = false and pushes explosion — skip normal death
      _awardKill(e, game);
      return;
    }

    _awardKill(e, game);
    e.active = false;
  }
}

function _awardKill(e, game) {
  const earned = Math.floor(e.reward * game.currencyMultiplier * game.factionCurrencyMult());
  game.currency   += earned;
  game.waveEarned += earned;
  game.waveKills  += 1;
  game.logEarned(earned);
  _spawnCurrencyPopup(earned, game, e.x, e.y);
  // Leech: restore HP on kill
  if (game.tower.leechHp > 0) {
    game.tower.hp = Math.min(game.tower.maxHp, game.tower.hp + game.tower.leechHp);
  }
  // Traitor capture roll
  const pet = game.traitorSystem?.tryCapture(e, game.wave, game);
  if (pet) {
    game.pendingTraitorAnnouncements.push(pet);
    game.traitorSystem.optimizeForNexus(game);
  }
  if (game.particles && game.quality !== 'low') game.particles.emitDeath(e.x, e.y, e.color);
  game.deathRings.push({ x: e.x, y: e.y, r: e.radius * 2.5, t: 0.35, color: e.color });
  if      (e.type === EnemyType.BOSS)     { audio.deathBoss();   game.edgeFlash = 0.5; game.awardShards(game.wave); }
  else if (e.type === EnemyType.COLOSSUS) { audio.deathBoss(); _releaseColossusSpawn(e, game); }
  else if (e.type === EnemyType.BRUTE || e.type === EnemyType.SPAWNER) audio.deathLarge();
  else if (e.type === EnemyType.ELITE || e.type === EnemyType.PHANTOM) audio.deathMedium();
  else                                                                   audio.deathSmall();
}

function _releaseColossusSpawn(colossus, game) {
  // Spawn 3 drones at the colossus position
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i;
    const ox = colossus.x + Math.cos(angle) * 20;
    const oy = colossus.y + Math.sin(angle) * 20;
    game.enemyPool.spawn(EnemyType.DRONE, Math.max(1, game.wave - 1), ox, oy);
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

  _damageEnemy(best, damage, game, 0, 'projectile');

  if (jumpsLeft > 1) {
    _chainFrom(best.x, best.y, best, damage * 0.6, jumpsLeft - 1, game);
  }
}

function _ricochetFrom(x, y, lastHit, damage, bouncesLeft, explosiveRadius, chainJumps, executeThreshold, game) {
  const RICOCHET_RANGE = 300;
  const r2 = RICOCHET_RANGE * RICOCHET_RANGE;

  let best = null, bestD2 = Infinity;
  for (const e of game.enemyPool.pool) {
    if (!e.active || e === lastHit) continue;
    const dx = x - e.x, dy = y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < r2 && d2 < bestD2) { best = e; bestD2 = d2; }
  }
  if (!best) return;

  // Straight fading tracer — distinct from chain lightning arcs
  game.ricochetLines.push({ x1: x, y1: y, x2: best.x, y2: best.y, t: 0.18, life: 0.18 });
  if (game.particles && game.quality !== 'low') game.particles.emitHit(best.x, best.y, '#ffd740');

  _damageEnemy(best, damage, game, executeThreshold, 'projectile');

  // Explosive splash on ricochet hit
  if (explosiveRadius > 0) {
    const er2 = explosiveRadius * explosiveRadius;
    for (const e of game.enemyPool.pool) {
      if (!e.active || e === best) continue;
      const dx = best.x - e.x, dy = best.y - e.y;
      if (dx * dx + dy * dy <= er2) {
        _damageEnemy(e, damage * game.tower.splashMult, game, 0, 'projectile');
      }
    }
    game.explosions.push({ x: best.x, y: best.y, r: explosiveRadius, t: 0.35, life: 0.35 });
  }

  // Chain lightning on ricochet hit
  if (chainJumps > 0) {
    _chainFrom(best.x, best.y, best, damage * 0.6, chainJumps, game);
  }

  // Further bounces
  if (bouncesLeft > 1) {
    _ricochetFrom(best.x, best.y, best, damage * 0.75, bouncesLeft - 1, explosiveRadius, chainJumps, executeThreshold, game);
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

  fire(x, y, vx, vy, damage, explosiveRadius = 0, chainJumps = 0, executeThreshold = 0, ricochetCount = 0, overcharge = false) {
    const p = this.acquire();
    if (p) p.init(x, y, vx, vy, damage, explosiveRadius, chainJumps, executeThreshold, ricochetCount, overcharge);
    return p;
  }

  update(dt, game) {
    // Rebuild spatial grid once for the entire frame
    _grid.clear();
    for (const e of game.enemyPool.pool) {
      if (e.active) _grid.insert(e);
    }

    // Tick poison DoT on all active enemies — fires every 0.1s
    if (game.tower.poisonFraction > 0) {
      for (const e of game.enemyPool.pool) {
        if (!e.active || e.poisonTimer <= 0) continue;
        e.poisonTimer    -= dt;
        e.poisonTickTimer -= dt;
        if (e.poisonTickTimer <= 0) {
          e.poisonTickTimer += 0.1;
          const dot = e.poisonDps * 0.1;
          _damageEnemy(e, dot, game, 0, 'poison');
        }
      }
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

// Kill a single enemy and award full rewards — used by blastwave contact kills.
export function killEnemy(e, game) {
  if (!e.active) return;
  e.hp          = 0;
  e.active      = false;
  e.poisonDps   = 0;
  e.poisonTimer = 0;
  _awardKill(e, game);
}

// Kill every active enemy in the pool and award full kill rewards.
// Called as cleanup when the blastwave finishes expanding.
export function obliterateWave(game) {
  for (const e of game.enemyPool.pool) killEnemy(e, game);
}
