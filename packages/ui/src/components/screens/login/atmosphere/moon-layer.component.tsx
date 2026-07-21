import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
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

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;
    float dist = length(centered);

    float glowPulse = 0.9 + 0.1 * sin(uTime * 0.3);
    float core = smoothstep(0.52, 0.3, dist);
    float glow = smoothstep(1.0, 0.0, dist) * 0.45 * glowPulse;

    vec3 baseColor = vec3(0.992, 0.965, 0.890);
    float craters = fbm(vUv * 7.0);
    float shade = mix(0.78, 1.05, craters);
    vec3 moonColor = mix(baseColor, baseColor * shade, core);

    float alpha = clamp(core + glow, 0.0, 1.0);

    gl_FragColor = vec4(moonColor, alpha);
  }
`;

/** Procedural moon (soft disc + glow), positioned near the top-right of the sky. */
export function MoonLayer() {
  const materialRef = useRef<ShaderMaterial>(null);
  const meshRef = useRef<Mesh>(null);
  const { viewport } = useThree();

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  const size = viewport.width * 0.22;

  return (
    <mesh
      ref={meshRef}
      position={[viewport.width * 0.3, viewport.height * 0.28, -2.6]}
      scale={[size, size, 1]}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
