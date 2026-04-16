import { State } from './game.js';

const COLORS = {
  bg:        '#0a0a12',
  grid:      'rgba(255,255,255,0.04)',
  towerFill: '#1a1a2e',
  towerGlow: '#00e5ff',
  hpBar:     '#00e5ff',
  hpBarBg:   '#1a1a2e',
  currency:  '#ffd600',
  text:      '#e0e0e0',
  dim:       'rgba(0,0,0,0.55)',
  laser:     '#ff4081',
  explosion: '#ff9100',
  chain:     '#e040fb',
};

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.game   = game;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const W = Math.min(Math.max(this.canvas.offsetWidth,  400), 1600);
    const H = Math.min(Math.max(this.canvas.offsetHeight, 300),  900);
    this.canvas.width  = W;
    this.canvas.height = H;
    if (this.game.tower) {
      this.game.tower.x = W / 2;
      this.game.tower.y = H / 2;
    }
    if (this.game.projectilePool) {
      this.game.projectilePool._bounds = { w: W, h: H };
    }
  }

  render() {
    const { ctx, canvas, game } = this;

    if (game.tower) {
      game.tower.x = canvas.width  / 2;
      game.tower.y = canvas.height / 2;
    }
    if (game.projectilePool) {
      game.projectilePool._bounds = { w: canvas.width, h: canvas.height };
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._drawBackground();
    this._drawExplosions();
    this._drawDeathRings();
    this._drawEnemies();
    this._drawProjectiles();
    this._drawLightningArcs();
    this._drawLaser();
    this._drawTower();
    if (game.particles) game.particles.draw(ctx, game.quality);
    this._drawEdgeFlash();
    this._drawHUD();
    this._drawStateOverlay();
  }

  // ── background ───────────────────────────────────────────────────────────────

  _drawBackground() {
    const { ctx, canvas } = this;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const step = 40;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += step) {
      ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
  }

  // ── tower ─────────────────────────────────────────────────────────────────────

  _drawTower() {
    const { ctx, game } = this;
    const t = game.tower;
    if (!t) return;

    const cx = t.x, cy = t.y, r = t.radius;

    let glowColor = COLORS.towerGlow;
    if (t.hitFlash > 0) {
      glowColor = '#ff1744';
    } else if (t.laserUnlocked && !t.laserActive && t.laserCooldown < 1.5) {
      glowColor = COLORS.laser;
    } else if (t.laserUnlocked && t.laserActive) {
      glowColor = COLORS.laser;
    }

    // Orbital Death Ring (drawn behind tower hex)
    if (t.ringTier > 0) {
      const arcDeg  = t.ringTier === 1 ? 30 : t.ringTier === 2 ? 45 : t.ringTier === 3 ? 45 : t.ringTier === 4 ? 60 : 75;
      const arcRad  = arcDeg * (Math.PI / 180);
      const orbitR  = r + 16;
      const rings   = t.ringTier >= 3
        ? [{ angle: t.ringAngle, ccw: false }, { angle: t.ringAngle2, ccw: true }]
        : [{ angle: t.ringAngle, ccw: false }];

      const coreWidth  = 2 + t.ringTier * 1.2;
      const glowWidth  = coreWidth * 3;
      const bloomWidth = coreWidth * 7;
      const glowBlur   = 16 + t.ringTier * 8;

      for (const ring of rings) {
        const startA = ring.angle - arcRad / 2;
        const endA   = ring.angle + arcRad / 2;
        const leadA  = ring.ccw ? startA : endA;

        ctx.save();

        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#ff6d00';
        ctx.shadowBlur  = 0;
        ctx.lineWidth   = bloomWidth;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, orbitR, startA, endA);
        ctx.stroke();

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#ff6d00';
        ctx.shadowBlur  = glowBlur;
        ctx.shadowColor = '#ff6d00';
        ctx.lineWidth   = glowWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, orbitR, startA, endA);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#ff6d00';
        ctx.lineWidth   = coreWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, orbitR, startA, endA);
        ctx.stroke();

        const tipX = cx + Math.cos(leadA) * orbitR;
        const tipY = cy + Math.sin(leadA) * orbitR;
        ctx.globalAlpha = 1;
        ctx.fillStyle   = '#ffffff';
        ctx.shadowBlur  = glowBlur;
        ctx.shadowColor = '#ff6d00';
        ctx.beginPath();
        ctx.arc(tipX, tipY, coreWidth * 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (game.quality === 'high' && game.particles && Math.random() < 0.4) {
          game.particles._emit(
            tipX, tipY,
            (Math.random() - 0.5) * 60,
            (Math.random() - 0.5) * 60,
            0.15 + Math.random() * 0.1,
            1.5 + Math.random() * 1.5,
            Math.random() < 0.5 ? '#ff6d00' : '#ffffff',
          );
        }

        ctx.restore();
      }
    }

    // Tower hex
    ctx.save();
    ctx.shadowBlur  = t.hitFlash > 0 ? 32 : 24;
    ctx.shadowColor = glowColor;
    ctx.beginPath();
    this._hexPath(cx, cy, r);
    ctx.fillStyle   = COLORS.towerFill;
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth   = t.hitFlash > 0 ? 3 : 2;
    ctx.stroke();
    ctx.restore();

    const pulse = t.laserActive
      ? r * 0.25 + Math.sin(Date.now() / 60) * r * 0.08
      : r * 0.18 + Math.sin(Date.now() / 600) * r * 0.06;
    ctx.save();
    ctx.shadowBlur  = t.laserActive ? 20 : 10;
    ctx.shadowColor = glowColor;
    ctx.fillStyle   = glowColor;
    ctx.globalAlpha = t.laserActive ? 1 : 0.75 + Math.sin(Date.now() / 600) * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shield / invuln visuals
    if (t.invulnTimer > 0) {
      const invR   = r + 10;
      const alpha  = 0.5 + Math.sin(Date.now() / 80) * 0.35;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.strokeStyle = '#ffd600';
      ctx.shadowBlur  = 18;
      ctx.shadowColor = '#ffd600';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, invR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if ((t.shieldCharges ?? 0) > 0) {
      const pipR = r + 8;
      ctx.save();
      for (let i = 0; i < t.shieldCharges; i++) {
        const angle = (Math.PI * 2 / t.shieldChargesMax) * i - Math.PI / 2;
        const px = cx + pipR * Math.cos(angle);
        const py = cy + pipR * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle   = '#ffd600';
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#ffd600';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _hexPath(cx, cy, r) {
    const ctx = this.ctx;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // ── laser beam ───────────────────────────────────────────────────────────────

  _drawLaser() {
    const { ctx, game } = this;
    const t = game.tower;
    if (!t || !t.laserActive) return;

    const cx = t.x, cy = t.y;
    const a  = t.laserAngle;
    const ex = cx + Math.cos(a) * t.laserRange;
    const ey = cy + Math.sin(a) * t.laserRange;

    const flicker      = 0.85 + Math.random() * 0.3;
    const outerWidth   = (2 + t.laserTier * 1.5) * flicker;
    const innerWidth   = (1 + t.laserTier * 0.5) * flicker;
    const bloomWidth   = outerWidth * 4;
    const glowStrength = 12 + t.laserTier * 8;

    ctx.save();

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = COLORS.laser;
    ctx.shadowBlur  = 0;
    ctx.lineWidth   = bloomWidth;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = COLORS.laser;
    ctx.shadowBlur  = glowStrength;
    ctx.shadowColor = COLORS.laser;
    ctx.lineWidth   = outerWidth;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur  = 6;
    ctx.shadowColor = '#ffffff';
    ctx.lineWidth   = innerWidth;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    const tipR = (3 + t.laserTier * 1.5) * flicker;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle   = '#ffffff';
    ctx.shadowBlur  = glowStrength * 1.5;
    ctx.shadowColor = COLORS.laser;
    ctx.beginPath();
    ctx.arc(ex, ey, tipR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── death rings ──────────────────────────────────────────────────────────────

  _drawDeathRings() {
    const { ctx, game } = this;
    if (game.quality === 'low') { game.deathRings = []; return; }
    const DT = 1 / 60;
    game.deathRings = game.deathRings.filter(ring => {
      ring.t -= DT;
      if (ring.t <= 0) return false;
      const progress = 1 - ring.t / 0.35;
      const alpha    = (1 - progress) * 0.8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ring.color;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = ring.color;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return true;
    });
  }

  // ── screen-edge flash ─────────────────────────────────────────────────────────

  _drawEdgeFlash() {
    const { ctx, canvas, game } = this;
    if (!game.edgeFlash || game.edgeFlash <= 0) return;
    if (game.quality === 'low') { game.edgeFlash = 0; return; }
    game.edgeFlash -= 1 / 60;
    const alpha = Math.max(0, game.edgeFlash / 0.6) * 0.5;
    const grad  = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.3,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.85,
    );
    grad.addColorStop(0, 'rgba(255,23,68,0)');
    grad.addColorStop(1, `rgba(255,23,68,${alpha.toFixed(3)})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // ── explosion rings ──────────────────────────────────────────────────────────

  _drawExplosions() {
    const { ctx, game } = this;
    if (game.quality === 'low') { game.explosions = []; return; }
    const noGlow = game.quality === 'medium';
    game.explosions = game.explosions.filter(ex => {
      ex.t -= 1 / 60;
      if (ex.t <= 0) return false;

      const life     = Math.min(1, ex.t / ex.life);
      const progress = Math.max(0, 1 - life);

      const flashR = ex.r * 0.55 * Math.pow(1 - Math.min(progress / 0.25, 1), 0.5);
      if (flashR > 0) {
        ctx.save();
        ctx.globalAlpha = life * 0.6;
        ctx.fillStyle   = '#ffffff';
        ctx.shadowBlur  = noGlow ? 0 : 24;
        ctx.shadowColor = COLORS.explosion;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, flashR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const innerProgress = Math.min(progress / 0.5, 1);
      ctx.save();
      ctx.globalAlpha = (1 - innerProgress) * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur  = noGlow ? 0 : 16;
      ctx.shadowColor = COLORS.explosion;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r * 0.6 * innerProgress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = life * 0.85;
      ctx.strokeStyle = COLORS.explosion;
      ctx.shadowBlur  = noGlow ? 0 : 18;
      ctx.shadowColor = COLORS.explosion;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = life * 0.25;
      ctx.lineWidth   = 8;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      return true;
    });
  }

  // ── lightning arcs ───────────────────────────────────────────────────────────

  _drawLightningArcs() {
    const { ctx, game } = this;
    if (game.quality === 'low') { game.lightningArcs = []; return; }
    const noGlow = game.quality === 'medium';
    game.lightningArcs = game.lightningArcs.filter(arc => {
      arc.t -= 1 / 60;
      if (arc.t <= 0) return false;

      const alpha = Math.min(1, arc.t / 0.12);

      const SEGS    = 6;
      const dx      = arc.x2 - arc.x1;
      const dy      = arc.y2 - arc.y1;
      const len     = Math.sqrt(dx * dx + dy * dy);
      const px      = -dy / len;
      const py      =  dx / len;
      const spread  = Math.min(len * 0.25, 28);

      const pts = [{ x: arc.x1, y: arc.y1 }];
      for (let i = 1; i < SEGS; i++) {
        const t      = i / SEGS;
        const bx     = arc.x1 + dx * t;
        const by     = arc.y1 + dy * t;
        const offset = (Math.random() - 0.5) * 2 * spread;
        pts.push({ x: bx + px * offset, y: by + py * offset });
      }
      pts.push({ x: arc.x2, y: arc.y2 });

      if (!noGlow) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        ctx.strokeStyle = COLORS.chain;
        ctx.shadowBlur  = 20;
        ctx.shadowColor = COLORS.chain;
        ctx.lineWidth   = 6;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = COLORS.chain;
      ctx.shadowBlur  = noGlow ? 0 : 10;
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur  = 0;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      ctx.restore();
      return true;
    });
  }

  // ── enemies ───────────────────────────────────────────────────────────────────

  _drawEnemies() {
    const { ctx, canvas, game } = this;
    if (!game.enemyPool) return;

    const buckets = new Map();
    for (const e of game.enemyPool.pool) {
      if (!e.active) continue;
      if (e.x < -50 || e.x > canvas.width + 50 ||
          e.y < -50 || e.y > canvas.height + 50) continue;
      const key    = e.shape + e.color;
      let   bucket = buckets.get(key);
      if (!bucket) { bucket = { color: e.color, shape: e.shape, arr: [] }; buckets.set(key, bucket); }
      bucket.arr.push(e);
    }

    for (const { color, shape, arr } of buckets.values()) {
      ctx.save();
      ctx.shadowBlur  = game.quality === 'high' ? 10 : 0;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.fillStyle   = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      for (const e of arr) {
        this._appendEnemyPath(e, shape);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const e of game.enemyPool.pool) {
      if (e.active) this._drawHpBar(e);
    }

    for (const e of game.enemyPool.pool) {
      if (!e.active) continue;
      if (e.intangible) this._drawPhantomGhost(e);
      if (e.type === 'BOMBER') this._drawBomberWarning(e);
      if (e.type === 'COLOSSUS') this._drawColossusArmor(e);
    }
  }

  _appendEnemyPath(e, shape) {
    switch (shape) {
      case 'circle': {
        this.ctx.moveTo(e.x + e.radius, e.y);
        this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        break;
      }
      case 'square': {
        const s = e.radius * 1.6;
        this.ctx.rect(e.x - s / 2, e.y - s / 2, s, s);
        break;
      }
      case 'triangle': {
        const r = e.radius * 1.3;
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
          const x = e.x + r * Math.cos(a);
          const y = e.y + r * Math.sin(a);
          i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;
      }
      case 'hexagon': {
        const r = e.radius * 1.2;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = e.x + r * Math.cos(a);
          const y = e.y + r * Math.sin(a);
          i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;
      }
    }
  }

  _drawPhantomGhost(e) {
    const ctx   = this.ctx;
    const pulse = 0.35 + Math.sin(Date.now() / 80) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#b388ff';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#b388ff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawBomberWarning(e) {
    const ctx  = this.ctx;
    const BLAST_R = 80;
    const tx   = this.game.tower.x;
    const ty   = this.game.tower.y;
    const dx   = tx - e.x, dy = ty - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const proximity = Math.max(0, 1 - dist / 300);
    const pulse = 0.5 + Math.sin(Date.now() / (120 - proximity * 80)) * 0.35;

    ctx.save();

    const auraAlpha = Math.max(0, Math.min(1, 0.04 + proximity * 0.08 + Math.sin(Date.now() / 200) * 0.02));
    ctx.globalAlpha = auraAlpha;
    ctx.fillStyle   = '#ff6d00';
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.arc(e.x, e.y, BLAST_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.18 + proximity * 0.22;
    ctx.strokeStyle = '#ff6d00';
    ctx.shadowBlur  = 10 + proximity * 10;
    ctx.shadowColor = '#ff6d00';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, BLAST_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = Math.max(0, Math.min(1, pulse * (0.4 + proximity * 0.6)));
    ctx.strokeStyle = '#ff6d00';
    ctx.shadowBlur  = 8 + proximity * 14;
    ctx.shadowColor = '#ff6d00';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 4 + Math.sin(Date.now() / 100) * 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawColossusArmor(e) {
    const ctx  = this.ctx;
    const sources = [
      { flag: e.armorProjectile, color: '#00e5ff' },
      { flag: e.armorRing,       color: '#ff6d00' },
      { flag: e.armorLaser,      color: '#ff4081' },
    ];
    ctx.save();
    const total = sources.length;
    for (let i = 0; i < total; i++) {
      const angle = (Math.PI * 2 / total) * i - Math.PI / 2;
      const px = e.x + Math.cos(angle) * (e.radius + 7);
      const py = e.y + Math.sin(angle) * (e.radius + 7);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle   = sources[i].flag ? 'rgba(255,255,255,0.1)' : sources[i].color;
      ctx.shadowBlur  = sources[i].flag ? 0 : 6;
      ctx.shadowColor = sources[i].color;
      ctx.fill();
    }
    ctx.restore();
  }

  _drawHpBar(e) {
    const ctx  = this.ctx;
    const w    = e.radius * 2.5;
    const h    = 3;
    const x    = e.x - w / 2;
    const y    = e.y - e.radius - 7;
    const pct  = Math.max(0, e.hp / e.maxHp);

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = e.color;
    ctx.fillRect(x, y, w * pct, h);
  }

  // ── projectiles ───────────────────────────────────────────────────────────────

  _drawProjectiles() {
    const { ctx, canvas, game } = this;
    if (!game.projectilePool) return;

    const quality = game.quality;

    for (const p of game.projectilePool.pool) {
      if (!p.active) continue;
      if (p.x < -20 || p.x > canvas.width + 20 ||
          p.y < -20 || p.y > canvas.height + 20) continue;

      if (quality === 'high' && game.particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0) {
          game.particles.emitProjectileTrail(p.x, p.y, p.vx / speed, p.vy / speed);
        }
      }

      if (quality === 'low') {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle   = '#00e5ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.shadowBlur  = 10;
        ctx.shadowColor = '#00e5ff';
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────

  _drawHUD() {
    const { ctx, canvas, game } = this;
    const t = game.tower;
    if (!t) return;

    ctx.font      = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Wave ${game.wave}`, 12, 22);

    const remaining = game.enemyPool ? game.enemyPool.activeCount() : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font      = '11px monospace';
    ctx.fillText(`enemies: ${remaining}`, 12, 38);

    const barW  = 200;
    const barH  = 12;
    const barX  = canvas.width / 2 - barW / 2;
    const barY  = 10;
    const hpPct = Math.max(0, t.hp / t.maxHp);

    ctx.fillStyle = COLORS.hpBarBg;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#00e676' : hpPct > 0.25 ? '#ffea00' : '#ff1744';
    ctx.fillRect(barX, barY, barW * hpPct, barH);
    ctx.strokeStyle = COLORS.hpBar;
    ctx.lineWidth   = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle   = COLORS.text;
    ctx.textAlign   = 'center';
    ctx.font        = '11px monospace';
    ctx.fillText(`${Math.ceil(t.hp)} / ${t.maxHp}`, canvas.width / 2, barY - 3);

    if (t.laserUnlocked && !t.laserActive) {
      const BURST_COOLDOWN = Math.max(4, 8 - t.laserTier);
      const pct = Math.max(0, 1 - t.laserCooldown / BURST_COOLDOWN);
      const indW = 80, indH = 4;
      const indX = canvas.width / 2 - indW / 2;
      const indY = barY + barH + 5;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(indX, indY, indW, indH);
      ctx.fillStyle = COLORS.laser;
      ctx.fillRect(indX, indY, indW * pct, indH);
      ctx.fillStyle = 'rgba(255,64,129,0.5)';
      ctx.font      = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LASER', canvas.width / 2, indY + indH + 8);
    }

    const fps      = game.fps ?? 60;
    const fpsColor = fps < 45 ? '#ff1744' : fps < 55 ? '#ffea00' : 'rgba(255,255,255,0.28)';
    ctx.textAlign  = 'right';
    ctx.fillStyle  = fpsColor;
    ctx.font       = '10px monospace';
    const fpsLabel = game.autoQuality
      ? `${fps} fps  AUTO:${game.quality.toUpperCase()}`
      : `${fps} fps`;
    ctx.fillText(fpsLabel, canvas.width - 12, 22);

    const DT = 1 / 60;
    game.currencyPopups = game.currencyPopups.filter(p => {
      p.t -= DT;
      if (p.t <= 0) return false;
      p.y -= 40 * DT;
      const alpha = Math.min(1, p.t / 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = COLORS.currency;
      ctx.shadowBlur  = game.quality === 'high' ? 6 : 0;
      ctx.shadowColor = COLORS.currency;
      ctx.font        = '11px monospace';
      ctx.textAlign   = 'center';
      ctx.fillText(`+$${p.amount}`, p.x, p.y);
      ctx.restore();
      return true;
    });
  }

  // ── state overlays ────────────────────────────────────────────────────────────

  _drawStateOverlay() {
    if (this.game.resultsTimer > 0) this._drawResults();
    if (this.game.state === State.DEFEATED) this._drawDefeated();
  }

  _drawResults() {
    const { ctx, canvas, game } = this;
    const alpha = Math.min(1, game.resultsTimer / 0.5);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00e676';
    ctx.font      = 'bold 28px monospace';
    ctx.fillText(`Wave ${game.lastWave} complete!`, canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = COLORS.currency;
    ctx.font      = '18px monospace';
    ctx.fillText(`+$ ${game.lastWaveEarned} earned`, canvas.width / 2, canvas.height / 2 + 14);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font      = '12px monospace';
    ctx.fillText('next wave incoming...', canvas.width / 2, canvas.height / 2 + 40);

    ctx.restore();
  }

  _drawDefeated() {
    const { ctx, canvas, game } = this;

    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff1744';
    ctx.font      = 'bold 32px monospace';
    ctx.fillText('TOWER DESTROYED', canvas.width / 2, canvas.height / 2 - 36);

    ctx.fillStyle = COLORS.text;
    ctx.font      = '18px monospace';
    ctx.fillText(`Fell on wave ${game.wave}`, canvas.width / 2, canvas.height / 2 + 2);

    ctx.fillStyle = COLORS.currency;
    ctx.font      = '14px monospace';
    ctx.fillText(`Best: wave ${game.bestWave}`, canvas.width / 2, canvas.height / 2 + 26);

    ctx.fillStyle = COLORS.currency;
    ctx.font      = '13px monospace';
    ctx.fillText(`Total currency: $ ${game.currency}`, canvas.width / 2, canvas.height / 2 + 48);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font      = '12px monospace';
    const restartWave = Math.max(1, Math.floor((game.wave - 1) / 10) * 10 + 1);
    ctx.fillText(`upgrades kept — restarting from wave ${restartWave}...`, canvas.width / 2, canvas.height / 2 + 68);
  }
}
