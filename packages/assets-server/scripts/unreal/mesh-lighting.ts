/**
 * The client's point-light pass for a static mesh, run offline.
 *
 * The editor's own answer to this is `UStaticMeshInstance.colorStream`, and
 * where it exists `convert:maps` uses it. But it is not always there: on
 * 20_21 all 210 of the actors with no zone ambient carry a `sceneLights` list
 * and a colour stream that is entirely zero, so taking the bake alone leaves
 * them black. The client does not care, because it never reads the stream --
 * `mesh.useVertexColor` is false on every mesh checked -- and recomputes from
 * `sceneLights` instead, every frame. This does the same thing once.
 *
 * Every number here is the vendored renderer's, which took them from the
 * client: `computeLighting` in objects/lit-actor.ts for the accumulation and
 * `sampleIntensity` in objects/dynamic-light.ts for the falloff.
 *
 * The output is deliberately the same shape as a colour stream, three bytes
 * per mesh vertex, because that is what makes this checkable: the editor's
 * bake is an answer key for exactly this calculation wherever it exists.
 * Measured over four maps, 559 placements carry both -- the instance means
 * differ by a median of **0.8 of 255**, p90 7.0, and not one placement the
 * editor lit comes out dark here. See the README for the rest of the table.
 */

/** LightEffect values that have a falloff of their own. The rest fall through. */
const LE_STATIC_SPOT = 0x08;
const LE_SPOTLIGHT = 0x0c;
const LE_NON_INCIDENCE = 0x0d;
const LE_CYLINDER = 0x11;
const LE_SUNLIGHT = 0x13;
const LE_QUADRATIC_NON_INCIDENCE = 0x14;

/**
 * Attenuation for a light with no effect of its own, which is 445 of the 822
 * on three maps.
 *
 * `dot` is the *unnormalized* light vector against the normal, so `c` is
 * `a * cos(theta)` and the `b / a * c` below is really `b * cos(theta)` --
 * written the client's way rather than simplified, since the simplification
 * is only valid while `a > 0` and the client leans on that guard.
 */
function attenuation(
  distance: number,
  radius: number,
  dx: number,
  dy: number,
  dz: number,
  nx: number,
  ny: number,
  nz: number
): number {
  const dot = dx * nx + dy * ny + dz * nz;
  if (dot <= 0 || distance > radius) return 0;
  const a = distance / radius;
  const b = 2 * a * a * a - 3 * a * a + 1;
  const c = Math.abs(dot / radius);
  return (b / a) * c * 2;
}

interface SampledLight {
  effect: number;
  /** World position, L2 units. */
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Unit vector the light points along; only spotlights and sunlight use it. */
  dx: number;
  dy: number;
  dz: number;
  cone: number;
  color: [number, number, number];
  flags: Uint8Array;
}

/** What one light contributes at one vertex, before colour and glow. */
function sampleIntensity(light: SampledLight, px: number, py: number, pz: number, nx: number, ny: number, nz: number): number {
  const vx = light.x - px;
  const vy = light.y - py;
  const vz = light.z - pz;
  const radius = light.radius;

  if (light.effect === LE_SUNLIGHT) {
    const dot = light.dx * nx + light.dy * ny + light.dz * nz;
    return dot > 0 ? dot * 2 : 0;
  }

  if (light.effect === LE_CYLINDER) {
    const distance = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (distance >= radius) return 0;
    return Math.max(0, 1 - (vx * vx + vy * vy) / (radius * radius)) * 2;
  }

  if (light.effect === LE_NON_INCIDENCE) {
    const distance = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (vx * nx + vy * ny + vz * nz <= 0 || distance >= radius) return 0;
    return Math.sqrt(1.02 - distance / radius) * 2;
  }

  if (light.effect === LE_QUADRATIC_NON_INCIDENCE) {
    const distanceSquared = vx * vx + vy * vy + vz * vz;
    if (vx * nx + vy * ny + vz * nz <= 0 || distanceSquared >= radius * radius) return 0;
    return (1.02 - distanceSquared / (radius * radius)) * 2;
  }

  const distanceSquared = vx * vx + vy * vy + vz * vz;
  const distance = Math.sqrt(distanceSquared);
  const base = attenuation(distance, radius, vx, vy, vz, nx, ny, nz);

  if (light.effect !== LE_SPOTLIGHT && light.effect !== LE_STATIC_SPOT) return base;
  if (base <= 0) return 0;

  // The cone, as the client narrows it: `cone` is a byte, and the sine it
  // becomes is compared against the angle between the light's own direction
  // and the vertex.
  const sine = 1 - light.cone / 256;
  const rSine = 1 / (1 - sine);
  const vDotV = -(vx * light.dx + vy * light.dy + vz * light.dz);
  if (vDotV <= 0 || vDotV * vDotV <= sine * sine * distanceSquared) return 0;
  return Math.pow((vDotV * rSine) / distance - sine * rSine, 2) * base;
}

/** Rotates (1, 0, 0) by an actor's quaternion -- a spotlight's aim. */
function aimOf(actor: any): [number, number, number] {
  const q = actor?.rotation?.getQuaternionElements?.();
  if (!q) return [1, 0, 0];
  const [qx, qy, qz, qw] = q;
  // v' = v + 2 * q_xyz x (q_xyz x v + w * v), with v = (1, 0, 0).
  const tx = 2 * (qy * 0 - qz * 0);
  const ty = 2 * (qz * 1 - qx * 0);
  const tz = 2 * (qx * 0 - qy * 1);
  return [1 + qw * tx + (qy * tz - qz * ty), qw * ty + (qz * tx - qx * tz), qw * tz + (qx * ty - qy * tx)];
}

/**
 * Per-vertex RGB for one placement, or null when it has no lights or no mesh.
 *
 * The same bytes a colour stream holds: the `Light` actors' contribution
 * alone, to be added on top of the sun or the zone ambient rather than
 * replacing either.
 */
export function computeInstanceLight(actor: any): Uint8Array | null {
  const stream = actor?.mesh?.loadSelf?.()?.vertexStream;
  const count = stream?.getElemCount?.() ?? 0;
  const scene = actor?.instance?.loadSelf?.()?.sceneLights;
  if (!count || !scene?.length) return null;

  // Pulled out once: the client transforms every vertex by this, and doing it
  // through FVector per vertex would allocate a few hundred million times
  // over a whole-client run.
  const m = actor.localToWorld?.();
  const pX = m?.planeX;
  const pY = m?.planeY;
  const pZ = m?.planeZ;
  const pW = m?.planeW;
  if (!pX) return null;

  const scaleGlow = typeof actor.scaleGlow === "number" ? actor.scaleGlow : 1;
  const out = new Uint8Array(count * 3);
  let any = false;

  for (const info of scene) {
    const source = info?.light?.loadSelf?.();
    const flags = info?.vertexFlags?.getTypedArray?.() as Uint8Array | undefined;
    if (!source?.location || !flags) continue;

    const [cr, cg, cb] = source.getColor?.() ?? [0, 0, 0];
    if (!cr && !cg && !cb) continue;

    const [dx, dy, dz] = aimOf(source);
    const light: SampledLight = {
      effect: source.effect?.valueOf?.() ?? source.effect ?? 0,
      x: source.location.x,
      y: source.location.y,
      z: source.location.z,
      radius: source.worldLightRadius?.() ?? 0,
      dx,
      dy,
      dz,
      cone: source.cone ?? 0,
      color: [cr, cg, cb],
      flags,
    };

    for (let vi = 0; vi < count; vi++) {
      // The bit says this light was found to reach this vertex when the level
      // was built -- the client's own visibility, which no amount of
      // arithmetic here would reproduce.
      if (!(flags[vi >> 3] & (1 << (vi & 7)))) continue;

      const [vx, vy, vz, vnx, vny, vnz] = stream.getElem(vi);
      const px = vx * pX.x + vy * pY.x + vz * pZ.x + pW.x;
      const py = vx * pX.y + vy * pY.y + vz * pZ.y + pW.y;
      const pz = vx * pX.z + vy * pY.z + vz * pZ.z + pW.z;

      let nx = vnx * pX.x + vny * pY.x + vnz * pZ.x;
      let ny = vnx * pX.y + vny * pY.y + vnz * pZ.y;
      let nz = vnx * pX.z + vny * pY.z + vnz * pZ.z;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (length > 0) {
        nx /= length;
        ny /= length;
        nz /= length;
      }

      // multiplier 1.0 for a static scene light, and the 0.5 the licensee
      // pre-applies for the Modulate2X domain -- see computeLighting.
      const intensity = scaleGlow * 0.5 * sampleIntensity(light, px, py, pz, nx, ny, nz);
      if (intensity <= 0) continue;

      const at = vi * 3;
      out[at] = Math.min(255, out[at] + Math.floor(cr * intensity));
      out[at + 1] = Math.min(255, out[at + 1] + Math.floor(cg * intensity));
      out[at + 2] = Math.min(255, out[at + 2] + Math.floor(cb * intensity));
      any = true;
    }
  }

  return any ? out : null;
}
