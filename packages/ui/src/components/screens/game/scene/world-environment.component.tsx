import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Color, Fog, SRGBColorSpace, Vector3 } from "three";
import { TERRAIN_DRAW_DISTANCE, mapKey, worldToMapCoords } from "../../../../config/world-assets";
import { L2_TO_THREE_SCALE, l2ToThree } from "../../../../utils/coords";
import { DEFAULT_HOUR, resolveLighting } from "../../../../utils/world/map-lighting";
import type { MapEnvironmentTime, WorldEnv } from "../../../../utils/world/map-scene.types";
import type { LoadedMapScene } from "../../../../utils/world/use-map-scenes";
import { useWorldEnv } from "../../../../utils/world/use-world-env";

interface WorldEnvironmentProps {
  scenes: LoadedMapScene[];
  /** Where the camera is, in L2 world units -- picks which map's sky applies. */
  worldX: number;
  worldY: number;
  /**
   * Game hour, 0..24. The server has not been asked for it yet (no packet is
   * decoded into game time), so this is a constant until it is.
   */
  hour?: number;
}

/**
 * Sky and fog out of the map itself.
 *
 * Without this the world sits in the canvas's default black: terrain that ends
 * at TERRAIN_DRAW_DISTANCE ends against nothing, and a hard edge across the
 * view is exactly what the client's fog exists to hide. The colours are not a
 * matter of taste here -- every map carries its own set, per time of day, and
 * they are a large part of why Gludio does not look like Aden.
 */
export function WorldEnvironment({ scenes, worldX, worldY, hour = DEFAULT_HOUR }: WorldEnvironmentProps) {
  const { scene } = useThree();

  // The map underfoot, when it has an environment; otherwise any loaded one,
  // so a step across a border into an unbaked map doesn't blink the sky out.
  const environment = useMemo(() => {
    const [mapX, mapY] = worldToMapCoords(worldX, worldY);
    const here = mapKey(mapX, mapY);
    const under = scenes.find((entry) => mapKey(entry.mapX, entry.mapY) === here && entry.scene.environment);
    return (under ?? scenes.find((entry) => entry.scene.environment))?.scene.environment ?? null;
  }, [scenes, worldX, worldY]);

  const colors = useMemo(() => environment && sampleTimeOfDay(environment.times, hour), [environment, hour]);

  // The light itself is not per map: it comes from the client's own curves,
  // one set for the whole world, sampled at the hour. See resolveLighting.
  const env = useWorldEnv();
  const lighting = useMemo(() => resolveLighting(env, hour), [env, hour]);

  // The sun's *direction* is per map, and is the one thing still taken off the
  // level: its `NMovableSunLight` rotator. Picked like the environment, and
  // separately, because a map can carry one and not the other -- 20_19 has no
  // L2FogInfo at all and borrows its sky from a neighbour, while its own sun
  // actor is perfectly present.
  const sunDirection = useMemo(() => {
    const [mapX, mapY] = worldToMapCoords(worldX, worldY);
    const here = mapKey(mapX, mapY);
    const under = scenes.find((entry) => mapKey(entry.mapX, entry.mapY) === here && entry.scene.lighting?.sun);
    const sun = (under ?? scenes.find((entry) => entry.scene.lighting?.sun))?.scene.lighting?.sun;
    return sun ? sunDirectionFrom(sun.rotation) : new Vector3(0, 1, 0);
  }, [scenes, worldX, worldY]);

  useEffect(() => {
    if (!colors || !environment) return;

    const previousBackground = scene.background;
    const previousFog = scene.fog;

    const [near, far] = fogBand(env);
    scene.background = colors.sky;
    scene.fog = new Fog(colors.fog, near * L2_TO_THREE_SCALE, far * L2_TO_THREE_SCALE);

    return () => {
      scene.background = previousBackground;
      scene.fog = previousFog;
    };
  }, [scene, colors, environment, env]);

  // The lights are drawn whether or not the map has a sky: the two come from
  // different places and a map may carry only one.
  const { meshAmbient, meshSun } = lighting;

  return (
    <>
      {/* The static-mesh half of the client's lighting, the same pair the
          terrain shader is given for the ground -- see resolveLighting.

          The intensity carries two factors and no taste. `2` is
          D3DTOP_MODULATE2X, which the client applies to a mesh's lighting
          exactly as it does to the terrain's. `PI` reconciles the two paths:
          the terrain shader multiplies its colour in directly, while three's
          materials run the same quantity through BRDF_Lambert, which is
          `diffuse / PI`. Left at 1 the meshes come out pi times darker than
          the ground they stand on -- which is the complaint this work started
          from, just inverted. */}
      <ambientLight color={meshAmbient} intensity={2 * Math.PI} />
      {/* The client gives a static mesh no directional term at all: its sun is
          a flat addition, because the editor baked the shape of the light into
          the mesh's own vertex colours. Nothing extracts those yet, so the
          sun's share of that flat total is spent here as a directional light
          instead -- a stand-in for the bake, which keeps a trunk from reading
          as a cardboard cut-out. It is a quarter of a mesh's light at noon,
          so the difference between this and the client's flat version is
          small, and it goes away the day the vertex colours are read.

          A directional light takes only its direction from the position, so
          this can sit at the origin's own scale and still light a character
          standing 60000 units away. */}
      <directionalLight
        color={meshSun}
        intensity={2 * Math.PI}
        position={[sunDirection.x * 100, sunDirection.y * 100, sunDirection.z * 100]}
      />
    </>
  );
}

/**
 * An Unreal rotator to the direction light arrives *from*.
 *
 * The sun actor's rotator points the way its light travels, so the vector a
 * lambert term wants is the negation of it.
 */
function sunDirectionFrom([pitch, yaw]: [number, number, number]): Vector3 {
  const p = (pitch / 65536) * Math.PI * 2;
  const y = (yaw / 65536) * Math.PI * 2;
  const travel = l2ToThree(Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p));
  return travel.normalize().negate();
}

function toColor(rgb: [number, number, number]): Color {
  // The bytes are sRGB as the client's editor showed them; without naming the
  // space three would read them as linear and every colour would come out
  // washed out.
  return new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
}

/**
 * The band of fog to use, of the five the client ships.
 *
 * These come from `env.int`'s `[FOG]`, not from the map. The map's own
 * `L2FogInfo` carries five bands too and it is tempting to read them here --
 * this did, and that is why the fog started at the camera. Those are the
 * *zone* override, in force only inside the actor's 3000-4000 unit affect
 * range, and their near is 0 on every map in the client because a swamp's fog
 * really does begin at your feet. Outside such a zone the client uses these.
 * See WorldEnvFog and MapEnvironment.fogRanges.
 *
 * The client picks the band by the player's view-distance setting; ours is
 * fixed by TERRAIN_DRAW_DISTANCE, so the useful band is the widest one that
 * still closes before the ground runs out. Anything wider would leave the
 * terrain's edge visible, which is the one thing fog is here to prevent.
 */
function fogBand(env: WorldEnv | null): [number, number] {
  const bands = (env?.fog?.ranges ?? []).filter((range) => range[1] > 0);
  // The renderer's own fallback when the config names no range, in its own
  // units -- not a number invented here.
  if (!bands.length) return [2000, 8000];

  const fitting = bands.filter(([, far]) => far * L2_TO_THREE_SCALE <= TERRAIN_DRAW_DISTANCE);
  return fitting.length ? fitting[fitting.length - 1] : bands[0];
}

interface SampledColors {
  sky: Color;
  fog: Color;
}

/**
 * The colours at a given hour, between the two entries that bracket it.
 *
 * The entries are sparse and unevenly spaced -- a map may name four or eight
 * of them -- and the day is a circle, so the last entry blends round into the
 * first rather than stopping at midnight.
 */
function sampleTimeOfDay(times: MapEnvironmentTime[], hour: number): SampledColors | null {
  if (!times.length) return null;

  const sorted = [...times].sort((a, b) => a.time - b.time);
  const at = ((hour % 24) + 24) % 24;

  let before = sorted[sorted.length - 1];
  let after = sorted[0];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].time <= at) {
      before = sorted[i];
      after = sorted[(i + 1) % sorted.length];
    }
  }

  // Distance from `before` to `after` going forwards through the day, so the
  // wrap over midnight is an ordinary short gap rather than a jump backwards.
  const span = (after.time - before.time + 24) % 24 || 24;
  const t = ((at - before.time + 24) % 24) / span;

  return {
    sky: toColor(before.sky).lerp(toColor(after.sky), t),
    fog: toColor(before.fog).lerp(toColor(after.fog), t),
  };
}
