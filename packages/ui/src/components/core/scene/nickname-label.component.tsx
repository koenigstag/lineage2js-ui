import { useEffect, useMemo } from "react";
import { CanvasTexture } from "three";

function createNicknameTexture(text: string): { texture: CanvasTexture; aspect: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 48;
  const font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.font = font;
  const paddingX = 20;
  const paddingY = 14;
  canvas.width = Math.ceil(ctx.measureText(text).width + paddingX * 2);
  canvas.height = fontSize + paddingY * 2;

  // Setting canvas.width/height resets the 2D context, so font must be reapplied.
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillStyle = "#f0e6c8";

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeText(text, cx, cy);
  ctx.fillText(text, cx, cy);

  const texture = new CanvasTexture(canvas);
  return { texture, aspect: canvas.width / canvas.height };
}

interface NicknameLabelProps {
  text: string;
  position: [number, number, number];
  /** Label height in world units. Defaults to 0.32. */
  height?: number;
}

/** Camera-facing nickname label rendered above a character marker, drawn onto a canvas texture. */
export function NicknameLabel({ text, position, height = 0.32 }: NicknameLabelProps) {
  const { texture, aspect } = useMemo(() => createNicknameTexture(text), [text]);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  const width = height * aspect;

  return (
    <sprite position={position} scale={[width, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
