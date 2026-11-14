import * as THREE from 'three';

/**
 * Минимальный интерфейс контекста expo-gl, который нужен three.js.
 * Структурно совместим с ExpoWebGLRenderingContext.
 */
export interface ExpoGL {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  endFrameEXP(): void;
}

/**
 * Создаёт three.js WebGLRenderer поверх контекста expo-gl.
 * Паттерн из expo-three: подсовываем фейковый canvas, чей getContext()
 * возвращает контекст expo-gl; после каждого рендера зовём endFrameEXP().
 */
export function createRenderer(gl: ExpoGL): THREE.WebGLRenderer {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  const canvas = {
    width,
    height,
    style: {},
    clientWidth: width,
    clientHeight: height,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  return renderer;
}

/** Завершает кадр expo-gl после рендера three.js. */
export function endFrame(gl: ExpoGL): void {
  gl.endFrameEXP();
}
