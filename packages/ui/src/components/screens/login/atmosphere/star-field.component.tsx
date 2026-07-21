import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, type ShaderMaterial } from "three";

const STAR_COUNT = 140;

const vertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  varying float vPhase;
  varying float vSpeed;

  void main() {
    vPhase = aPhase;
    vSpeed = aSpeed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying float vPhase;
  varying float vSpeed;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float disc = smoothstep(0.5, 0.0, dist);
    float twinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * vSpeed + vPhase));
    gl_FragColor = vec4(vec3(1.0), disc * twinkle);
  }
`;

export interface StarFieldProps {
  /** Spread area in world units. Defaults to the orthographic viewport size (login screen usage). */
  size?: [number, number];
  /** Base Z position stars are scattered around (each star jitters slightly further back). Defaults to -1.5. */
  z?: number;
}

export function StarField({ size, z = -1.5 }: StarFieldProps = {}) {
  const materialRef = useRef<ShaderMaterial>(null);
  const { viewport } = useThree();

  const [sizeX, sizeY] = size ?? [viewport.width, viewport.height];

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const phases = new Float32Array(STAR_COUNT);
    const speeds = new Float32Array(STAR_COUNT);
    const sizes = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * sizeX;
      positions[i * 3 + 1] = (Math.random() - 0.5) * sizeY;
      positions[i * 3 + 2] = z - Math.random();
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.5 + Math.random() * 1.5;
      sizes[i] = 1 + Math.random() * 2;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("aPhase", new BufferAttribute(phases, 1));
    geo.setAttribute("aSpeed", new BufferAttribute(speeds, 1));
    geo.setAttribute("aSize", new BufferAttribute(sizes, 1));
    return geo;
  }, [sizeX, sizeY, z]);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
