import { CHARACTER_MODEL_SCALE } from "../utils/models/character-model";

/**
 * The lighting the retail client uses on its own character screens.
 *
 * Read out of the client's lobby level (`MAPS/Lobby02.unr`, the one the
 * creation screen's placements land in): one `NMovableSunLight`, the
 * `LevelInfo`'s ambient, and the terrain `ZoneInfo`'s distance fog. Five of
 * the six race spots are outdoors and carry no light actors at all -- the sun
 * is the whole of it. The sixth, the Kamael cave, is its own zone with the
 * sun switched off and forty-two lights of its own, which is not modelled
 * here yet.
 *
 * These are numbers out of a level file, not art, so they live in the bundle
 * rather than on the asset server.
 */

/** Unreal rotators are 65536 to the turn. */
const ROTATOR_TURN = 65536;

/** `NMovableSunLight0.Rotation` -- pitch then yaw, as the client stores it. */
const SUN_ROTATION = { pitch: -6158, yaw: 28624 };

/**
 * Where the sun sits relative to whatever it lights, as a unit vector in
 * scene axes.
 *
 * The client's rotator is the direction the light *travels*, in Unreal's
 * Z-up, left-handed axes; a three.js directional light instead wants a
 * position to shine *from*, in a Y-up frame. So this negates the travel
 * direction and swaps the axes (three x = ue x, y = ue z, z = -ue y). The
 * result puts the sun 33.8 degrees above the horizon, which is the elevation
 * the client's own pitch describes -- worth checking against if the axis
 * convention is ever revisited.
 */
export const CLIENT_SUN_DIRECTION: [number, number, number] = (() => {
  const pitch = (SUN_ROTATION.pitch / ROTATOR_TURN) * Math.PI * 2;
  const yaw = (SUN_ROTATION.yaw / ROTATOR_TURN) * Math.PI * 2;
  const travel = {
    x: Math.cos(pitch) * Math.cos(yaw),
    y: Math.cos(pitch) * Math.sin(yaw),
    z: Math.sin(pitch),
  };
  return [-travel.x, -travel.z, travel.y];
})();

/**
 * How strong to make it.
 *
 * The client says `LightBrightness = 70` against UE2's default of 64, and
 * that number has no conversion into a three.js intensity -- the two
 * renderers do not agree on what a light of a given strength does. So the
 * ratio is kept and the base is what daylight needs here with nothing else
 * lighting the scene.
 */
export const CLIENT_SUN_INTENSITY = 4.2 * (70 / 64);

/**
 * `LevelInfo0.AmbientBrightness` is 1 of 255 and its `AmbientVector` is zero,
 * so by the numbers the client has no ambient term outdoors at all.
 */
export const CLIENT_AMBIENT_INTENSITY = 1 / 255;

/**
 * A fill the client's data does not have, to make up for one its renderer
 * does not need.
 *
 * Copying the ambient above literally puts a body's shadow side at pure
 * black, which the client's own screen never shows: UE2 lights a skeletal
 * mesh per vertex and keeps the unlit side readable, where a standard
 * material here falls to zero. So the literal number is the *less* faithful
 * of the two, and this restores what the original looks like rather than what
 * it stores.
 *
 * A hemisphere rather than more ambient, because the fill outdoors is sky
 * above and ground below, and that is the shape of it: the colours are this
 * scene's own sky and its ground plane.
 */
export const FILL_SKY_COLOR = "#7ba3cf";
export const FILL_GROUND_COLOR = "#2b2724";
export const FILL_INTENSITY = 1.1;

/**
 * `ZoneInfo0`'s distance fog, converted from client units the same way bodies
 * are. It starts well past any character, so what it actually touches is the
 * far edge of the ground.
 */
export const CLIENT_FOG_NEAR = 1500 * CHARACTER_MODEL_SCALE;
export const CLIENT_FOG_FAR = 10000 * CHARACTER_MODEL_SCALE;

/**
 * The selection screen, which is the creation screen's opposite.
 *
 * It is a different map -- `MAPS/Lobby01.unr`, where `logongrp.dat` puts its
 * eight character slots -- and an interior: the zone around those slots is
 * tagged `lobby_CT_hall`, group `lobby_select`, and it sets `bSunAffect`
 * false. So where creation is one sun and no light actors, selection is no
 * sun and ninety-two of them, in two families: firelight and a cold cyan.
 */

/** `ZoneInfo3.AmbientVector` and `AmbientBrightness`, which is 20 of 255. */
export const HALL_AMBIENT_COLOR = "#333333";
export const HALL_AMBIENT_INTENSITY = 20 / 255;

/**
 * The hall's two light families, averaged.
 *
 * Ninety-two lights placed against hall geometry this scene does not have
 * cannot be carried over one for one -- a point light means nothing without
 * the wall it was hung on. What does carry is the pair of colours and which
 * of them comes from where: the warm one is the flames at floor level (36
 * lights, hue 27-34), the cold one washes the hall from above (45 lights,
 * hue 125-143).
 */
export const HALL_FIRE_COLOR = "#ffc35d";
export const HALL_COLD_COLOR = "#5dedff";
export const HALL_COLD_INTENSITY = 1.5;

/** `ZoneInfo3`'s distance fog, scaled the way bodies are. Close enough here to tint the floor. */
export const HALL_FOG_COLOR = "#51777b";

/**
 * What stands behind the arc, where the client has the hall's far wall.
 *
 * Not the fog colour: fog is what a wall turns into with distance behind it,
 * and painted flat it reads as a lit sky rather than as the back of a dark
 * room. This is that colour taken most of the way down to black, so the fog
 * above still resolves toward something of the hall's own hue.
 */
export const HALL_BACKDROP_COLOR = "#162124";
export const HALL_FOG_NEAR = 600 * CHARACTER_MODEL_SCALE;
export const HALL_FOG_FAR = 10000 * CHARACTER_MODEL_SCALE;

/**
 * Where the selection screen stands its characters, from `logongrp.dat`.
 *
 * Eight `LogPawn` slots: seven on an arc and one in front. Fitting a circle
 * to the seven puts its centre within two units of that eighth slot and gives
 * a radius of 131.1 client units, which is 5.00 in scene units -- so the
 * front slot is not a ninth place off to the side, it is the middle of the
 * ring, and the arc is drawn around it.
 *
 * The seven sit at even 13.4-degree steps except across the middle, where the
 * step is exactly doubled: the arc keeps its centre slot empty rather than
 * putting a body between the viewer and whoever has stepped forward.
 *
 * Every slot's yaw points at that centre, to within a degree on all seven.
 * That is the rule to carry over rather than the numbers -- a character faces
 * the middle of the ring, which is also where the camera looks from.
 */
export const SELECT_ARC_RADIUS = 5.0;
/** Total angle the seven span, from the fitted circle: 36.3 to 130.5 degrees. */
export const SELECT_ARC_SPREAD = (94.2 * Math.PI) / 180;
/** How far in front of the arc the selected slot sits, along the camera's axis. */
export const SELECT_FRONT_OFFSET = 4.18;
