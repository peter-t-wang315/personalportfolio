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
        // Breathing stands down as it opens: a silhouette that wobbles is
        // right for a floating node and wrong for something being read.
        float breathe =
            sin(position.x * 2.1 + uSeed       + uTime * 0.55)
          * sin(position.y * 1.7 + uSeed * 1.3 + uTime * 0.45)
          + 0.5 * sin(position.z * 2.6 + uSeed * 2.1 + uTime * 0.65);
        vec3 displaced = shape + normal * (breathe * uAmp * (1.0 - uOpen));
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
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);
        float core = 0.16;
        gl_FragColor = vec4(color, (fresnel * 0.9 + core) * opacity);
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
