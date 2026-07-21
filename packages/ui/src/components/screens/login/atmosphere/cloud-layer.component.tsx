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
  uniform float uOpacity;
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
    vec2 uv = vUv * vec2(3.0, 1.6);

    float far = fbm(uv * 1.0 + vec2(uTime * 0.015, uTime * 0.004));
    float near = fbm(uv * 1.8 - vec2(uTime * 0.03, uTime * 0.006) + 10.0);

    float clouds = far * 0.6 + near * 0.4;
    float alpha = smoothstep(0.45, 0.85, clouds) * uOpacity;

    vec3 color = vec3(0.85, 0.88, 0.95);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function CloudLayer() {
  const materialRef = useRef<ShaderMaterial>(null);
  const meshRef = useRef<Mesh>(null);
  const { viewport } = useThree();

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -2]} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 }, uOpacity: { value: 0.22 } }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
