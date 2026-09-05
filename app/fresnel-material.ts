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
 *
 * `uTilt`/`uSheen` add a tilt-driven highlight — light catching glass as the
 * device turns. It is a **lighting response, not motion**: the light direction
 * moves, nothing in the scene does, so it carries none of the vestibular
 * mismatch that 01-design-system.md's device-orientation parallax prohibition
 * is about, and that prohibition is untouched. `uSheen` defaults to 0, which
 * compiles to the same visual result as before the uniform existed — desktop,
 * reduced motion, and any device without an orientation sensor all render
 * byte-identically to the original material. See 01-design-system.md's
 * Tilt-reactive behaviours section.
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
        /** Viewer-space tilt, -1..1 per axis. Drive from the scene store. */
        uTilt: { value: new THREE.Vector2(0, 0) },
        /** 0 disables the highlight entirely. */
        uSheen: { value: 0 },
        uSheenColor: { value: new THREE.Color(palette.paperRaised) },
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
      uniform vec2 uTilt;
      uniform float uSheen;
      uniform vec3 uSheenColor;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);
        float core = 0.16;

        // Tilt moves the light, never the geometry. The z term keeps the
        // source in front of the shell so the highlight sweeps across the
        // face rather than orbiting out of sight; the CSS-style y flip is
        // because uTilt is handed over in viewer axes (+y down) while the
        // shader works in world axes (+y up).
        vec3 lightDir = normalize(vec3(uTilt.x, -uTilt.y, 0.75));
        float lambert = max(dot(vNormal, lightDir), 0.0);
        float sheen = pow(lambert, 4.0) * uSheen;

        // The glint has to be carried by *colour*, not by opacity. These
        // shells are a dark mask green at low alpha over a cream page, so
        // raising alpha alone makes the lit spot darker than the shell around
        // it — a smudge, not a highlight. Driving the colour almost all the
        // way to uSheenColor (which is lighter than the page itself) is what
        // makes it read as light catching glass; the alpha term only gives
        // that colour enough presence to be seen.
        vec3 lit = mix(color, uSheenColor, sheen * 0.92);
        float alpha = (fresnel * 0.9 + core + sheen * 0.38) * opacity;
        gl_FragColor = vec4(lit, alpha);
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
