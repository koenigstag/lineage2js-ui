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

  void main() {
    vec3 corner = vec3(0.165, 0.129, 0.251);
    vec3 mid = vec3(0.109, 0.145, 0.278);
    vec3 far = vec3(0.039, 0.055, 0.122);

    vec2 bottomLeft = vec2(0.0, 0.0);
    float drift = sin(uTime * 0.05) * 0.06;
    float t = clamp(distance(vUv, bottomLeft) / 1.41421356 + drift, 0.0, 1.0);

    vec3 color = t < 0.7
      ? mix(corner, mid, t / 0.7)
      : mix(mid, far, (t - 0.7) / 0.3);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface SkyLayerProps {
  /** Plane size in world units. Defaults to the orthographic viewport size (login screen usage). */
  size?: [number, number];
  /** Z position of the plane. Defaults to -3 (behind the login atmosphere's other layers). */
  z?: number;
}

/** Opaque night-sky gradient -- the base of the atmosphere scene when no real background image/video is available. */
export function SkyLayer({ size, z = -3 }: SkyLayerProps) {
  const materialRef = useRef<ShaderMaterial>(null);
  const meshRef = useRef<Mesh>(null);
  const { viewport } = useThree();

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  const [sizeX, sizeY] = size ?? [viewport.width, viewport.height];

  return (
    <mesh ref={meshRef} position={[0, 0, z]} scale={[sizeX, sizeY, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </mesh>
  );
}
