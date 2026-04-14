import { EnemyType } from './enemy.js';
import { audio }     from './audio.js';

export class WaveSpawner {
  constructor(game) {
    this.game      = game;
    this.queue     = [];  // [{type, delay}] remaining to spawn
    this.elapsed   = 0;
    this.done      = true;
  }

  begin(waveNumber) {
    this.queue   = buildWave(waveNumber);
    this.elapsed = 0;
    this.done    = false;
  }

  update(dt) {
    if (this.done) return;
    this.elapsed += dt;

    while (this.queue.length > 0 && this.elapsed >= this.queue[0].delay) {
      const entry = this.queue.shift();
      this._spawnOne(entry.type, entry.edge);
    }

    if (this.queue.length === 0) this.done = true;
  }

  _spawnOne(type, edge) {
    const bounds = this.game.projectilePool._bounds;
    const w = bounds.w;
    const h = bounds.h;

    // Use supplied edge for clusters, random otherwise
    const e = edge ?? Math.floor(Math.random() * 4);
    let x, y;
    const margin = 40;
    // Swarm units get a small positional jitter so they don't stack perfectly
    const jitter = type === EnemyType.SWARM ? 20 : 0;
    switch (e) {
      case 0: x = Math.random() * w;         y = -margin + (Math.random() - 0.5) * jitter; break;
      case 1: x = Math.random() * w;         y = h + margin + (Math.random() - 0.5) * jitter; break;
      case 2: x = -margin + (Math.random() - 0.5) * jitter; y = Math.random() * h; break;
      case 3: x = w + margin + (Math.random() - 0.5) * jitter; y = Math.random() * h; break;
    }

    this.game.enemyPool.spawn(type, this.game.wave, x, y);
    if (type === EnemyType.BOSS) {
      this.game.edgeFlash = 0.6;
      audio.bossArrival();
    }
  }
}

function buildWave(wave) {
  const entries = [];

  // Boss wave
  if (wave % 10 === 0) {
    entries.push({ type: EnemyType.BOSS, delay: 0, edge: null });
    return entries;
  }

  const count    = Math.min(Math.floor(3 + wave * 0.8 + Math.pow(wave, 1.5) * 0.15), 200);
  const interval = 0.4; // seconds between normal spawns

  let t = 0; // running delay cursor
  for (let i = 0; i < count; i++) {
    // 15% chance per slot (wave 11+) to replace with a swarm cluster
    if (wave >= 11 && Math.random() < 0.15) {
      const clusterSize = 10 + Math.floor(Math.random() * 11); // 10–20
      const edge        = Math.floor(Math.random() * 4);        // shared edge
      for (let s = 0; s < clusterSize; s++) {
        entries.push({ type: EnemyType.SWARM, delay: t + s * 0.06, edge });
      }
      // Advance time by one normal interval so the cluster doesn't overlap the next spawn
      t += interval;
    } else {
      entries.push({ type: pickType(wave), delay: t, edge: null });
      t += interval;
    }
  }

  return entries;
}

function pickType(wave) {
  // Weighted pool based on wave — no swarm here, handled above
  const pool = [EnemyType.DRONE];
  if (wave >= 5)  pool.push(EnemyType.ELITE, EnemyType.ELITE);
  if (wave >= 8)  pool.push(EnemyType.BRUTE);
  if (wave >= 12) pool.push(EnemyType.ELITE, EnemyType.BRUTE);

  return pool[Math.floor(Math.random() * pool.length)];
}
