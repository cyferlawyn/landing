import { EnemyType } from './enemy.js';
import { audio }     from './audio.js';

export class WaveSpawner {
  constructor(game) {
    this.game         = game;
    this.done         = true;
    this.totalSpawned = 0;
  }

  begin(waveNumber) {
    const entries = buildWave(waveNumber);
    const rollovers   = this.game.enemyPool.activeCount();
    this.totalSpawned = entries.length + rollovers;
    this.done         = true;   // all enemies exist in the pool from frame 1

    const bounds = this.game.projectilePool._bounds;
    const w = bounds.w;
    const h = bounds.h;
    const margin = 40;

    for (const entry of entries) {
      const edge   = entry.edge ?? Math.floor(Math.random() * 4);
      const jitter = entry.type === EnemyType.SWARM ? 20 : 0;

      // Base spawn position on the canvas edge
      let x, y;
      switch (edge) {
        case 0: x = Math.random() * w;  y = -margin + (Math.random() - 0.5) * jitter; break;
        case 1: x = Math.random() * w;  y = h + margin + (Math.random() - 0.5) * jitter; break;
        case 2: x = -margin + (Math.random() - 0.5) * jitter; y = Math.random() * h; break;
        case 3: x = w + margin + (Math.random() - 0.5) * jitter; y = Math.random() * h; break;
      }

      const e = this.game.enemyPool.spawn(entry.type, this.game.wave, x, y);

      // Push the enemy further outside by delay × its own speed so it arrives
      // at the canvas edge at roughly the same time it would have been spawned.
      if (e && entry.delay > 0) {
        const extra = entry.delay * e.baseSpeed;
        switch (edge) {
          case 0: e.y -= extra; break;
          case 1: e.y += extra; break;
          case 2: e.x -= extra; break;
          case 3: e.x += extra; break;
        }
      }

      if (entry.type === EnemyType.BOSS) {
        this.game.edgeFlash = 0.6;
        audio.bossArrival();
      }
    }
  }
}

function buildWave(wave) {
  const entries = [];

  // Boss wave
  if (wave % 10 === 0) {
    entries.push({ type: EnemyType.BOSS, delay: 0, edge: null });

    // Colossus escort — ramps up every 20 waves from wave 20
    const colossusCount = wave >= 20 ? Math.min(Math.floor((wave - 10) / 20) + 1, 5) : 0;
    for (let i = 0; i < colossusCount; i++) {
      entries.push({ type: EnemyType.COLOSSUS, delay: 1.5 + i * 1.5, edge: null });
    }

    // Brute wave-crashers — added from wave 50, grow every 25 waves
    const bruteCount = wave >= 50 ? Math.min(Math.floor((wave - 50) / 25) * 2 + 4, 12) : 0;
    for (let i = 0; i < bruteCount; i++) {
      entries.push({ type: EnemyType.BRUTE, delay: 0.5 + i * 0.4, edge: null });
    }

    return entries;
  }

  const count    = Math.min(Math.floor(3 + wave * 0.8 + Math.pow(wave, 1.5) * 0.15), 200);
  const interval = 0.2;

  let t = 0;
  for (let i = 0; i < count; i++) {
    // 15% chance per slot (wave 11+) to replace with a swarm cluster
    if (wave >= 11 && Math.random() < 0.15) {
      const clusterSize = 10 + Math.floor(Math.random() * 11);
      const edge        = Math.floor(Math.random() * 4);
      for (let s = 0; s < clusterSize; s++) {
        entries.push({ type: EnemyType.SWARM, delay: t + s * 0.03, edge });
      }
      t += interval;
    } else {
      entries.push({ type: pickType(wave), delay: t, edge: null });
      t += interval;
    }
  }

  return entries;
}

function pickType(wave) {
  const pool = [EnemyType.DRONE];

  if (wave >= 4)  pool.push(EnemyType.DASHER, EnemyType.DASHER);
  if (wave >= 5)  pool.push(EnemyType.ELITE, EnemyType.ELITE);
  if (wave >= 7)  pool.push(EnemyType.BOMBER);
  if (wave >= 8)  pool.push(EnemyType.BRUTE);
  if (wave >= 12) pool.push(EnemyType.ELITE, EnemyType.BRUTE);
  if (wave >= 14) pool.push(EnemyType.PHANTOM, EnemyType.PHANTOM);
  if (wave >= 18) pool.push(EnemyType.SPAWNER);
  if (wave >= 20) pool.push(EnemyType.COLOSSUS);
  if (wave >= 25) pool.push(EnemyType.SPAWNER, EnemyType.COLOSSUS);

  return pool[Math.floor(Math.random() * pool.length)];
}
