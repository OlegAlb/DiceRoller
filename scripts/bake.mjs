// Оффлайн-рекордер клипов на честной физике (Rapier, WASM).
// Гоняет симуляцию броска кубика, ищет бросок, который приземляется нужной
// гранью вверх, и записывает траекторию в src/animation/clips.json.
// Запуск: node scripts/bake.mjs
//
// Приложение НЕ использует Rapier — оно проигрывает готовые ключевые кадры.
// Бросок направлен «от игрока» (спавн у камеры, скорость по −Z, дуга вверх),
// и печётся в 3 тира силы (слабый / средний / сильный).

import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';

// ---------- helpers (дубль из src/animation) ----------

const FACE_NORMALS = {
  1: [0, 1, 0],
  2: [1, 0, 0],
  3: [0, 0, 1],
  4: [0, 0, -1],
  5: [-1, 0, 0],
  6: [0, -1, 0],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Случайный единичный кватернион (равномерно по S^3). */
function randomQuat(rng) {
  let x = rng() * 2 - 1;
  let y = rng() * 2 - 1;
  let z = rng() * 2 - 1;
  let w = rng() * 2 - 1;
  const l = Math.hypot(x, y, z, w);
  return { x: x / l, y: y / l, z: z / l, w: w / l };
}

function quatMultiply(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function quatRotate(q, v) {
  const qv = { x: v[0], y: v[1], z: v[2], w: 0 };
  const qc = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  const r = quatMultiply(quatMultiply(q, qv), qc);
  return [r.x, r.y, r.z];
}

function quatSlerp(a, b, t) {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  if (dot < 0) {
    dot = -dot;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }
  if (dot > 0.9995) {
    let x = a.x + (bx - a.x) * t, y = a.y + (by - a.y) * t;
    let z = a.z + (bz - a.z) * t, w = a.w + (bw - a.w) * t;
    const l = Math.hypot(x, y, z, w);
    return { x: x / l, y: y / l, z: z / l, w: w / l };
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const s0 = Math.sin(theta0 - theta) / Math.sin(theta0);
  const s1 = Math.sin(theta) / Math.sin(theta0);
  return {
    x: a.x * s0 + bx * s1,
    y: a.y * s0 + by * s1,
    z: a.z * s0 + bz * s1,
    w: a.w * s0 + bw * s1,
  };
}

function shownFace(rot) {
  let best = 1;
  let bestY = -Infinity;
  for (let v = 1; v <= 6; v++) {
    const n = FACE_NORMALS[v];
    const w = quatRotate(rot, n);
    if (w[1] > bestY) {
      bestY = w[1];
      best = v;
    }
  }
  return best;
}

/** Максимальная Y-компонента нормалей граней — мера «плоскости» посадки. */
function maxNormalY(rot) {
  let best = -Infinity;
  for (let v = 1; v <= 6; v++) {
    const w = quatRotate(rot, FACE_NORMALS[v]);
    if (w[1] > best) best = w[1];
  }
  return best;
}

// ---------- симуляция ----------

const DT = 1 / 120;
const MAX_TIME = 4.0;

/** Сила броска: множитель скорости/закрутки. */
const STRENGTHS = [0.55, 1.0, 1.6]; // слабый, средний, сильный

function simulate(seed, strength) {
  const rng = mulberry32(seed);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;

  // пол: верхняя поверхность на y = 0
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 20), floor);

  // параметры броска: случайная начальная ориентация, спавн у камеры (+Z),
  // скорость «от игрока» (−Z) с дугой вверх, БЕЗ бокового дрейфа (x0=0, vx=0),
  // чтобы кубики летели параллельно и не пересекались
  const rot = randomQuat(rng);
  const x0 = 0;
  const y0 = 1.1 + rng() * 0.4;
  const z0 = 1.2 + rng() * 0.6;
  const vx = 0;
  const vy = (0.5 + rng() * 0.8) * strength;
  const vz = -(1.2 + rng() * 0.9) * strength;
  const spin = (4 + rng() * 4) * strength;
  const wx = (rng() * 2 - 1) * spin;
  const wy = (rng() * 2 - 1) * spin;
  const wz = (rng() * 2 - 1) * spin;

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x0, y0, z0)
      .setRotation(rot)
      .setLinvel(vx, vy, vz)
      .setAngvel({ x: wx, y: wy, z: wz })
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);
  collider.setFriction(0.45);
  collider.setRestitution(0.3);

  const frames = [];
  let restCount = 0;

  for (let step = 0; step < Math.floor(MAX_TIME / DT); step++) {
    world.step();
    const t = (step + 1) * DT;
    const pos = body.translation();
    const rot = body.rotation();
    frames.push({
      t,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
    });

    const lv = body.linvel();
    const av = body.angvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z);
    const ang = Math.hypot(av.x, av.y, av.z);
    const flat = maxNormalY(rot);
    if (speed < 0.04 && ang < 0.08 && flat > 0.99) {
      restCount++;
    } else {
      restCount = 0;
    }
    if (restCount >= 12) break;
  }

  const face = shownFace(frames[frames.length - 1].rot);
  const settleTime = frames[frames.length - 1].t;
  return { frames, face, settleTime };
}

// ---------- нормализация и ресемплинг ----------

function resample(frames, targetCount) {
  const end = frames[frames.length - 1].t;
  const out = [];
  for (let i = 0; i < targetCount; i++) {
    const t = (i / (targetCount - 1)) * end;
    let k = 1;
    while (k < frames.length - 1 && frames[k].t < t) k++;
    const a = frames[k - 1];
    const b = frames[k];
    const u = (t - a.t) / (b.t - a.t);
    out.push({
      pos: [
        a.pos.x + (b.pos.x - a.pos.x) * u,
        a.pos.y + (b.pos.y - a.pos.y) * u,
        a.pos.z + (b.pos.z - a.pos.z) * u,
      ],
      rot: quatSlerp(a.rot, b.rot, u),
    });
  }
  return out;
}

function recenter(keyframes) {
  const last = keyframes[keyframes.length - 1];
  const dx = last.pos[0];
  const dz = last.pos[2];
  return keyframes.map((k) => ({ pos: [k.pos[0] - dx, k.pos[1], k.pos[2] - dz], rot: k.rot }));
}

const round = (x) => Math.round(x * 1e6) / 1e6;

// ---------- main ----------

const FRAMES_PER_CLIP = 60;
const VARIANTS = 3;
const TIER_NAMES = ['weak', 'medium', 'strong'];

async function main() {
  await RAPIER.init();

  const library = { tiers: [] };

  for (let s = 0; s < STRENGTHS.length; s++) {
    const strength = STRENGTHS[s];
    const tier = { faces: [] };
    for (let face = 1; face <= 6; face++) {
      const clips = [];
      for (let v = 0; v < VARIANTS; v++) {
        let result = null;
        let attempts = 0;
        while (attempts < 400) {
          attempts++;
          const seed = (s + 1) * 1000000 + face * 10000 + v * 1000 + attempts;
          const sim = simulate(seed, strength);
          if (sim.face === face) {
            result = sim;
            break;
          }
        }
        if (!result) {
          throw new Error(`не удалось запечь грань ${face}, вариант ${v}, тир ${TIER_NAMES[s]}`);
        }
        const keyframes = recenter(resample(result.frames, FRAMES_PER_CLIP));
        const frames = keyframes.map((k, idx) => {
          const t = idx / (FRAMES_PER_CLIP - 1);
          return [
            round(t),
            round(k.pos[0]), round(k.pos[1]), round(k.pos[2]),
            round(k.rot.x), round(k.rot.y), round(k.rot.z), round(k.rot.w),
          ];
        });
        clips.push({ frames });
        console.log(
          `${TIER_NAMES[s]} face ${face} v${v}: ${attempts} попыток, settle ${result.settleTime.toFixed(2)}s`,
        );
      }
      tier.faces.push({ face, clips });
    }
    library.tiers.push(tier);
  }

  writeFileSync(new URL('../src/animation/clips.json', import.meta.url), JSON.stringify(library));
  console.log('готово -> src/animation/clips.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
