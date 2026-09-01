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
 */
export function createFresnelMaterial(initialOpacity = 0.9) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        color: { value: new THREE.Color(palette.mask) },
        opacity: { value: initialOpacity },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
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
}
