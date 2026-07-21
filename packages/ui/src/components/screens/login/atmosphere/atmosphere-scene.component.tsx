import { Canvas } from "@react-three/fiber";
import { CloudLayer } from "./cloud-layer.component";
import { StarField } from "./star-field.component";

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
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
      >
        <StarField />
        <CloudLayer />
      </Canvas>
    </div>
  );
}
