import * as THREE from "three";
import { palette } from "@/lib/palette";

/**
 * Rim-lit translucent sphere with a soft inner core — the shared node
 * material for both the Phase 1 landing cluster and the constellation.
 * Factory, not a singleton: each scene gets its own instance so their
 * opacity uniforms can be driven independently.
 *
 * Fog support has to be wired in by hand — ShaderMaterial doesn't react to
 * scene fog unless the fog chunks and uniforms are included. The chunks are
 * no-ops (guarded by USE_FOG) when the scene has no fog, so the landing
 * cluster compiles the same shader unaffected.
 *
 * Low-frequency vertex displacement makes the silhouette breathe. Amplitude
 * is a fraction of the unit sphere radius, so displacement scales with the
 * mesh. At amplitude 0 (the default, used by the landing cluster and tech
 * nodes) the sphere stays perfect. Every instance shares one compiled
 * program — only uniform values differ — so per-node instances stay cheap.
 * Drive uTime externally each frame; leaving it still freezes the shape,
 * which is exactly what prefers-reduced-motion wants.
 */
export interface FresnelMaterialOptions {
  opacity?: number;
  /** Displacement amplitude as a fraction of the unit radius. 0 = perfect sphere. */
  displacementAmplitude?: number;
  /** Phase offset so neighbouring silhouettes don't breathe in sync. */
  seed?: number;
  /**
   * Shared clock for the displacement. Pass the same object to every
   * breathing material and advance `.value` once per frame — one write
   * drives them all. UniformsUtils.merge clones its inputs, so this is
   * re-attached after construction to keep the shared reference.
   */
  timeUniform?: { value: number };
}

export function createFresnelMaterial({
  opacity = 0.9,
  displacementAmplitude = 0,
  seed = 0,
  timeUniform,
}: FresnelMaterialOptions = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        color: { value: new THREE.Color(palette.mask) },
        opacity: { value: opacity },
        uTime: { value: 0 },
        uAmp: { value: displacementAmplitude },
        uSeed: { value: seed },
        uOpen: { value: 0 },
        uScrollPos: { value: 0 },
        uScrollLen: { value: 0 },
        uScrollFade: { value: 0 },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uAmp;
      uniform float uSeed;
      uniform float uOpen;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vShapeRim;
      varying vec2 vShapeXY;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        // Opening a node reshapes the node itself rather than swapping it for
        // something else: each vertex of the unit sphere is pushed out onto a
        // superellipsoid of the same direction, |x|^n + |y|^n + |z|^n = 1,
        // which at n = 6 is a rounded box. Computed here from the sphere
        // position rather than supplied as a morph target, because the sphere
        // is the only input it needs and a ShaderMaterial would otherwise have
        // to carry three.js morph chunks to read one.
        //
        // The normal is deliberately left as the sphere's. Flattened toward
        // the camera, sphere normals still point away at the silhouette and
        // toward the viewer across the face, which is exactly where the
        // fresnel term should be strong and weak — the opened node keeps its
        // rim and stays near-transparent in the middle.
        vec3 a = abs(position);
        float k = pow(pow(a.x, 6.0) + pow(a.y, 6.0) + pow(a.z, 6.0), -1.0 / 6.0);
        vec3 shape = mix(position, position * k, uOpen);

        // Distance from the face toward the silhouette, for the opened node.
        //
        // Flattening a sphere toward the camera destroys the fresnel term: the
        // normal matrix is an inverse-transpose, so squashing z makes every
        // normal point at the viewer and the rim-lit gradient collapses into
        // one flat wash. That is what made an opened node read as a slab of
        // colour rather than the same translucent thing it had been.
        //
        // The shape still knows where its own edge is, though. The mesh is
        // turned to face the camera when it opens, so the sphere's own z runs
        // along the view axis: |z| is 1 at the centre of the face and 0 all
        // the way around the outline. So the gradient is recovered from
        // geometry the flattening cannot touch.
        vShapeRim = 1.0 - abs(position.z);
        // The superellipsoid's own x and y. Once the node is opened it faces
        // the camera and is scaled evenly in these two axes, so they map
        // linearly onto the screen — which is what lets the fragment stage
        // place a scroll thumb at a real height up the wall.
        vShapeXY = shape.xy;
        // Breathing continues while open, and is meant to. An opened node is
        // still the node: its outline should keep drifting rather than settle
        // into a drawn rectangle. The displacement rides the mesh's own
        // non-uniform scale, so a wobble that is a few percent of a sphere's
        // radius stays a few percent of the opened panel's width — the same
        // amount of life at either size.
        float breathe =
            sin(position.x * 2.1 + uSeed       + uTime * 0.55)
          * sin(position.y * 1.7 + uSeed * 1.3 + uTime * 0.45)
          + 0.5 * sin(position.z * 2.6 + uSeed * 2.1 + uTime * 0.65);
        vec3 displaced = shape + normal * (breathe * uAmp);
        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform vec3 color;
      uniform float opacity;
      uniform float uOpen;
      uniform float uScrollPos;
      uniform float uScrollLen;
      uniform float uScrollFade;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying float vShapeRim;
      varying vec2 vShapeXY;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);
        // Opened, the edge gradient comes from the shape rather than from the
        // normals — see vShapeRim. Same falloff curve, so a node keeps the
        // gradient it had as a sphere instead of flattening into a flat field.
        float rim = mix(fresnel, pow(clamp(vShapeRim, 0.0, 1.0), 1.5), uOpen);
        // The centre thins further as it opens, because an opened node is
        // something to read *through*: the text wants to sit on --paper, not
        // on a tinted plate.
        float core = mix(0.16, 0.045, uOpen);
        float alpha = (rim * 0.9 + core) * opacity;

        // The scroll thumb, painted onto the right-hand wall.
        //
        // It exists only where the wall does: vShapeRim picks out the
        // silhouette and vShapeXY.x the right-hand side of it, so the
        // indicator fades away by itself wherever the outline turns away from
        // the viewer — at the corners, and anywhere the breathing pulls the
        // edge inward. That is the whole reason it is drawn here rather than
        // laid over the top as DOM, which could only ever float outside a
        // shape that had moved.
        // The strip is measured along the shaped x, not along vShapeRim.
        // Flattening collapses the whole front hemisphere onto the plate, so
        // the rim occupies almost no screen pixels and gating on it produced
        // either a sliver too thin to see or a wash across the entire
        // right-hand side. Shaped x maps linearly to screen x once the node is
        // camera-facing, so this is a strip of predictable width — about 4% of
        // the half-width — hugging the outline and fading inward.
        //
        // It also bounds itself vertically for free: on a superellipsoid the
        // edge only reaches x = 1 near the middle of the height, falling to
        // 0.88 by |y| = 0.9, so the mark simply stops before the corners
        // where the wall turns away.
        float wall = smoothstep(0.955, 0.995, vShapeXY.x);
        // Shaped y runs +1 at the top to -1 at the bottom; scroll runs 0 to 1.
        float along = (1.0 - vShapeXY.y) * 0.5;
        // Named halfLen because half is a reserved word in GLSL ES.
        float halfLen = uScrollLen * 0.5;
        float band =
          1.0 - smoothstep(halfLen, halfLen + 0.03, abs(along - uScrollPos));
        alpha += wall * band * uScrollFade * uOpen * 0.45;

        gl_FragColor = vec4(color, alpha);
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  if (timeUniform) material.uniforms.uTime = timeUniform;
  return material;
}
