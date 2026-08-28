/**
 * Minimal reader for Unity's `.anim` (AnimationClip) YAML assets.
 *
 * Unity writes these files itself, so the layout is completely regular --
 * fixed two-space indentation, one key per line, no anchors/aliases inside
 * the curve lists. That makes a line scanner both sufficient and far cheaper
 * than a real YAML parse: a single idle clip is ~42k lines, more than half of
 * which is `m_EditorCurves`/`m_EulerEditorCurves` -- editor-only duplicates of
 * the runtime curves that this reader stops before ever reaching.
 */
import fs from "node:fs";

export interface Keyframe<V extends number[]> {
  time: number;
  value: V;
}

export interface UnityCurve<V extends number[]> {
  /** Transform path relative to the clip's root, e.g. `MFighter_m000_b.ao/bip01/Bip01_Pelvis`. */
  path: string;
  /** Last segment of `path` -- the bone's own name. */
  target: string;
  keys: Keyframe<V>[];
}

export interface UnityAnimationClip {
  name: string;
  /** Seconds; Unity's own m_StopTime, which can exceed the last keyframe's time. */
  stopTime: number;
  loop: boolean;
  rotations: UnityCurve<[number, number, number, number]>[];
  positions: UnityCurve<[number, number, number]>[];
}

// Curve lists we care about, keyed by their YAML property name. Everything
// else (m_ScaleCurves, m_FloatCurves, the m_*EditorCurves duplicates, ...) is
// skipped -- the rigs never animate scale, and the editor curves are redundant.
const ROTATION_SECTION = "m_RotationCurves";
const POSITION_SECTION = "m_PositionCurves";
// Everything past this key is clip metadata and editor-only curve copies.
const END_SECTION = "m_ClipBindingConstant";

const KEY_VALUE_PATTERN = /^\s+value: \{x: (\S+?), y: (\S+?), z: (\S+?)(?:, w: (\S+?))?\}$/;
const KEY_TIME_PATTERN = /^\s+time: (\S+)$/;
const PATH_PATTERN = /^    path: (.*)$/;
const SECTION_PATTERN = /^  (m_\w+):/;

export function readUnityAnimationClip(filePath: string): UnityAnimationClip {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");

  const clip: UnityAnimationClip = {
    name: filePath.split("/").pop()!.replace(/\.anim$/, ""),
    stopTime: 0,
    loop: false,
    rotations: [],
    positions: [],
  };

  let section: string | null = null;
  let keys: Keyframe<number[]>[] = [];
  let pendingTime: number | null = null;

  for (const line of lines) {
    const sectionMatch = SECTION_PATTERN.exec(line);
    if (sectionMatch) {
      if (sectionMatch[1] === END_SECTION) break;
      section = sectionMatch[1];
      keys = [];
      pendingTime = null;
      continue;
    }

    if (section !== ROTATION_SECTION && section !== POSITION_SECTION) continue;

    const timeMatch = KEY_TIME_PATTERN.exec(line);
    if (timeMatch) {
      pendingTime = Number(timeMatch[1]);
      continue;
    }

    const valueMatch = KEY_VALUE_PATTERN.exec(line);
    // A `value:` line only closes a keyframe if a `time:` line opened one --
    // both curve lists also carry inSlope/outSlope/inWeight/outWeight vectors
    // in the same `{x: .., y: ..}` shape, and those must not be mistaken for
    // keyframe values.
    if (valueMatch && pendingTime !== null) {
      const value = [Number(valueMatch[1]), Number(valueMatch[2]), Number(valueMatch[3])];
      if (valueMatch[4] !== undefined) value.push(Number(valueMatch[4]));
      keys.push({ time: pendingTime, value });
      pendingTime = null;
      continue;
    }

    // `path:` terminates a curve entry -- Unity always writes it last.
    const pathMatch = PATH_PATTERN.exec(line);
    if (pathMatch) {
      const path = pathMatch[1].trim();
      const target = path.split("/").pop() ?? path;
      if (keys.length > 0) {
        if (section === ROTATION_SECTION) {
          clip.rotations.push({ path, target, keys: keys as Keyframe<[number, number, number, number]>[] });
        } else {
          clip.positions.push({ path, target, keys: keys as Keyframe<[number, number, number]>[] });
        }
      }
      keys = [];
      pendingTime = null;
    }
  }

  // m_AnimationClipSettings sits after END_SECTION, so pull the two fields we
  // need with a direct scan rather than continuing the line walk past it.
  clip.stopTime = Number(/^\s+m_StopTime: (\S+)$/m.exec(source)?.[1] ?? 0);
  clip.loop = /^\s+m_LoopTime: 1$/m.test(source);

  return clip;
}
