export const EnemyType = Object.freeze({
  DRONE:    'DRONE',
  SWARM:    'SWARM',
  BRUTE:    'BRUTE',
  ELITE:    'ELITE',
  BOSS:     'BOSS',
  DASHER:   'DASHER',
  BOMBER:   'BOMBER',
  SPAWNER:  'SPAWNER',
  PHANTOM:  'PHANTOM',
  COLOSSUS: 'COLOSSUS',
});

export class Enemy {
  constructor() {
    this.active       = false;
    this.x            = 0;
    this.y            = 0;
    this.hp           = 0;
    this.maxHp        = 0;
    this.speed        = 0;
    this.radius       = 0;
    this.color        = '#fff';
    this.shape        = 'circle';
    this.reward       = 0;
    this.type         = EnemyType.DRONE;
    this.atTower      = false;
    this.damageTick   = 0;
    this.damage       = 0;

    // Dasher state
    this.dashTimer    = 0;   // counts down: positive = dashing, negative = paused
    this.dashPause    = 0;   // pause duration after a dash

    // Spawner state
    this.spawnTimer   = 0;   // time until next spawn

    // Phantom state
    this.phantomTimer = 0;   // counts down intangible window; negative = solid
    this.intangible   = false;

    // Colossus armor state
    this.armorHits    = 0;   // hits absorbed (one per weapon type per wave reset)
    this.armorProjectile = false;  // already absorbed a projectile hit
    this.armorRing       = false;  // already absorbed a ring tick
    this.armorLaser      = false;  // already absorbed a laser tick

    // Boss enrage state
    this.enraged      = false;

    // Poison DoT state
    this.poisonDps      = 0;   // damage per second from poison
    this.poisonTimer    = 0;   // seconds of poison remaining
    this.poisonTickTimer = 0;  // countdown to next 0.1s tick
  }

  init(type, wave, x, y) {
    const def = BASE_STATS[type];
    const hpScale    = type === EnemyType.COLOSSUS
      ? Math.pow(1.06, wave - 1)
      : Math.pow(1.07, wave - 1);

    this.active      = true;
    this.atTower     = false;
    this.damageTick  = 0;
    this.damage      = def.damage;
    this.type        = type;
    this.x           = x;
    this.y           = y;
    this.maxHp       = Math.floor(def.hp * hpScale);
    this.hp          = this.maxHp;
    this.speed       = def.speed;
    this.baseSpeed   = def.speed;
    this.radius      = def.radius;
    this.color       = def.color;
    this.shape       = def.shape;
    this.reward      = Math.floor(def.reward * (1 + 0.02 * wave));

    // Status effects
    this.slowUntil   = 0;
    this.slowFactor  = 1.0;
    this.stunUntil   = 0;

    // Type-specific state
    this.dashTimer   = 0;
    this.spawnTimer  = 1.0; // first spawn after 1s
    this.phantomTimer = 0;
    this.intangible  = false;
    this.enraged     = false;
    this.armorProjectile = false;
    this.armorRing       = false;
    this.armorLaser      = false;
    this.poisonDps       = 0;
    this.poisonTimer     = 0;
    this.poisonTickTimer = 0;
  }

  update(dt, game) {
    if (!this.active) return;

    const now = game.elapsed ?? 0;
    const tx  = game.tower.x;
    const ty  = game.tower.y;
    const dx  = tx - this.x;
    const dy  = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ── Tower contact ────────────────────────────────────────────────────────
    if (dist < game.tower.radius + this.radius) {
      if (!this.atTower) {
        this.atTower    = true;
        this.damageTick = 0;

        // Bomber: detonate on arrival — damages the tower
        if (this.type === EnemyType.BOMBER) {
          _bomberDetonate(this, game, true);
          return;
        }
      }

      this.damageTick -= dt;
      if (this.damageTick <= 0) {
        game.tower.takeDamage(this.damage, game);
        this.damageTick = 1;
      }
      return;
    }

    this.atTower = false;

    // ── Boss enrage (below 40% HP) ───────────────────────────────────────────
    if (this.type === EnemyType.BOSS && !this.enraged && this.hp / this.maxHp < 0.40) {
      this.enraged   = true;
      this.baseSpeed = this.baseSpeed * 1.6;
    }

    // ── Phantom intangibility cycle ──────────────────────────────────────────
    if (this.type === EnemyType.PHANTOM) {
      this.phantomTimer -= dt;
      if (this.phantomTimer <= 0) {
        if (this.intangible) {
          // End intangible window — go solid for 2s
          this.intangible   = false;
          this.phantomTimer = 2.0;
        } else {
          // Go intangible for 1s
          this.intangible   = true;
          this.phantomTimer = 1.0;
        }
      }
    }

    // ── Spawner: emit a basic enemy every second ─────────────────────────────
    if (this.type === EnemyType.SPAWNER) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 1.0;
        const spawnType = Math.random() < 0.5 ? EnemyType.DRONE : EnemyType.SWARM;
        game.enemyPool.spawn(spawnType, Math.max(1, game.wave - 2), this.x, this.y, game);
      }
    }

    // ── Movement ─────────────────────────────────────────────────────────────
    if (now < this.stunUntil) return;

    if (this.type === EnemyType.DASHER) {
      this._updateDasher(dt, dx, dy, dist);
    } else {
      const spd = now < this.slowUntil ? this.baseSpeed * this.slowFactor : this.baseSpeed;
      this.x += (dx / dist) * spd * dt;
      this.y += (dy / dist) * spd * dt;
    }
  }

  _updateDasher(dt, dx, dy, dist) {
    if (this.dashTimer > 0) {
      // Currently dashing — move at 3× speed
      const spd = this.baseSpeed * 3;
      this.x += (dx / dist) * spd * dt;
      this.y += (dy / dist) * spd * dt;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        // End of dash — pause briefly
        this.dashTimer = -(0.3 + Math.random() * 0.2);
      }
    } else {
      // Pausing between dashes
      this.dashTimer += dt;
      if (this.dashTimer >= 0) {
        // Start next dash (0.8s)
        this.dashTimer = 0.8;
      }
    }
  }
}

// Called when a bomber reaches the tower or is killed (death detonation handled
// in _damageEnemy in projectile.js / tower.js kill paths).
export function _bomberDetonate(bomber, game, damagesTower = false) {
  const BLAST_R   = 80;
  const BLAST_DMG = bomber.damage * 3;
  // Tower damage only when the bomber physically reaches the tower
  if (damagesTower) game.tower.takeDamage(BLAST_DMG, game);
  // Splash onto nearby enemies
  const r2 = BLAST_R * BLAST_R;
  for (const e of game.enemyPool.pool) {
    if (!e.active || e === bomber) continue;
    const ddx = e.x - bomber.x;
    const ddy = e.y - bomber.y;
    if (ddx * ddx + ddy * ddy <= r2) e.hp -= BLAST_DMG * 0.5;
  }
  game.explosions.push({ x: bomber.x, y: bomber.y, r: BLAST_R, t: 0.55, life: 0.55 });
  bomber.active = false;
}

export class EnemyPool {
  constructor(size) {
    this.pool = Array.from({ length: size }, () => new Enemy());
  }

  acquire() {
    return this.pool.find(e => !e.active) ?? null;
  }

  spawn(type, wave, x, y, game = null) {
    const e = this.acquire();
    if (e) {
      e.init(type, wave, x, y);
      // VANGUARD A1: Advance Guard — +2% speed and +2% damage per wave cleared (stacks within run)
      if (game && game.vanguardAdvanceGuard && game.vanguardSpeedBonus > 0) {
        const mult = 1 + game.vanguardSpeedBonus;
        e.speed     *= mult;
        e.baseSpeed *= mult;
        e.damage    *= mult;
      }
    }
    return e;
  }

  update(dt, game) {
    for (const e of this.pool) {
      if (e.active) e.update(dt, game);
    }
  }

  activeCount() {
    return this.pool.filter(e => e.active).length;
  }

  reset() {
    for (const e of this.pool) e.active = false;
  }
}

const BASE_STATS = {
  [EnemyType.DRONE]:    { hp: 60,   speed: 156, radius: 11, color: '#00e5ff', shape: 'circle',   reward: 12,  damage: 15  },
  [EnemyType.SWARM]:    { hp: 20,   speed: 120, radius: 8,  color: '#69ff47', shape: 'circle',   reward: 4,   damage: 5   },
  [EnemyType.BRUTE]:    { hp: 300,  speed: 78,  radius: 16, color: '#ff9100', shape: 'square',   reward: 50,  damage: 50  },
  [EnemyType.ELITE]:    { hp: 150,  speed: 129, radius: 11, color: '#ea00ff', shape: 'triangle', reward: 30,  damage: 30  },
  [EnemyType.BOSS]:     { hp: 5000, speed: 80,  radius: 28, color: '#ff1744', shape: 'hexagon',  reward: 300, damage: 250 },
  // New types
  [EnemyType.DASHER]:   { hp: 45,   speed: 164, radius: 9,  color: '#00e676', shape: 'circle',   reward: 18,  damage: 20  },
  [EnemyType.BOMBER]:   { hp: 120,  speed: 112, radius: 13, color: '#ff6d00', shape: 'circle',   reward: 35,  damage: 60  },
  [EnemyType.SPAWNER]:  { hp: 500,  speed: 38,  radius: 18, color: '#ffd600', shape: 'square',   reward: 80,  damage: 20  },
  [EnemyType.PHANTOM]:  { hp: 130,  speed: 138, radius: 11, color: '#b388ff', shape: 'triangle', reward: 28,  damage: 25  },
  [EnemyType.COLOSSUS]: { hp: 1200, speed: 48,  radius: 24, color: '#ff4081', shape: 'hexagon',  reward: 200, damage: 100 },
};

// Returns the scaled max-HP of a Drone at a given wave — used as the overkill baseline.
export function droneHp(wave) {
  return Math.floor(BASE_STATS[EnemyType.DRONE].hp * Math.pow(1.07, wave - 1));
}

// Returns the scaled max-HP of a Boss at a given wave — used by Tidal Convergence.
export function bossWaveHp(wave) {
  return Math.floor(BASE_STATS[EnemyType.BOSS].hp * Math.pow(1.07, wave - 1));
}
