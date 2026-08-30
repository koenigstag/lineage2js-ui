import { useEffect, useMemo } from "react";
import { CanvasTexture } from "three";

// The retail client stacks an NPC's title above its name, in a paler green
// than the name's near-white. Players get the same treatment when they have
// a title set.
const TITLE_COLOR = "#A6E49A";
const NAME_COLOR = "#FBFBFB";

const FONT_SIZE = 48;
const PADDING_X = 20;
const PADDING_Y = 14;
// Gap between the two lines, on top of the font's own box.
const LINE_GAP = 6;

/** Canvas height of a label carrying only a name -- the unit `height` is given in. */
const SINGLE_LINE_HEIGHT = FONT_SIZE + PADDING_Y * 2;

function createNicknameTexture(
  name: string,
  title?: string
): { texture: CanvasTexture; aspect: number; heightScale: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `600 ${FONT_SIZE}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.font = font;
  const lines: Array<{ text: string; color: string }> = title
    ? [
        { text: title, color: TITLE_COLOR },
        { text: name, color: NAME_COLOR },
      ]
    : [{ text: name, color: NAME_COLOR }];

  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line.text).width));
  canvas.width = Math.ceil(textWidth + PADDING_X * 2);
  canvas.height =
    FONT_SIZE * lines.length + LINE_GAP * (lines.length - 1) + PADDING_Y * 2;

  // Setting canvas.width/height resets the 2D context, so font must be reapplied.
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";

  const cx = canvas.width / 2;
  lines.forEach((line, index) => {
    const cy = PADDING_Y + FONT_SIZE / 2 + index * (FONT_SIZE + LINE_GAP);
    ctx.strokeText(line.text, cx, cy);
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, cx, cy);
  });

  const texture = new CanvasTexture(canvas);
  return {
    texture,
    aspect: canvas.width / canvas.height,
    // `height` sizes one line, so a two-line label has to grow to keep the
    // glyphs the same size on screen rather than squeezing both into one.
    heightScale: canvas.height / SINGLE_LINE_HEIGHT,
  };
}

interface NicknameLabelProps {
  text: string;
  /** Drawn above the name, in the title colour. Omitted for creatures with none. */
  title?: string;
  position: [number, number, number];
  /** Height of a single line in world units. Defaults to 0.16. */
  height?: number;
}

/** Camera-facing name label rendered above a character marker, drawn onto a canvas texture. A title, when present, sits above the name the way the retail client stacks them. */
export function NicknameLabel({ text, title, position, height = 0.16 }: NicknameLabelProps) {
  const { texture, aspect, heightScale } = useMemo(
    () => createNicknameTexture(text, title),
    [text, title]
  );

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  const worldHeight = height * heightScale;
  const width = worldHeight * aspect;

  return (
    <sprite position={position} scale={[width, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
