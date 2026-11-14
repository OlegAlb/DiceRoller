import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

import type { Clip } from '../animation/clip';
import { getLibrary } from '../animation/library';
import { playClip } from '../animation/player';
import { Vec3 } from '../animation/quat';
import { mulberry32 } from '../engine/random';
import { roll } from '../engine/roll';
import type { RollResult } from '../engine/roll';
import { createDie } from './createDie';
import { ExpoGL, createRenderer, endFrame } from './createRenderer';
import { placementsOverlap } from './overlap';
import { scatterRestPositions } from './scatterRest';

const ROLL_DICE = 3;
const ROLL_DURATION_MS = 2000;
const SCATTER_RADIUS = 1.2;
const TIER_COUNT = 3;

interface DiePlan {
  clip: Clip;
  rest: Vec3;
  yaw: number;
  timeScale: number;
}

interface AnimState {
  plans: DiePlan[];
  startMs: number;
  durationMs: number;
  skipped: boolean;
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  diceGroup: THREE.Group;
  gl: ExpoGL;
}

function now(): number {
  return Date.now();
}

/** Длина свайпа вверх (px) -> тир силы. */
function strengthFromSwipe(dy: number): number {
  if (dy < 80) return 0;
  if (dy < 200) return 1;
  return 2;
}

export function DiceScene() {
  const [result, setResult] = useState<RollResult | null>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const animRef = useRef<AnimState | null>(null);

  const rebuildDice = useCallback((r: RollResult) => {
    const s = sceneRef.current;
    if (!s) return;
    s.diceGroup.clear();
    for (let i = 0; i < r.dice.length; i++) {
      s.diceGroup.add(createDie());
    }
  }, []);

  const startRoll = useCallback(
    (r: RollResult, strength: number) => {
      setResult(r);
      rebuildDice(r);

      const tier = Math.max(0, Math.min(TIER_COUNT - 1, Math.round(strength)));
      const rng = mulberry32(r.seed);
      const lib = getLibrary();

      // детерминированно выбираем клип/вариации для каждого кубика
      const picks = r.dice.map((outcome) => {
        const variants = lib.tiers[tier][outcome.value - 1];
        return {
          clip: variants[Math.floor(rng.next() * variants.length)],
          yaw: (rng.next() * 2 - 1) * 0.04,
          timeScale: 1 + rng.next() * 0.15,
        };
      });

      // подбираем непересекающиеся точки приземления (rejection по траекториям)
      let plans: DiePlan[] = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        const rests = scatterRestPositions(
          r.seed + attempt * 7919,
          r.dice.length,
          SCATTER_RADIUS,
          1.5,
        );
        const candidate: DiePlan[] = r.dice.map((_, i) => ({
          clip: picks[i].clip,
          rest: [rests[i][0], 0, rests[i][1]],
          yaw: picks[i].yaw,
          timeScale: picks[i].timeScale,
        }));
        if (!placementsOverlap(candidate)) {
          plans = candidate;
          break;
        }
        plans = candidate; // запасной вариант на случай, если все попытки пересекаются
      }

      animRef.current = {
        plans,
        startMs: now(),
        durationMs: ROLL_DURATION_MS,
        skipped: false,
      };
    },
    [rebuildDice],
  );

  const doRoll = useCallback(
    (strength: number) => {
      startRoll(roll({ dice: ROLL_DICE, sides: 6, strategy: 'system' }), strength);
    },
    [startRoll],
  );

  const skip = useCallback(() => {
    if (animRef.current) {
      animRef.current.skipped = true;
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          const dy = -g.dy; // вверх -> положительное
          if (dy < 40) return;
          doRoll(strengthFromSwipe(dy));
        },
      }),
    [doRoll],
  );

  const onContextCreate = useCallback(
    (gl: ExpoGL) => {
      const renderer = createRenderer(gl);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f1f18);

      const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      const fovDeg = 55;
      const vFov = (fovDeg * Math.PI) / 180;
      const halfFovH = Math.atan(Math.tan(vFov / 2) * aspect);
      const halfWidth = SCATTER_RADIUS + 0.9;
      const camZ = halfWidth / Math.tan(halfFovH);
      const elevation = (24 * Math.PI) / 180;
      const camY = camZ * Math.tan(elevation);

      const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 100);
      camera.position.set(0, camY, camZ);
      camera.lookAt(0, 0.3, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 1.3);
      dir.position.set(4, 7, 3);
      scene.add(dir);

      const table = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x143d2a, roughness: 0.9 }),
      );
      table.position.y = -0.25;
      scene.add(table);

      const diceGroup = new THREE.Group();
      scene.add(diceGroup);
      sceneRef.current = { renderer, scene, camera, diceGroup, gl };

      startRoll(roll({ dice: ROLL_DICE, sides: 6, strategy: 'system' }), 1);

      const loop = () => {
        const s = sceneRef.current;
        if (s) {
          const a = animRef.current;
          if (a) {
            const t = a.skipped ? 1 : Math.min(1, (now() - a.startMs) / a.durationMs);
            s.diceGroup.children.forEach((die, i) => {
              const plan = a.plans[i];
              if (!plan) return;
              const p = playClip(
                plan.clip,
                { rest: plan.rest, yaw: plan.yaw, timeScale: plan.timeScale },
                t,
              );
              die.position.set(p.position[0], p.position[1], p.position[2]);
              die.quaternion.set(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w);
            });
          }
          s.renderer.render(s.scene, s.camera);
          endFrame(s.gl);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    [startRoll],
  );

  return (
    <View style={styles.container}>
      <View style={styles.gl} {...panResponder.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      </View>
      <View style={styles.hud}>
        <Text style={styles.total}>{result ? `Сумма: ${result.total}` : ''}</Text>
        <Text style={styles.seed}>{result ? `seed: ${result.seed}` : ''}</Text>
        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.primary]} onPress={() => doRoll(1)}>
            <Text style={styles.primaryText}>Бросить</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={skip}>
            <Text style={styles.secondaryText}>Пропустить</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Свайп вверх — бросок (длина = сила)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f18' },
  gl: { flex: 1 },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  total: { color: '#ffffff', fontSize: 34, fontWeight: '700' },
  seed: { color: '#9db3a8', fontSize: 13, marginTop: 4, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: { borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  primary: { backgroundColor: '#2e7d5b' },
  secondary: { backgroundColor: '#243b31' },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: '#cfe3d8', fontSize: 16, fontWeight: '600' },
  hint: { color: '#6f8a7d', fontSize: 12, marginTop: 12 },
});
