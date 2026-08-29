import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Same gradient the login screen's night sky draws, in daylight: pale at the
// horizon, deepening overhead. The sun these scenes use is the client's, 34
// degrees up (see config/client-scene-lighting), and a night sky under it
// read as a mistake.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec3 horizon = vec3(0.729, 0.816, 0.886);
    vec3 mid = vec3(0.455, 0.620, 0.808);
    vec3 zenith = vec3(0.216, 0.404, 0.678);

    float drift = sin(uTime * 0.05) * 0.04;
    float t = clamp(vUv.y + drift, 0.0, 1.0);

    vec3 color = t < 0.55
      ? mix(horizon, mid, t / 0.55)
      : mix(mid, zenith, (t - 0.55) / 0.45);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface DaySkyProps {
  /** Plane size in world units. */
  size: [number, number];
  /** Z position of the plane, behind everything else in the scene. */
  z: number;
}

/**
 * The daylight sky behind the character screens.
 *
 * Shared by the creation and selection screens, and deliberately not the
 * login screen's `SkyLayer` with a palette switch: that screen wants a night
 * sky and shares nothing else with these two, and parameterising one
 * component across both made either screen's look a hostage of the other's.
 */
export function DaySky({ size, z }: DaySkyProps) {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  const [sizeX, sizeY] = size;

  return (
    <mesh position={[0, 0, z]} scale={[sizeX, sizeY, 1]}>
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
