# Robotron PC 1715 asset

The computer model is reconstructed from reference photographs, using the version with light floppy drives, a grey-brown enclosure, a black keyboard, and a red CE key. It is a visual reconstruction, not a dimensionally accurate scan. The additional external drive enclosure is not included.

## Runtime assets

- `static/models/Computer/computer_setup.glb`: Draco-compressed geometry, one mesh, 27,140 triangles, two UV channels. No embedded material or texture; approximately 208 KB.
- `static/models/Computer/computer_albedo.png`: 2048 × 4096 color atlas containing case colors and directly printed keyboard legends and wordmark; approximately 274 KB.
- `static/models/Computer/baked_computer_light.jpg`: 2048 × 2048 diffuse-light atlas; approximately 784 KB.

`Computer.ts` combines the color atlas on UV0 with the light atlas on UV1 in a single `MeshBasicMaterial`. The lighting was baked at one quarter of the preview lighting intensity to avoid clipping and is restored with `lightMapIntensity: 4`. Both textures use sRGB encoding, `flipY: false`, and the maximum supported anisotropic filtering. Separate UV channels preserve label sharpness independently of the lighting bake.

The older `baked_computer.jpg` is retained but no longer loaded. Draco decoding uses the existing files under `static/draco/gltf/`.

## Tabletop shadows

`static/models/World/baked_environment_robotron.jpg` replaces the original room atlas at runtime. Its tabletop region removes the previous computer, keyboard, mouse, and cable silhouettes. The original room atlas is retained unchanged.

The obsolete silhouettes were cleaned with built-in Imagegen. Only a feathered band from the cleaned tabletop crop is used, preserving the existing paper and mug shadows. New shadows are derived from the actual Robotron geometry using two Cycles diffuse-light bakes: an empty tabletop baseline and the tabletop with the new computer. Their clamped ratio modulates the cleaned surface, preserving the room's underlying lighting. No runtime shadow pass or additional draw call is needed.

When changing the computer footprint, regenerate this environment texture as well as the computer's own lightmap.

## Interactive CRT screen

The model is scaled by 900. The HTML screen is positioned at `(0, 947, 301)`, with dimensions `1280 × 1024` and an X rotation of −3 degrees. The exported geometry leaves the screen opening clear for the existing interactive HTML content.

The screen mask and CRT effects share rounded contours. The effects are composited at the glass surface with explicit render ordering and no depth writing. The camera clipping range is `100…200000` to improve depth precision in the wide room view. Intentional CRT noise and jitter remain enabled.

## Editing and verification

When rebuilding the model, preserve the surface-color UV channel and create a separate non-overlapping light UV channel. Geometry export alone does not update either texture. Labels belong on the actual case/key surfaces, not nearly coplanar floating geometry.

Run `npm install`, then `npm run dev` for the local preview or `npm run build` for a production build. `@types/node` is pinned to `18.11.18` for compatibility with the existing TypeScript toolchain.

Visual checks cover the wide room view, desk view, monitor close-up, keyboard legends, and clickable screen links.

## Wordmark source

The Robotron wordmark is based on [VEB Robotron.svg by O. Wolters, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:VEB_Robotron.svg), marked PD-textlogo there. The model number and other labels are set separately.
