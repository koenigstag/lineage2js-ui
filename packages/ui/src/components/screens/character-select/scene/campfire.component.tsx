import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Mesh,
  type PointLight,
  type ShaderMaterial,
} from "three";

const EMBER_COUNT = 40;

const flameVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flameFragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    float taper = 1.0 - abs(uv.x - 0.5) * 2.0 * (0.25 + uv.y * 0.85);
    float shape = clamp(smoothstep(1.0, 0.05, uv.y) * taper, 0.0, 1.0);

    float flicker = noise(vec2(uv.x * 4.0, uv.y * 5.0 - uTime * 3.2));
    float intensity = shape * (0.55 + 0.55 * flicker);

    vec3 color = mix(vec3(0.85, 0.16, 0.02), vec3(1.0, 0.85, 0.25), clamp(uv.y * 1.4 + flicker * 0.25, 0.0, 1.0));
    float alpha = smoothstep(0.1, 0.55, intensity);

    gl_FragColor = vec4(color, alpha);
  }
`;

function FlamePlane({ rotationY }: { rotationY: number }) {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh position={[0, 0.55, 0]} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[0.9, 1.1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={flameVertexShader}
        fragmentShader={flameFragmentShader}
        uniforms={{ uTime: { value: Math.random() * 10 } }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

function Embers() {
  const materialRef = useRef<ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(EMBER_COUNT * 3);
    const phases = new Float32Array(EMBER_COUNT);
    const speeds = new Float32Array(EMBER_COUNT);
    const drifts = new Float32Array(EMBER_COUNT);

    for (let i = 0; i < EMBER_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.35;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      phases[i] = Math.random();
      speeds[i] = 0.4 + Math.random() * 0.5;
      drifts[i] = (Math.random() - 0.5) * 0.6;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("aPhase", new BufferAttribute(phases, 1));
    geo.setAttribute("aSpeed", new BufferAttribute(speeds, 1));
    geo.setAttribute("aDrift", new BufferAttribute(drifts, 1));
    return geo;
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={/* glsl */ `
          uniform float uTime;
          attribute float aPhase;
          attribute float aSpeed;
          attribute float aDrift;
          varying float vLife;

          void main() {
            float life = fract(aPhase + uTime * aSpeed * 0.15);
            vLife = life;
            vec3 p = position;
            p.y += life * 2.2;
            p.x += aDrift * life;
            p.z += aDrift * life * 0.6;
            vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (1.0 - life) * 6.0;
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={/* glsl */ `
          varying float vLife;
          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            float disc = smoothstep(0.5, 0.0, dist);
            float fade = 1.0 - vLife;
            vec3 color = mix(vec3(1.0, 0.9, 0.3), vec3(1.0, 0.35, 0.05), vLife);
            gl_FragColor = vec4(color, disc * fade * 0.85);
          }
        `}
      />
    </points>
  );
}

/** Diablo-style campfire: crossed flame billboards, rising embers, and a flickering warm point light. */
export function Campfire() {
  const lightRef = useRef<PointLight>(null);
  const logsRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (lightRef.current) {
      const flicker = Math.sin(state.clock.elapsedTime * 8.0) * 0.15 + Math.sin(state.clock.elapsedTime * 3.3) * 0.1;
      lightRef.current.intensity = 2.4 + flicker;
    }
  });

  return (
    <group>
      <mesh ref={logsRef} position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
        <meshStandardMaterial color="#2a1a12" roughness={1} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[0, Math.PI / 2.4, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
        <meshStandardMaterial color="#20140d" roughness={1} />
      </mesh>

      <FlamePlane rotationY={0} />
      <FlamePlane rotationY={Math.PI / 2} />
      <Embers />

      <pointLight ref={lightRef} position={[0, 1, 0]} color="#ff9a4d" intensity={2.4} distance={9} decay={2} />
    </group>
  );
}
