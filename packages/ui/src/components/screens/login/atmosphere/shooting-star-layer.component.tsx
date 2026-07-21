import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, ShaderMaterial } from "three";

const MIN_INTERVAL_SECONDS = 30;
const RANDOM_EXTRA_SECONDS = 30;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float head = smoothstep(0.0, 1.0, vUv.x);
    float taper = smoothstep(0.0, 1.0, 1.0 - abs(vUv.y - 0.5) * 2.0);
    float alpha = head * taper * uOpacity * 0.55;
    gl_FragColor = vec4(0.82, 0.85, 0.88, alpha);
  }
`;

interface Shot {
  active: boolean;
  startedAt: number;
  duration: number;
  headStartX: number;
  headStartY: number;
  headEndX: number;
  headEndY: number;
  dirX: number;
  dirY: number;
  angle: number;
  length: number;
}

function randomInterval(): number {
  return MIN_INTERVAL_SECONDS + Math.random() * RANDOM_EXTRA_SECONDS;
}

/** Occasional shooting star -- a brief bright streak crossing the sky, no more often than every 30-60s. */
export function ShootingStarLayer() {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const { viewport } = useThree();

  const shot = useRef<Shot>({
    active: false,
    startedAt: 0,
    duration: 0,
    headStartX: 0,
    headStartY: 0,
    headEndX: 0,
    headEndY: 0,
    dirX: 1,
    dirY: 0,
    angle: 0,
    length: 0,
  });
  const nextSpawnAt = useRef(randomInterval());

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = shot.current;

    if (!s.active) {
      if (meshRef.current) meshRef.current.visible = false;

      if (t >= nextSpawnAt.current) {
        // Enters from the upper portion of the sky, travels diagonally downward.
        const angle = -(Math.PI * 0.2 + Math.random() * Math.PI * 0.2);
        const travel = viewport.width * (0.25 + Math.random() * 0.2);
        const headStartX = (Math.random() - 0.5) * viewport.width * 0.7;
        const headStartY = viewport.height * (0.15 + Math.random() * 0.3);

        s.active = true;
        s.startedAt = t;
        s.duration = 0.5 + Math.random() * 0.4;
        s.headStartX = headStartX;
        s.headStartY = headStartY;
        s.dirX = Math.cos(angle);
        s.dirY = Math.sin(angle);
        s.headEndX = headStartX + s.dirX * travel;
        s.headEndY = headStartY + s.dirY * travel;
        s.angle = angle;
        s.length = viewport.width * 0.12;
      }
      return;
    }

    const progress = (t - s.startedAt) / s.duration;
    if (progress >= 1) {
      s.active = false;
      nextSpawnAt.current = t + randomInterval();
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    const headX = s.headStartX + (s.headEndX - s.headStartX) * progress;
    const headY = s.headStartY + (s.headEndY - s.headStartY) * progress;

    if (meshRef.current) {
      meshRef.current.visible = true;
      // Mesh spans [-0.5, 0.5] locally along its +X (head) axis -- offset the
      // center back by half the length so the head tip lands exactly on
      // (headX, headY) and the tail trails behind it.
      meshRef.current.position.set(headX - s.dirX * s.length * 0.5, headY - s.dirY * s.length * 0.5, -1.2);
      meshRef.current.rotation.z = s.angle;
      meshRef.current.scale.set(s.length, s.length * 0.035, 1);
    }

    if (materialRef.current) {
      const fadeIn = Math.min(progress / 0.15, 1);
      const fadeOut = Math.min((1 - progress) / 0.25, 1);
      materialRef.current.uniforms.uOpacity.value = Math.min(fadeIn, fadeOut);
    }
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uOpacity: { value: 0 } }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
