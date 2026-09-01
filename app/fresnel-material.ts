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
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uAmp;
      uniform float uSeed;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        float breathe =
            sin(position.x * 2.1 + uSeed       + uTime * 0.55)
          * sin(position.y * 1.7 + uSeed * 1.3 + uTime * 0.45)
          + 0.5 * sin(position.z * 2.6 + uSeed * 2.1 + uTime * 0.65);
        vec3 displaced = position + normal * (breathe * uAmp);
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
