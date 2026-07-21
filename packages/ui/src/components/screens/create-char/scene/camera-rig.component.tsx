import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

const LOOK_AT_Y = 1.6;
const LOOK_AT_Z = 0;

interface CameraRigProps {
  targetX: number;
}

/** Snaps the camera along X to focus on the currently selected race's group, keeping height/distance fixed. */
export function CameraRig({ targetX }: CameraRigProps) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.x = targetX;
    camera.lookAt(targetX, LOOK_AT_Y, LOOK_AT_Z);
  }, [camera, targetX]);

  return null;
}
