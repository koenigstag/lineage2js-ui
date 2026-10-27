import {
  DataTexture,
  DoubleSide,
  LinearFilter,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector4,
} from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { getMapAssetUrl, getStaticMeshTextureUrl } from "../../config/world-assets";
import { shadowPlaneAt, type ResolvedLighting } from "./map-lighting";
import type { MapTerrain, MapTerrainLayer } from "./map-scene.types";

/**
 * Layers a terrain material composites.
 *
 * Eight is what the format allows (`NumIntMap`), and it is also close to what a
 * WebGL2 fragment stage guarantees: eight colour maps plus seven masks is
 * fifteen of the sixteen texture units required by the spec. The base layer has
 * no mask -- it is the ground everything else is painted over.
 */
const MAX_LAYERS = 8;

const vertexShader = /* glsl */ `
  attribute vec2 worldXY;
  varying vec2 vWorldXY;
  varying float vWorldZ;

  #include <fog_pars_vertex>

  void main() {
    vWorldXY = worldXY;
    // three's Y is L2's Z -- the vertical projections need it.
    vWorldZ = position.y;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

/**
 * Sampling one layer, written out per index.
 *
 * GLSL forbids indexing an array of samplers with anything but a constant, and
 * three's `#pragma unroll_loop_start` only recognises one exact loop shape --
 * neither of which was obvious until the program failed to link and every
 * frame logged "useProgram: program not valid". Generating the eight blocks
 * here keeps the indices literal and the source one place.
 */
function layerBlock(index: number): string {
  return /* glsl */ `
    if (${index} < layerCount) {
      vec2 uv${index} = layerUvFor(layerUv[${index}], layerAxis[${index}]);
      vec3 c${index} = texture2D(layerMaps[${index}], uv${index}).rgb;
      float m${index} = texture2D(alphaMaps[${index - 1}], maskUv).a;
      color = mix(color, c${index}, m${index});
    }`;
}

/** Layers 1..7, each written out so the sampler index stays a literal. */
const LAYER_BLOCKS = [1, 2, 3, 4, 5, 6, 7].map(layerBlock).join("\n");

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D layerMaps[${MAX_LAYERS}];
  // One short of the layers, and indexed from layer 1: the base layer has no
  // mask. A declared sampler counts against MAX_TEXTURE_IMAGE_UNITS whether
  // the shader reads it or not, and eight maps plus eight masks is already
  // the sixteen a WebGL2 fragment stage guarantees -- the slot this saves is
  // what shadowIntensity below occupies.
  uniform sampler2D alphaMaps[${MAX_LAYERS - 1}];
  uniform vec4 layerUv[${MAX_LAYERS}];      // xy = scale, zw = offset
  uniform vec2 alphaUv;                     // world -> mask, shared by every layer
  uniform vec2 alphaOffset;
  uniform int layerAxis[${MAX_LAYERS}];     // 0 = XY, 1 = XZ, 2 = YZ
  uniform int layerCount;
  uniform vec3 ambient;
  uniform vec3 sunColor;
  uniform sampler2D shadowIntensity;        // the editor's baked sun, 0..1
  uniform vec2 shadowUv;                    // world -> that texture
  uniform vec2 shadowOffset;

  // No tonemapping_pars_fragment / colorspace_pars_fragment here: the renderer
  // already puts those functions in the fragment prefix of every program,
  // ShaderMaterial included, so including them again is a pile of "function
  // already has a body". Only the two calls at the end are missing.
  // (And no backticks in this comment -- it lives inside a template literal.)

  varying vec2 vWorldXY;
  varying float vWorldZ;

  #include <fog_pars_fragment>

  vec2 layerUvFor(vec4 t, int axis) {
    // The client projects a layer down one of three world planes: the ground
    // for almost everything, XZ or YZ for the textures painted onto cliffs.
    vec2 world = vWorldXY;
    if (axis == 1) world = vec2(vWorldXY.x, vWorldZ);
    else if (axis == 2) world = vec2(vWorldXY.y, vWorldZ);
    return (world - t.zw) * t.xy;
  }

  void main() {
    vec2 maskUv = (vWorldXY - alphaOffset) * alphaUv;

    // Layer 0 is the unmasked ground; the rest are painted over it in order,
    // the same "over" the engine's own terrain pass uses.
    vec3 color = texture2D(layerMaps[0], layerUvFor(layerUv[0], layerAxis[0])).rgb;
${LAYER_BLOCKS}

    // D3DTOP_MODULATE2X: the retail renderer doubles the terrain's diffuse when
    // it enables lighting, and without it the ground reads far too dark.
    color *= 2.0;

    // No dot product against a sun direction, deliberately. The client's
    // terrain has no diffuse term: the editor baked one per vertex, slope and
    // occlusion together, and this samples that bake. A lambert in front of it
    // would count the geometry twice -- and did, which is why a tree trunk
    // measured (1,1,1) while the grass beside it was fine. See
    // UTerrainSector::SetIntensityMap and resolveLighting.
    float shadow = texture2D(shadowIntensity, vWorldXY * shadowUv + shadowOffset).r;
    gl_FragColor = vec4(color * (ambient + sunColor * shadow), 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    // Last, as three's own materials do it: the renderer hands fogColor over in
    // the output colour space, which is the space this shader writes in.
    // Without this the ground is the one surface the map's fog does not reach,
    // and the terrain's edge stays visible through it.
    #include <fog_fragment>
  }
`;

export interface TerrainMaterialOptions {
  terrain: MapTerrain;
  /** Which map this is -- the baked shadow planes are fetched per map. */
  mapX: number;
  mapY: number;
  lighting: ResolvedLighting;
  /** Game hour, which picks the shadow plane. */
  hour: number;
  loader: KTX2Loader;
  /** Called whenever a texture lands, so the chunks using it redraw. */
  onTexture: () => void;
}

/**
 * Loads a map's layer textures and returns the material that composites them.
 *
 * Textures arrive one at a time and the material is usable before any of them
 * do -- a chunk with a white ground is a better first frame than no ground.
 */
export function createTerrainMaterial({
  terrain,
  mapX,
  mapY,
  lighting,
  hour,
  loader,
  onTexture,
}: TerrainMaterialOptions): ShaderMaterial {
  const layers = terrain.layers.slice(0, MAX_LAYERS);
  // A real one-pixel texture, not a bare `new Texture()`: an empty one has no
  // image for three to upload, and every sampler in the shader is read whether
  // its layer has arrived or not.
  const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  white.needsUpdate = true;

  const layerMaps: Texture[] = [];
  const alphaMaps: Texture[] = [];
  const layerUv: Vector4[] = [];
  const layerAxis: number[] = [];

  for (let i = 0; i < MAX_LAYERS; i++) {
    // A layer without UV data is one baked by an older converter. It simply
    // does not paint, rather than taking the whole canvas down with it.
    const layer: MapTerrainLayer | undefined = layers[i]?.uvScale ? layers[i] : undefined;
    layerMaps.push(white);
    // Masks are layers 1..7, so this array is one shorter and shifted down.
    if (i > 0) alphaMaps.push(white);
    layerUv.push(
      layer
        ? new Vector4(layer.uvScale[0], layer.uvScale[1], layer.uvOffset[0], layer.uvOffset[1])
        : new Vector4(0, 0, 0, 0)
    );
    layerAxis.push(layer?.axis ?? 0);
  }

  // A mask covers the map in the same normalized span the heightmap does, so
  // it shares the base layer's world->index transform divided by the map's
  // width in quads.
  const base = layers[0]?.uvScale ? layers[0] : undefined;
  const alphaScale = base
    ? new Vector2(base.uvScale[0] / (terrain.heightmap.width - 1), base.uvScale[1] / (terrain.heightmap.height - 1))
    : new Vector2(0, 0);

  // World -> the shadow plane, which has one texel per heightmap sample.
  //
  // Taken from the terrain's own transform rather than from a layer's UV: a
  // layer may be missing and the bake must still line up with the ground it
  // was baked for. Inverting `world = (sample - origin) . axis` gives the
  // sample index, and the half-texel lands on the texel's centre -- without
  // it every value is read a sample off, which on a shadow edge is visible.
  const { origin, xAxis, yAxis } = terrain.toWorld;
  const { width, height } = terrain.heightmap;
  const shadowUv = new Vector2(1 / (xAxis[0] * width), 1 / (yAxis[1] * height));
  const shadowOffset = new Vector2((origin[0] + 0.5) / width, (origin[1] + 0.5) / height);

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    // The client's own terrain is single sided, but a chunk seen from beneath
    // (standing under an overhang, or the camera dipping through a slope) is
    // better as a surface than as a hole.
    side: DoubleSide,
    // ShaderMaterial opts out of fog by default, and the uniforms have to be
    // there for the renderer to fill in -- neither happens on its own.
    fog: true,
    uniforms: {
      // Cloned, not merged: UniformsUtils.merge copies array values, which
      // would hand the material its own layerMaps and leave the arrays the
      // loaders below fill in unread.
      ...UniformsUtils.clone(UniformsLib.fog),
      layerMaps: { value: layerMaps },
      alphaMaps: { value: alphaMaps },
      layerUv: { value: layerUv },
      alphaUv: { value: alphaScale },
      alphaOffset: { value: new Vector2(base?.uvOffset[0] ?? 0, base?.uvOffset[1] ?? 0) },
      layerAxis: { value: layerAxis },
      layerCount: { value: layers.length },
      // Resolved once for everything that lights anything, out of the client's
      // own curves -- see resolveLighting. These were three constants written
      // by hand, which is why the ground was four or five times brighter than
      // the meshes standing on it.
      ambient: { value: lighting.terrainAmbient },
      sunColor: { value: lighting.terrainSun },
      // Fully lit until the bake arrives. A missing plane can only ever
      // darken the ground, so starting at "no occlusion known" means a map
      // settles into its shadows rather than flashing out of blackness.
      shadowIntensity: { value: white },
      shadowUv: { value: shadowUv },
      shadowOffset: { value: shadowOffset },
    },
  });

  loadShadow(terrain, mapX, mapY, hour, (texture) => {
    material.uniforms.shadowIntensity.value = texture;
    onTexture();
  });

  layers.forEach((layer, index) => {
    if (!layer.uvScale) return;
    load(loader, layer.texture, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      layerMaps[index] = texture;
      onTexture();
    });
    if (index > 0) {
      load(loader, layer.alphaMap, (texture) => {
        alphaMaps[index - 1] = texture;
        onTexture();
      });
    }
  });

  return material;
}

/**
 * Fetches the baked sun intensity for the hour, as a plain texture.
 *
 * Linear filtering with no mipmaps: the bake is one texel per terrain vertex,
 * so sampling it linearly is the same interpolation the client gets for free
 * from per-vertex colours, and at this project's draw distance a texel is
 * never small enough on screen for a mipmap to be worth the blur it costs.
 *
 * No colour space is set, which means none is applied. These bytes are a
 * multiplier the fixed-function pipeline applied to a texel, not a colour
 * anyone looked at -- decoding them as sRGB would darken an open field by
 * better than half.
 */
function loadShadow(
  terrain: MapTerrain,
  mapX: number,
  mapY: number,
  hour: number,
  apply: (texture: Texture) => void
): void {
  const shadow = terrain.shadow;
  if (!shadow?.files.length) return;

  const file = shadow.files[shadowPlaneAt(shadow.times, hour)] ?? shadow.files[0];
  const url = getMapAssetUrl(mapX, mapY, file);
  if (!url) return;

  new TextureLoader().load(
    url,
    (texture) => {
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      apply(texture);
    },
    undefined,
    () => {
      // A map baked before the planes existed simply stays fully lit.
    }
  );
}

function load(loader: KTX2Loader, name: string | null, apply: (texture: Texture) => void): void {
  const url = name ? getStaticMeshTextureUrl(name) : undefined;
  if (!url) return;
  loader
    .loadAsync(url)
    .then((texture) => {
      texture.wrapS = texture.wrapT = 1000; // RepeatWrapping, without importing it for one line
      apply(texture);
    })
    .catch(() => {
      // A missing layer simply does not paint.
    });
}
