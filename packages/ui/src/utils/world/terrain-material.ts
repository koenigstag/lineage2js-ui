import { DataTexture, DoubleSide, RGBAFormat, ShaderMaterial, SRGBColorSpace, Texture, Vector2, Vector4 } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { getStaticMeshTextureUrl } from "../../config/world-assets";
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
  varying vec3 vNormal;

  void main() {
    vWorldXY = worldXY;
    // three's Y is L2's Z -- the vertical projections need it.
    vWorldZ = position.y;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
      float m${index} = texture2D(alphaMaps[${index}], maskUv).a;
      color = mix(color, c${index}, m${index});
    }`;
}

/** Layers 1..7, each written out so the sampler index stays a literal. */
const LAYER_BLOCKS = [1, 2, 3, 4, 5, 6, 7].map(layerBlock).join("\n");

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D layerMaps[${MAX_LAYERS}];
  uniform sampler2D alphaMaps[${MAX_LAYERS}];
  uniform vec4 layerUv[${MAX_LAYERS}];      // xy = scale, zw = offset
  uniform vec2 alphaUv;                     // world -> mask, shared by every layer
  uniform vec2 alphaOffset;
  uniform int layerAxis[${MAX_LAYERS}];     // 0 = XY, 1 = XZ, 2 = YZ
  uniform int layerCount;
  uniform vec3 ambient;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;

  varying vec2 vWorldXY;
  varying float vWorldZ;
  varying vec3 vNormal;

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

    float lambert = max(dot(normalize(vNormal), normalize(sunDirection)), 0.0);
    gl_FragColor = vec4(color * (ambient + sunColor * lambert), 1.0);
  }
`;

/**
 * Loads a map's layer textures and returns the material that composites them.
 *
 * Textures arrive one at a time and the material is usable before any of them
 * do -- a chunk with a white ground is a better first frame than no ground.
 */
export function createTerrainMaterial(terrain: MapTerrain, loader: KTX2Loader, onTexture: () => void): ShaderMaterial {
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
    alphaMaps.push(white);
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

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    // The client's own terrain is single sided, but a chunk seen from beneath
    // (standing under an overhang, or the camera dipping through a slope) is
    // better as a surface than as a hole.
    side: DoubleSide,
    uniforms: {
      layerMaps: { value: layerMaps },
      alphaMaps: { value: alphaMaps },
      layerUv: { value: layerUv },
      alphaUv: { value: alphaScale },
      alphaOffset: { value: new Vector2(base?.uvOffset[0] ?? 0, base?.uvOffset[1] ?? 0) },
      layerAxis: { value: layerAxis },
      layerCount: { value: layers.length },
      ambient: { value: [0.55, 0.55, 0.6] },
      sunColor: { value: [0.45, 0.44, 0.38] },
      sunDirection: { value: [0.4, 0.85, 0.35] },
    },
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
        alphaMaps[index] = texture;
        onTexture();
      });
    }
  });

  return material;
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
