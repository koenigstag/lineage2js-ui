# @lineage2js/assets-server

Static server for converted game assets, plus the offline converters that
produce them (`scripts/`). See the root `CLAUDE.md` for what is served and how
the converters are wired; this file is the **format reference** for the client
side of the game -- the Unreal Engine 2 packages the retail client renders the
world from.

## Tooling: what reads what

Measured against `D:\Games\Lineage2\L2_HighFive_Client`, not taken from docs.

| Data | Tool | Status |
| --- | --- | --- |
| `system/*.dat` tables | `scripts/client-data/l2-dat.ts`, [L2ClientDat CLI] | works |
| textures `.utx` | `umodel -export -png` / `-dds` | works |
| static meshes `.usx` | `umodel -export -gltf` | works, glTF 2.0 |
| skeletal meshes/anims `.ukx` | `umodel` (see `convert-client-rigs.ts`) | works |
| `.unr` package structure | `umodel -pkginfo <full path>` | class histogram only |
| **actors/terrain inside `.unr`** | -- | **umodel: `Unknown class "TerrainInfo"`** |
| **heightmaps** | -- | **umodel: `Unknown UE2 texture format: TEXF_G16 (10)`** |

umodel indexes only asset packages, so `-path=<client>` never finds a map: a
`.unr` has to be passed as a full file path, and even then umodel has no
classes for `TerrainInfo`, `StaticMeshActor`, `Light`, `ZoneInfo` and friends.
It covers the *assets*; it does not give you the *scene*.

The gap is filled by [Lineage2JS] and its package-reading library
[l2js-core] (both ISC, by realratchet) -- a working UE2 -> three.js renderer in
TypeScript, verified against a disassembly of the retail client (its terrain
shader cites `ATerrainInfo::Render (0x9bdfb8)` for the `Modulate2X` pass). Both
are **vendored into this workspace** as
[`@lineage2js/unreal-l2js-core`](../unreal-l2js-core) and
[`@lineage2js/unreal-l2js-objects`](../unreal-l2js-objects), with the High Five
patches applied -- read those READMEs before touching either. Upstream targets
**C4**; the deltas are listed under "High Five vs C4" below.

## What one map contains

`MAPS/<mapX>_<mapY>.unr`, wrapper `Lineage2Ver111` (28-byte UTF-16 header, XOR
`0xAC` over the body, 20-byte trailer), underneath a plain UE2 package version
**123, licensee 37**. `Textures/*.utx` and `StaticMeshes/*.usx` are
`Lineage2Ver121` instead: the key is the first ciphertext byte XOR `0xC1`,
since the first plaintext byte is always the low byte of the package tag
`0x9E2A83C1` (umodel derives the same value by summing the filename's bytes).

Class histogram of `20_18.unr` (4902 exports), which is representative:

```
1293 AmbientSoundObject    800 StaticMeshActor    653 StaticMeshInstance
 668 SpriteEmitter         258 Emitter             14 MeshEmitter
 257 Model / 257 Polys / 219 Brush   (BSP -- interiors)
 256 TerrainSector           1 TerrainInfo
 135 Light    1 NSun    1 NMoon    1 NMovableSunLight
   9 ZoneInfo   3 L2FogInfo   1 SkyZoneInfo   1 WaterVolume
  30 BlockingVolume   8 PlayerStart   6 MusicVolume   15 Camera (editor leftovers)
```

## Terrain

One `TerrainInfo` per map, and its numbers line up exactly with this project's
existing geodata addressing:

- heightmap **256x256**, format `TEXF_G16` (16-bit greyscale, little-endian),
  stored as an ordinary texture in `Textures/T_<mapX>_<mapY>.utx` under a
  `Height` group.
- `TerrainScale = (128, 128, 76)` -> 256 quads x 128 units = **32768 units**,
  which is exactly `GEO_REGION_SIZE`. One terrain quad = 8x8 geo-cells.
- `MapX`/`MapY` = 20/18 for the map covering world origin = this project's
  `GEO_REGION_ZERO_X`/`_Y`. Lineage2JS's own world->map function reduces to
  `floor(x / 32768) + 20`, the same as `worldToRegionCoords`.
- 256 `TerrainSector`s in a 16x16 grid, 16x16 quads each.

### Native tail after the tagged properties

`TerrainInfo`'s useful data is *not* all in tagged properties. After them
(licensee >= 17, archive >= 83) comes:

```
FObjectArray sectors        compact32 count + compact32 refs   (256)
int32 sectorsX, sectorsY                                       (16, 16)
FCoords toWorld             4 x FVector = 48 bytes
FCoords toHeightMap         4 x FVector = 48 bytes
int32 heightmapX, heightmapY                                   (256, 256)
[archive >= 117] FArray<FColor> vertexColors
```

**This C4 layout was verified to hold unchanged on High Five (licensee 37)** --
the probe read 256 sectors, 16x16, and 256x256 back out of `20_18.unr`.

`toWorld` for `20_18` is `origin (0, 0, 32225.86)`, axes `(128,0,0) (0,128,0)
(0,0,0.296875)`; `0.296875` is `TerrainScale.Z / 256`. Unreal's
`TransformPointBy` **subtracts the origin first**, so a heightmap sample
becomes:

```
worldX = hx * 128
worldY = hy * 128
worldZ = (h - toWorld.origin.z) * toWorld.zAxis.z
```

Sanity check: `h = 32768` gives `Z = 160.95`, and `TerrainInfo.Location.z` is
`160.65`. `toHeightMap` is the exact inverse (`1/128`, `1/0.296875`).

### Terrain is ~32 units below the geodata

Sampling `20_18`'s heightmap every 4th vertex and comparing each world Z
against the nearest layer of this project's own baked geodata tiles:

- orientation is unflipped (`x = hx*128, y = hy*128`) -- the three flipped
  variants come out 30-50x worse, so this is not a coincidence;
- where the two describe the same surface, the terrain sits **31-33 units
  below** the geodata, tightly (p10 -37.6, p90 -26.4).

So the geodata's walkable plane is a constant offset above the visual ground,
not a resampling of it. Anything that places a character on real terrain has to
account for that or bodies will sink into the mesh.

The remaining spread is expected: geodata only describes walkable surfaces, so
under a building, a cliff or the sea there is no layer that corresponds to the
visible ground at all.

### Layers

Up to 8 layers (`NumIntMap` says how many are used), each a `TerrainLayer`
struct in the `Layers` static array:

```
layer 0  T_oren.Obase_1   alpha T_texture.Texture.layer0   (base, bUseAlpha False)
layer 1  T_oren.OG_52     alpha T_20_18.Height.20_18_S     U 1    V 1
layer 2  T_oren.OG_34     alpha T_20_18.Height.20_18_G1
layer 3  T_oren.OG_48     alpha T_20_18.Height.20_18_G2
layer 4  T_oren.OG_36     alpha T_20_18.Height.20_18_G
layer 5  T_oren.OC_05     alpha T_20_18.Height.20_18_ST
layer 6  T_oren.OC_03     alpha T_20_18.Height.20_18_CA    U 3    V 3
layer 7  T_oren.OST_11    alpha T_20_18.Height.20_18_ST1   U 1.5  V 1.5
```

The alpha maps live in the same `.utx` as the heightmap, are 1024x1024, and
**umodel exports them fine** -- only the G16 heightmap defeats it. Layers
composite front-to-back with plain `over` blending, then the whole result is
multiplied by 2 (`D3DTOP_MODULATE2X`, which the retail renderer passes when it
enables lighting).

Each sector stores which layer *combinations* actually occur in it, so a
sector samples only the layers it needs rather than all eight.

### Per-sector data

- `quadVisibilityBitmap` -- per-quad hole mask (cave mouths, etc.).
- `edgeTurnBitmap` -- which diagonal a quad is split along (`123/134` vs
  `124/423`); getting it wrong shows up as wrong shading on slopes.
- `shadowMaps[]` -- **N baked shadow maps per sector, one per time of day**,
  with `shadowMapTimes[i] = i * 24/N + 12/N`. Terrain lighting in the retail
  client is
  `color = ambient + sunColor * shadow/255 + sum(lightColor * intensity)`,
  with the ambient added unconditionally rather than modulated by the shadow.

## Static meshes

`20_18.unr` has 797 `StaticMeshActor`s carrying a mesh -- but only **131
distinct meshes from 10 packages**:

```
216 field_deco_S   147 Oren_DEV_S   147 Oren_tree_S   131 sylen_temple_s
111 interior_B_delf_s   30 Field_Deco_Artifact_S   8 Door_Set_S   ...
```

Heavy instancing, so the per-map asset budget is small and the renderer wants
`InstancedMesh` per distinct mesh. `umodel -export -gltf` handles the meshes
themselves, which is the same path `convert-client-rigs.ts` already uses.

## High Five vs C4

Deltas found so far against Lineage2JS's readers, which were written for C4:

- **`UTexture` carries an extra block on High Five.** After the tagged
  properties there is a `uint32` flag (archive >= 123 && licensee >= 16, which
  Lineage2JS also reads) whose value is `0x100` here -- a case its reader
  explicitly traps on as unseen. The block is fixed-shape: 32 zeroed bytes,
  the texture's own qualified name as an `FString`, an **HLSL fragment**
  (`float4 texcolor0=tex2D(s[0], ...)`) -- each string preceded by a one-byte
  tag -- and a four-byte trailer reading `08 00 26 03`. High Five ships a
  per-texture shader snippet C4 does not have. Patched in
  `unreal-l2js-objects`'s `un-texture.ts` and verified against upstream's own
  "consumed exactly" assertion over 109 textures in 6 packages, in all three
  formats present (`G16`, `DXT1`, `P8`).
- **Two structs C4 does not declare**: `INT64` and `ParamMap`, which
  `loadNativeClasses()` walks over in `Core.u`. Nothing reads them; they only
  have to be constructible. That is the complete set for this client.
- `TerrainInfo`'s native tail is unchanged, despite the licensee bump (37 vs
  C4's 23) -- verified by reading 256 sectors, 16x16, and 256x256 back out of
  `20_18.unr` through the vendored reader.

[L2ClientDat CLI]: https://github.com/MobiusDevelopment/l2clientdat
[Lineage2JS]: https://github.com/realratchet/Lineage2JS
[l2js-core]: https://github.com/realratchet/l2js-core
