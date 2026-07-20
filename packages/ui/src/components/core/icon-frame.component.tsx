import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export interface IconFrameProps {
  /** Real icon image (skill/item/action/class). Falls back to the gradient background when unset. */
  iconUrl?: string;
  icon?: ReactNode;
  iconColor?: string;
  shadowColor?: string;
  shadowOffset?: string;
  background?: string;
  backgroundColor?: string;
  darkenAmount?: number;
  noiseOpacity?: number;
  showNoise?: boolean;
  noiseSvg?: string;
  borderFrom?: string;
  borderTo?: string;
  borderStyle?: CSSProperties;
  width?: number;
  height?: number;
}

const DEFAULT_NOISE_SVG = `
    <svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.18' numOctaves='2' stitchTiles='stitch'/>
        <feColorMatrix type='saturate' values='0'/>
        <feComponentTransfer>
          <feFuncR type='linear' slope='1.3' intercept='-0.15'/>
          <feFuncG type='linear' slope='1.3' intercept='-0.15'/>
          <feFuncB type='linear' slope='1.3' intercept='-0.15'/>
        </feComponentTransfer>
      </filter>
      <rect width='100%' height='100%' filter='url(#n)'/>
    </svg>
  `;

function svgToDataUri(svgString: string) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svgString);
}

// Darkens a hex color by amount (0..1), scaling RGB channels toward zero.
function darkenColor(hex: string, amount = 0.45) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const scale = 1 - amount;
  const toHex = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v * scale))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Reusable icon frame: gradient background, diagonal border and an icon slot
 * with a drop-shadow that follows the icon's own silhouette.
 */
export function IconFrame({
  iconUrl,
  icon,
  iconColor = "#b4d585",
  shadowColor = "#020d02",
  shadowOffset = "6px 9px",
  background = "#010100",
  backgroundColor,
  darkenAmount = 0.45,
  noiseOpacity = 0.35,
  showNoise = false,
  noiseSvg = DEFAULT_NOISE_SVG,
  borderFrom,
  borderTo,
  borderStyle,
  width = 34,
  height = 34,
}: IconFrameProps) {
  // The gradient is always computed (it's the fallback), and stays visible
  // underneath the <img> until that image is confirmed to have loaded --
  // if it 404s/fails, imageFailed flips and the gradient shows through.
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [iconUrl]);

  const resolvedBackground = backgroundColor
    ? `linear-gradient(180deg, ${backgroundColor} 0%, ${darkenColor(backgroundColor, darkenAmount)} 100%)`
    : background;

  const showImage = Boolean(iconUrl) && !imageFailed;

  const frame = (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: resolvedBackground,
        overflow: "hidden",
      }}
    >
      {showImage && (
        <img
          src={iconUrl}
          alt=""
          onError={() => setImageFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {showNoise && noiseOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${svgToDataUri(noiseSvg)}")`,
            backgroundSize: "120px 120px",
            mixBlendMode: "overlay",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "80%",
            height: "80%",
            color: iconColor,
            filter: `drop-shadow(${shadowOffset} 0 ${shadowColor})`,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );

  // No default border baked in here -- callers (hotbar, inventory, ...) opt in
  // via borderFrom/borderTo, each with their own colors (or none at all).
  if (!borderFrom || !borderTo) {
    return (
      <div style={{ width, height, boxSizing: "border-box" }}>{frame}</div>
    );
  }

  return (
    <div
      style={{
        width,
        height,
        boxSizing: "border-box",
        padding: 1,
        background: `linear-gradient(90deg, ${borderFrom} 0%, ${borderTo} 100%)`,
        ...borderStyle,
      }}
    >
      {frame}
    </div>
  );
}

// Default backgrounds by slot type. An explicit `background` prop wins over these.
const TYPE_BACKGROUNDS = {
  skill: "#010100",
  "pet-action": "linear-gradient(180deg, #07130c 0%, #406d47 100%)",
  action: "linear-gradient(180deg, #020503 0%, #42627d 100%)",
  macro: "linear-gradient(180deg, #030502 0%, #316d5a 100%)",
  "pair-action": "linear-gradient(180deg, #050000 0%, #952959 100%)",
  "item-misc": "linear-gradient(45deg, #180e03 0%, #8a573d 100%)",
  "item-weapon": "linear-gradient(45deg, #000000 0%, #440c0d 35%, #782421 100%)",
  "item-shield": "linear-gradient(45deg, #000000 0%, #440c0d 35%, #782421 100%)",
  "item-armor": "linear-gradient(45deg, #040601 0%, #11261d 35%, #426d63 100%)",
  "item-jewelry": "linear-gradient(45deg, #000105 0%, #0c1f26 35%, #2e475f 100%)",
} satisfies Record<string, string>;

export type IconSlotType = keyof typeof TYPE_BACKGROUNDS;

// Types that show the noise texture by default (an explicit showNoise prop still wins).
const TYPE_NOISE: Partial<Record<IconSlotType, boolean>> = {
  "pet-action": true,
  action: true,
  macro: true,
  "pair-action": true,
};

export interface IconSlotProps extends Omit<IconFrameProps, "background"> {
  type: IconSlotType;
  background?: string;
}

/** IconFrame wrapper that resolves a default background (and noise) from `type`. */
export function IconSlot({ type, background, showNoise, ...rest }: IconSlotProps) {
  const resolvedBackground = background ?? TYPE_BACKGROUNDS[type] ?? TYPE_BACKGROUNDS.skill;
  const resolvedShowNoise = showNoise ?? TYPE_NOISE[type] ?? false;
  return <IconFrame {...rest} background={resolvedBackground} showNoise={resolvedShowNoise} />;
}
