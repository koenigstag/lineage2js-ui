import { Canvas } from "@react-three/fiber";
import { CloudLayer } from "./cloud-layer.component";
import { StarField } from "./star-field.component";
import { SkyLayer } from "./sky-layer.component";
import { MoonLayer } from "./moon-layer.component";

/**
 * Fully self-contained fallback scene (sky gradient + stars + drifting fog),
 * used only when no static background (local/server image or video)
 * resolved. Never mixed with a real background -- static art and the r3f
 * scene are two independent fallback tiers, not layers stacked together.
 */
export function AtmosphereScene() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        orthographic
        camera={{ position: [0, 0, 5], zoom: 1, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
      >
        <SkyLayer />
        <MoonLayer />
        <StarField />
        <CloudLayer />
      </Canvas>
    </div>
  );
}
