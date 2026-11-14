import * as THREE from 'three';

import { normalForFace } from '../animation/pose';

/**
 * Раскладка точек на гранях d6 в координатах сетки {-1, 0, 1}.
 */
const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

const SPACING = 0.2;
const PIP_RADIUS = 0.09;

/**
 * Создаёт кубик d6: корпус BoxGeometry + точки на каждой грани
 * (круглые диски, ориентированные по нормали грани). Точки рисуются
 * геометрией, без текстур — не нужен 2D-canvas.
 */
export function createDie(): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xf2ede0, roughness: 0.55, metalness: 0.05 }),
  );
  group.add(body);

  const pipMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });

  for (let value = 1; value <= 6; value++) {
    const normal = normalForFace(value);
    const n = new THREE.Vector3(...normal).normalize();
    const center = n.clone().multiplyScalar(0.5);

    // Касательные оси грани (u, v) для раскладки точек в плоскости грани.
    const ref = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, ref).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();

    for (const [gx, gy] of PIP_LAYOUT[value]) {
      const pip = new THREE.Mesh(new THREE.CircleGeometry(PIP_RADIUS, 24), pipMaterial);
      pip.position
        .copy(center)
        .addScaledVector(n, 0.02)
        .addScaledVector(u, gx * SPACING)
        .addScaledVector(v, gy * SPACING);
      pip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      group.add(pip);
    }
  }

  return group;
}
