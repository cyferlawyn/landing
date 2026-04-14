// Particle system — pooled, fixed-size, oldest-first eviction
// Each particle is a simple spark: position, velocity, color, lifetime.

class Particle {
  constructor() {
    this.active   = false;
    this.x        = 0;
    this.y        = 0;
    this.vx       = 0;
    this.vy       = 0;
    this.life     = 0;   // remaining lifetime (seconds)
    this.maxLife  = 0;
    this.radius   = 0;
    this.color    = '#fff';
  }

  init(x, y, vx, vy, life, radius, color) {
    this.active  = true;
    this.x       = x;
    this.y       = y;
    this.vx      = vx;
    this.vy      = vy;
    this.life    = life;
    this.maxLife = life;
    this.radius  = radius;
    this.color   = color;
  }

  update(dt) {
    if (!this.active) return;
    this.x    += this.vx * dt;
    this.y    += this.vy * dt;
    this.vx   *= 0.88; // friction
    this.vy   *= 0.88;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

export class ParticleSystem {
  constructor(max) {
    this.pool   = Array.from({ length: max }, () => new Particle());
    this.cursor = 0; // oldest-first eviction pointer
  }

  _acquire() {
    // Find an inactive slot first
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    // Pool full — evict oldest (cursor)
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return p;
  }

  _emit(x, y, vx, vy, life, radius, color) {
    this._acquire().init(x, y, vx, vy, life, radius, color);
  }

  // ── emitters ────────────────────────────────────────────────────────────────

  emitProjectileTrail(x, y, nx, ny) {
    // One spark per call — offset slightly behind the projectile and given a small
    // perpendicular wobble so the trail fans out rather than drawing a solid line.
    const perp   = (Math.random() - 0.5) * 30; // perpendicular drift speed
    const speed  = 20 + Math.random() * 30;
    const color  = Math.random() < 0.6 ? '#00e5ff' : '#ffffff';
    this._emit(
      x - nx * 4 + (-ny) * (perp * 0.05),  // start just behind the dot
      y - ny * 4 + ( nx) * (perp * 0.05),
      -nx * speed + (-ny) * perp,           // drift backward + sideways wobble
       -ny * speed + ( nx) * perp,
      0.08 + Math.random() * 0.08,          // very short lived
      1.0 + Math.random() * 0.8,
      color,
    );
  }

  emitHit(x, y, color) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      this._emit(x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.25 + Math.random() * 0.15,
        1.5 + Math.random() * 1.5,
        color
      );
    }
  }

  emitDeath(x, y, color) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
      const speed = 80 + Math.random() * 120;
      this._emit(x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.4 + Math.random() * 0.25,
        2 + Math.random() * 2,
        color
      );
    }
  }

  emitTowerHit(x, y) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      this._emit(x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.3 + Math.random() * 0.2,
        2 + Math.random() * 2,
        '#ff1744'
      );
    }
  }

  // ── update & draw ────────────────────────────────────────────────────────────

  update(dt) {
    for (const p of this.pool) {
      if (p.active) p.update(dt);
    }
  }

  draw(ctx, quality = 'high') {
    for (const p of this.pool) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.shadowBlur   = quality === 'high' ? 6 : 0;
      ctx.shadowColor  = p.color;
      ctx.fillStyle    = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  reset() {
    for (const p of this.pool) p.active = false;
  }
}
