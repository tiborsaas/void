/**
 * Factory Presets — decomposed from the original 8 monolithic scenes into
 * composable ScenePreset configs using the new layer system.
 */
import type {
  HydraLayer,
  PostProcessingLayer,
  ScenePreset,
  ShaderPlaneLayer,
} from "../types/layers";
import type { EffectPreset } from "../types";

// Shader imports — vite-plugin-glsl resolves #include directives at build time
import NEURAL_VERTEX from "../shaders/scenes/neural-vertex.glsl";
import NEURAL_FRAGMENT from "../shaders/scenes/neural-fragment.glsl";
import LIQUID_VERTEX from "../shaders/scenes/liquid-vertex.glsl";
import LIQUID_FRAGMENT from "../shaders/scenes/liquid-fragment.glsl";
import VOID_TUNNEL_FRAGMENT from "../shaders/scenes/void-tunnel-fragment.glsl";
import TERRAIN_FRAGMENT from "../shaders/scenes/terrain-fragment.glsl";
import PASSTHROUGH_VERTEX from "../shaders/scenes/passthrough-vertex.glsl";

// ═══════════════════════════════════════════════════════════════════════
// Hydra Synth layer factory
// ═══════════════════════════════════════════════════════════════════════

export function createHydraLayer(overrides?: Partial<HydraLayer>): HydraLayer {
  const id = `hydra-${Date.now()}`;
  return {
    id,
    type: "hydra",
    name: "Hydra Synth",
    visible: true,
    opacity: 1,
    blendMode: "additive",
    code: `osc(60, 0.1, 1.4)\n  .kaleid(4)\n  .color(0.9, 0.2, 0.8)\n  .out()`,
    projection: "plane",
    resolution: [1280, 720],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    rotationSpeed: [0, 0, 0],
    scale: 2,
    audioReactive: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Pure inline shaders (no #include — safe as template literals)
// ═══════════════════════════════════════════════════════════════════════

// ─── Membrane (Reaction-Diffusion) ────────────────────────────────────

const MEMBRANE_COMPUTE = /* glsl */ `
precision highp float;

uniform sampler2D uPrevState;
uniform vec2 uResolution;
uniform float uDeltaTime;
uniform float uBass;
uniform float uTreble;
uniform float uAmplitude;
uniform float uBeat;
uniform float uTime;
uniform float uFeedRate;
uniform float uKillRate;
uniform float uDiffuseA;
uniform float uDiffuseB;
uniform float uInjectStrength;
uniform float uAudioInject[8];

varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / uResolution;

  // Sample neighbours for Laplacian (5-point + diagonals with weights)
  vec4 center  = texture2D(uPrevState, vUv);
  vec4 left    = texture2D(uPrevState, vUv + vec2(-texel.x, 0.0));
  vec4 right   = texture2D(uPrevState, vUv + vec2( texel.x, 0.0));
  vec4 up      = texture2D(uPrevState, vUv + vec2(0.0,  texel.y));
  vec4 down    = texture2D(uPrevState, vUv + vec2(0.0, -texel.y));
  vec4 ul      = texture2D(uPrevState, vUv + vec2(-texel.x,  texel.y));
  vec4 ur      = texture2D(uPrevState, vUv + vec2( texel.x,  texel.y));
  vec4 dl      = texture2D(uPrevState, vUv + vec2(-texel.x, -texel.y));
  vec4 dr      = texture2D(uPrevState, vUv + vec2( texel.x, -texel.y));

  vec4 laplacian = -1.0 * center
    + 0.2 * (left + right + up + down)
    + 0.05 * (ul + ur + dl + dr);

  float A = center.r;
  float B = center.g;

  float lapA = laplacian.r;
  float lapB = laplacian.g;

  float feed = uFeedRate + uBass * 0.003;
  float kill = uKillRate + uTreble * 0.001;

  float reaction = A * B * B;
  float dt = uDeltaTime;

  float newA = A + (uDiffuseA * lapA - reaction + feed * (1.0 - A)) * dt;
  float newB = B + (uDiffuseB * lapB + reaction - (kill + feed) * B) * dt;

  // Audio injection: sprinkle B on beat
  float inject = 0.0;
  for (int i = 0; i < 4; i++) {
    float ix = uAudioInject[i * 2];
    float iy = uAudioInject[i * 2 + 1];
    float dist = length(vUv - vec2(ix, iy));
    inject += uInjectStrength * smoothstep(0.04, 0.0, dist);
  }
  newB = clamp(newB + inject, 0.0, 1.0);
  newA = clamp(newA, 0.0, 1.0);

  gl_FragColor = vec4(newA, newB, 0.0, 1.0);
}
`;

const MEMBRANE_DISPLAY = /* glsl */ `
precision highp float;

uniform sampler2D uState;
uniform float uHue;
uniform float uIntensity;
uniform float uBeat;

varying vec2 vUv;

vec3 hsvToRgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 state = texture2D(uState, vUv);
  float a = state.r;
  float b = state.g;

  // Map B concentration to a warm colour gradient
  float t = clamp(1.0 - (a - b), 0.0, 1.0);

  // Base hue: deep blue/teal through yellow/white depending on concentration
  float h = mix(0.6, 0.15, t) + uHue;
  float s = mix(0.2, 1.0, t);
  float v = mix(0.0, 1.0, pow(t, 0.8));

  // Beat brightens the field
  v = clamp(v + uBeat * 0.15, 0.0, 1.0);

  vec3 col = hsvToRgb(vec3(fract(h), s, v));
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

// --- GlitchMatrix Shader ---
const GLITCH_MATRIX_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uBass;
uniform float uTreble;
uniform float uAmplitude;
uniform float uBeat;
uniform float uHue;
uniform float uIntensity;
uniform float uSpeed;
uniform vec2 uResolution;
uniform float uColumns;
uniform float uTrailLength;
uniform float uCharDensity;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 res = uResolution;
  float aspect = res.x / res.y;
  float t = uTime;

  // Matrix rain columns
  float columns = uColumns;
  float colIdx = floor(uv.x * columns);
  float colPhase = hash(colIdx * 13.7) * 100.0;
  float speed = 0.5 + hash(colIdx * 7.3) * 1.5;
  float charY = fract(uv.y + t * speed + colPhase);
  float charIdx = floor(charY * uCharDensity);
  float charBright = pow(1.0 - charY, uTrailLength);

  // Random character flicker
  float flicker = step(0.5, hash2(vec2(colIdx, charIdx + floor(t * 10.0))));
  charBright *= 0.3 + flicker * 0.7;

  // Base green
  vec3 col = vec3(0.1, 0.8, 0.2) * charBright;

  // Hue shift
  float hueAngle = uHue * 6.28318;
  float cosH = cos(hueAngle);
  float sinH = sin(hueAngle);
  mat3 hueRot = mat3(
    0.299+0.701*cosH+0.168*sinH, 0.587-0.587*cosH+0.330*sinH, 0.114-0.114*cosH-0.497*sinH,
    0.299-0.299*cosH-0.328*sinH, 0.587+0.413*cosH+0.035*sinH, 0.114-0.114*cosH+0.292*sinH,
    0.299-0.300*cosH+1.250*sinH, 0.587-0.588*cosH-1.050*sinH, 0.114+0.886*cosH-0.203*sinH
  );
  col = hueRot * col;

  // RGB split on beat
  float split = uBeat * 0.01 + uAmplitude * 0.003;
  float r = col.r;
  if (split > 0.001) {
    vec2 uvR = uv + vec2(split, 0.0);
    float colIdxR = floor(uvR.x * columns);
    float charYR = fract(uvR.y + t * (0.5 + hash(colIdxR * 7.3) * 1.5) + hash(colIdxR * 13.7) * 100.0);
    r = pow(1.0 - charYR, 3.0) * 0.8;
  }
  col.r = r;

  // Scanlines
  float scan = 0.9 + 0.1 * sin(uv.y * res.y * 1.5);
  col *= scan;

  // Beat row flash
  float bassRow = step(0.98, hash2(vec2(floor(uv.y * 30.0), floor(t * 4.0)))) * uBass * 2.0;
  col += vec3(0.1, 0.5, 0.1) * bassRow;

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ═══════════════════════════════════════════════════════════════════════
// Factory Presets
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_EFFECTS: EffectPreset[] = [
  {
    name: "bloom",
    enabled: true,
    params: { intensity: 1.5, threshold: 0.6, radius: 0.8 },
  },
  { name: "chromatic", enabled: true, params: { offset: 0.002 } },
  { name: "vignette", enabled: true, params: { darkness: 0.7, offset: 0.3 } },
  { name: "noise", enabled: true, params: { opacity: 0.08 } },
];

// Helper: create a PostProcessingLayer from individual effect params
function ppLayer(
  opts: Partial<
    Omit<
      PostProcessingLayer,
      "id" | "type" | "name" | "visible" | "opacity" | "blendMode"
    >
  > = {},
): PostProcessingLayer {
  return {
    id: `post-processing-${Date.now()}-${
      Math.random().toString(36).slice(2, 6)
    }`,
    type: "post-processing",
    name: "Post FX",
    visible: true,
    opacity: 1,
    blendMode: "normal",
    bloomEnabled: opts.bloomEnabled ?? true,
    bloomIntensity: opts.bloomIntensity ?? 1.5,
    bloomThreshold: opts.bloomThreshold ?? 0.6,
    bloomRadius: opts.bloomRadius ?? 0.8,
    chromaticEnabled: opts.chromaticEnabled ?? true,
    chromaticOffset: opts.chromaticOffset ?? 0.002,
    vignetteEnabled: opts.vignetteEnabled ?? true,
    vignetteDarkness: opts.vignetteDarkness ?? 0.7,
    vignetteOffset: opts.vignetteOffset ?? 0.3,
    noiseEnabled: opts.noiseEnabled ?? true,
    noiseOpacity: opts.noiseOpacity ?? 0.08,
    audioReactive: opts.audioReactive ?? true,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Named shader layer factories — available in the layer picker
// ═══════════════════════════════════════════════════════════════════════

export function createVoidTunnelLayer(): ShaderPlaneLayer {
  return {
    id: `shader-plane-${Date.now()}`,
    type: "shader-plane",
    name: "Void Tunnel",
    visible: true,
    opacity: 1,
    blendMode: "normal",
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: VOID_TUNNEL_FRAGMENT,
    uniforms: {
      uTunnelRadius: {
        value: 3,
        min: 1,
        max: 8,
        step: 0.1,
        label: "Tunnel Radius",
      },
      uRepeatSize: {
        value: 4,
        min: 1,
        max: 8,
        step: 0.1,
        label: "Repeat Spacing",
      },
      uMarchSpeed: {
        value: 2,
        min: 0.5,
        max: 5,
        step: 0.1,
        label: "March Speed",
      },
    },
  };
}

export function createGlitchMatrixLayer(): ShaderPlaneLayer {
  return {
    id: `shader-plane-${Date.now()}`,
    type: "shader-plane",
    name: "Glitch Matrix",
    visible: true,
    opacity: 1,
    blendMode: "normal",
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: GLITCH_MATRIX_FRAGMENT,
    uniforms: {
      uColumns: { value: 60, min: 20, max: 120, step: 1, label: "Columns" },
      uTrailLength: {
        value: 3,
        min: 1,
        max: 8,
        step: 0.1,
        label: "Trail Length",
      },
      uCharDensity: {
        value: 40,
        min: 10,
        max: 80,
        step: 1,
        label: "Char Density",
      },
    },
  };
}

export function createTerrainLayer(): ShaderPlaneLayer {
  return {
    id: `shader-plane-${Date.now()}`,
    type: "shader-plane",
    name: "Terrain",
    visible: true,
    opacity: 1,
    blendMode: "normal",
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: TERRAIN_FRAGMENT,
    uniforms: {
      uTerrainScale: {
        value: 0.3,
        min: 0.1,
        max: 1,
        step: 0.01,
        label: "Terrain Scale",
      },
      uCameraHeight: {
        value: 3,
        min: 1,
        max: 10,
        step: 0.1,
        label: "Camera Height",
      },
      uFogDensity: {
        value: 0.03,
        min: 0.01,
        max: 0.1,
        step: 0.005,
        label: "Fog Density",
      },
      uFlySpeed: { value: 2, min: 0.5, max: 5, step: 0.1, label: "Fly Speed" },
    },
  };
}

export const factoryPresets: ScenePreset[] = [
  // 1. Neural Mesh
  {
    id: "neural-mesh",
    name: "Neural Mesh",
    layers: [
      {
        id: "neural-mesh-plane",
        type: "displaced-mesh",
        name: "Neural Grid",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        geometry: "plane",
        geometryArgs: [8, 8, 128, 128],
        vertexShader: NEURAL_VERTEX,
        fragmentShader: NEURAL_FRAGMENT,
        uniforms: {
          uNoiseScale: {
            value: 1.5,
            min: 0.1,
            max: 5,
            step: 0.1,
            label: "Noise Scale",
          },
          uDisplacement: {
            value: 0.8,
            min: 0,
            max: 3,
            step: 0.05,
            label: "Displacement",
          },
        },
        wireframe: false,
        rotation: [-0.5, 0, 0],
        rotationSpeed: [0, 0, 0],
        scale: 1,
        audioReactive: true,
      },
      {
        id: "neural-mesh-wire",
        type: "displaced-mesh",
        name: "Neural Wireframe",
        visible: true,
        opacity: 0.6,
        blendMode: "additive",
        geometry: "plane",
        geometryArgs: [8, 8, 128, 128],
        vertexShader: NEURAL_VERTEX,
        fragmentShader: NEURAL_FRAGMENT,
        uniforms: {
          uNoiseScale: {
            value: 1.5,
            min: 0.1,
            max: 5,
            step: 0.1,
            label: "Noise Scale",
          },
          uDisplacement: {
            value: 0.8,
            min: 0,
            max: 3,
            step: 0.05,
            label: "Displacement",
          },
        },
        wireframe: true,
        rotation: [-0.5, 0, 0],
        rotationSpeed: [0, 0, 0],
        scale: 1,
        audioReactive: true,
      },
      ppLayer(),
    ],
    effects: DEFAULT_EFFECTS,
    transition: { type: "crossfade", duration: 2.0 },
    tags: ["geometric", "organic", "hypnotic"],
    builtIn: true,
  },

  // 2. Particle Physics
  {
    id: "particle-physics",
    name: "Particle Physics",
    layers: [
      {
        id: "particles-main",
        type: "instanced-particles",
        name: "Particle Swarm",
        visible: true,
        opacity: 1,
        blendMode: "additive",
        count: 50000,
        size: 0.015,
        geometry: "sphere",
        colorMode: "velocity",
        color: "#ffffff",
        attractors: [
          { position: [0, 0, 0], strength: 0.5, radius: 2 },
          { position: [2, 1, -1], strength: 0.3, radius: 1.5 },
          { position: [-1, -2, 1], strength: 0.4, radius: 2 },
        ],
        damping: 0.02,
        maxSpeed: 0.5,
        audioReactive: true,
      },
      ppLayer({ bloomIntensity: 2.0, bloomThreshold: 0.3, bloomRadius: 0.9 }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 2.0, threshold: 0.3, radius: 0.9 },
      },
      ...DEFAULT_EFFECTS.slice(1),
    ],
    transition: { type: "dissolve", duration: 2.0 },
    tags: ["particles", "physics", "kinetic"],
    builtIn: true,
  },

  // 3. Void Tunnel
  {
    id: "void-tunnel",
    name: "Void Tunnel",
    layers: [
      {
        id: "tunnel-shader",
        type: "shader-plane",
        name: "Raymarched Tunnel",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        vertexShader: PASSTHROUGH_VERTEX,
        fragmentShader: VOID_TUNNEL_FRAGMENT,
        uniforms: {
          uTunnelRadius: {
            value: 3,
            min: 1,
            max: 8,
            step: 0.1,
            label: "Tunnel Radius",
          },
          uRepeatSize: {
            value: 4,
            min: 1,
            max: 8,
            step: 0.1,
            label: "Repeat Spacing",
          },
          uMarchSpeed: {
            value: 2,
            min: 0.5,
            max: 5,
            step: 0.1,
            label: "March Speed",
          },
        },
      },
      ppLayer({
        bloomIntensity: 2.0,
        bloomThreshold: 0.5,
        chromaticOffset: 0.003,
        vignetteDarkness: 0.8,
        vignetteOffset: 0.2,
        noiseOpacity: 0.06,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 2.0, threshold: 0.5, radius: 0.8 },
      },
      { name: "chromatic", enabled: true, params: { offset: 0.003 } },
      {
        name: "vignette",
        enabled: true,
        params: { darkness: 0.8, offset: 0.2 },
      },
      { name: "noise", enabled: true, params: { opacity: 0.06 } },
    ],
    transition: { type: "zoom-blur", duration: 2.5 },
    tags: ["tunnel", "raymarching", "immersive", "deep"],
    builtIn: true,
  },

  // 4. Liquid Metal
  {
    id: "liquid-metal",
    name: "Liquid Metal",
    layers: [
      {
        id: "liquid-mesh",
        type: "displaced-mesh",
        name: "Chrome Blob",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        geometry: "icosahedron",
        geometryArgs: [2, 64],
        vertexShader: LIQUID_VERTEX,
        fragmentShader: LIQUID_FRAGMENT,
        uniforms: {
          uNoiseScale: {
            value: 1.5,
            min: 0.5,
            max: 5,
            step: 0.1,
            label: "Noise Scale",
          },
          uDisplacement: {
            value: 1,
            min: 0.1,
            max: 3,
            step: 0.05,
            label: "Displacement",
          },
          uFresnelPower: {
            value: 3,
            min: 1,
            max: 8,
            step: 0.1,
            label: "Fresnel Power",
          },
        },
        wireframe: false,
        rotation: [0, 0, 0],
        rotationSpeed: [0.1, 0.15, 0.05],
        scale: 1,
        audioReactive: true,
      },
      ppLayer({
        bloomIntensity: 1.0,
        bloomThreshold: 0.7,
        bloomRadius: 0.6,
        chromaticOffset: 0.001,
        vignetteDarkness: 0.5,
        noiseOpacity: 0.04,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 1.0, threshold: 0.7, radius: 0.6 },
      },
      { name: "chromatic", enabled: true, params: { offset: 0.001 } },
      {
        name: "vignette",
        enabled: true,
        params: { darkness: 0.5, offset: 0.3 },
      },
      { name: "noise", enabled: true, params: { opacity: 0.04 } },
    ],
    transition: { type: "crossfade", duration: 2.0 },
    tags: ["chrome", "metallic", "organic", "smooth"],
    builtIn: true,
  },

  // 5. Glitch Matrix
  {
    id: "glitch-matrix",
    name: "Glitch Matrix",
    layers: [
      {
        id: "matrix-shader",
        type: "shader-plane",
        name: "Matrix Rain",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        vertexShader: PASSTHROUGH_VERTEX,
        fragmentShader: GLITCH_MATRIX_FRAGMENT,
        uniforms: {
          uColumns: { value: 60, min: 20, max: 120, step: 1, label: "Columns" },
          uTrailLength: {
            value: 3,
            min: 1,
            max: 8,
            step: 0.1,
            label: "Trail Length",
          },
          uCharDensity: {
            value: 40,
            min: 10,
            max: 80,
            step: 1,
            label: "Char Density",
          },
        },
      },
      ppLayer({
        bloomIntensity: 1.5,
        bloomThreshold: 0.4,
        bloomRadius: 0.7,
        chromaticOffset: 0.004,
        vignetteEnabled: false,
        noiseOpacity: 0.12,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 1.5, threshold: 0.4, radius: 0.7 },
      },
      { name: "chromatic", enabled: true, params: { offset: 0.004 } },
      { name: "noise", enabled: true, params: { opacity: 0.12 } },
    ],
    transition: { type: "glitch-cut", duration: 1.0 },
    tags: ["digital", "glitch", "matrix", "retro"],
    builtIn: true,
  },

  // 6. Sacred Geometry
  {
    id: "sacred-geometry",
    name: "Sacred Geometry",
    layers: [
      {
        id: "sacred-wireframes",
        type: "wireframe-geometry",
        name: "Sacred Polyhedra",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        shapes: [
          {
            shape: "icosahedron",
            radius: 2.5,
            detail: 1,
            color: "#7b5cff",
            rotationSpeed: [0.15, 0.2, 0.05],
          },
          {
            shape: "octahedron",
            radius: 1.8,
            detail: 0,
            color: "#ff5cab",
            rotationSpeed: [-0.1, 0.15, -0.08],
          },
          {
            shape: "dodecahedron",
            radius: 1.2,
            detail: 0,
            color: "#5cffab",
            rotationSpeed: [0.08, -0.12, 0.15],
          },
        ],
        beatScale: 0.4,
        audioReactive: true,
      },
      ppLayer({
        bloomIntensity: 2.0,
        bloomThreshold: 0.3,
        bloomRadius: 0.9,
        vignetteDarkness: 0.6,
        noiseOpacity: 0.06,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 2.0, threshold: 0.3, radius: 0.9 },
      },
      { name: "chromatic", enabled: true, params: { offset: 0.002 } },
      {
        name: "vignette",
        enabled: true,
        params: { darkness: 0.6, offset: 0.3 },
      },
      { name: "noise", enabled: true, params: { opacity: 0.06 } },
    ],
    transition: { type: "dissolve", duration: 2.5 },
    tags: ["geometric", "sacred", "wireframe", "minimal"],
    builtIn: true,
  },

  // 7. Terrain
  {
    id: "terrain",
    name: "Terrain",
    layers: [
      {
        id: "terrain-shader",
        type: "shader-plane",
        name: "Terrain Flyover",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        vertexShader: PASSTHROUGH_VERTEX,
        fragmentShader: TERRAIN_FRAGMENT,
        uniforms: {
          uTerrainScale: {
            value: 0.3,
            min: 0.1,
            max: 1,
            step: 0.01,
            label: "Terrain Scale",
          },
          uCameraHeight: {
            value: 3,
            min: 1,
            max: 10,
            step: 0.1,
            label: "Camera Height",
          },
          uFogDensity: {
            value: 0.03,
            min: 0.01,
            max: 0.1,
            step: 0.005,
            label: "Fog Density",
          },
          uFlySpeed: {
            value: 2,
            min: 0.5,
            max: 5,
            step: 0.1,
            label: "Fly Speed",
          },
        },
      },
      ppLayer({
        bloomIntensity: 0.8,
        bloomThreshold: 0.7,
        bloomRadius: 0.5,
        chromaticEnabled: false,
        vignetteDarkness: 0.8,
        vignetteOffset: 0.2,
        noiseOpacity: 0.05,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 0.8, threshold: 0.7, radius: 0.5 },
      },
      {
        name: "vignette",
        enabled: true,
        params: { darkness: 0.8, offset: 0.2 },
      },
      { name: "noise", enabled: true, params: { opacity: 0.05 } },
    ],
    transition: { type: "crossfade", duration: 3.0 },
    tags: ["landscape", "terrain", "atmospheric", "epic"],
    builtIn: true,
  },

  // 8. Membrane
  {
    id: "membrane",
    name: "Membrane",
    layers: [
      {
        id: "membrane-fbo",
        type: "fbo-simulation",
        name: "Reaction-Diffusion",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        size: 512,
        computeShader: MEMBRANE_COMPUTE,
        displayShader: MEMBRANE_DISPLAY,
        computeUniforms: {
          uFeedRate: {
            value: 0.055,
            min: 0.01,
            max: 0.1,
            step: 0.001,
            label: "Feed Rate",
          },
          uKillRate: {
            value: 0.062,
            min: 0.04,
            max: 0.08,
            step: 0.001,
            label: "Kill Rate",
          },
          uDiffuseA: { value: 1.0 },
          uDiffuseB: { value: 0.5 },
          uInjectStrength: { value: 0.5 },
        },
        displayUniforms: {},
        stepsPerFrame: 4,
        audioInject: true,
        seedPattern: "random-spots",
      },
      ppLayer({
        bloomIntensity: 1.0,
        bloomThreshold: 0.6,
        bloomRadius: 0.7,
        chromaticEnabled: false,
        vignetteDarkness: 0.5,
        noiseEnabled: false,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 1.0, threshold: 0.6, radius: 0.7 },
      },
      {
        name: "vignette",
        enabled: true,
        params: { darkness: 0.5, offset: 0.3 },
      },
    ],
    transition: { type: "dissolve", duration: 3.0 },
    tags: ["biological", "emergent", "organic", "atmospheric"],
    builtIn: true,
  },

  // 9. Disintegration (Hydra)
  {
    id: "disintegration",
    name: "Disintegration",
    layers: [
      {
        id: "disintegration-hydra",
        type: "hydra",
        name: "Disintegration",
        visible: true,
        opacity: 1,
        blendMode: "normal",
        // licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
        // by Ritchse — instagram.com/ritchse
        code: `osc(5,.1).modulate(noise(6),.22).diff(o0)
  .modulateScrollY(osc(2).modulate(osc().rotate(),.11))
  .scale(.72).color(0.99,1.014,1)
  .out()`,
        projection: "plane",
        resolution: [1280, 720],
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        rotationSpeed: [0, 0, 0],
        scale: 1,
        audioReactive: false,
      },
      ppLayer({
        bloomIntensity: 0.8,
        bloomThreshold: 0.5,
        bloomRadius: 0.6,
        chromaticEnabled: true,
        chromaticOffset: 0.002,
        vignetteDarkness: 0.6,
        vignetteOffset: 0.3,
        noiseOpacity: 0.05,
      }),
    ],
    effects: [
      {
        name: "bloom",
        enabled: true,
        params: { intensity: 0.8, threshold: 0.5, radius: 0.6 },
      },
      { name: "chromatic", enabled: true, params: { offset: 0.002 } },
      {
        name: "vignette",
        enabled: true,
        params: { darkness: 0.6, offset: 0.3 },
      },
      { name: "noise", enabled: true, params: { opacity: 0.05 } },
    ],
    transition: { type: "dissolve", duration: 2.5 },
    tags: ["hydra", "feedback", "glitch", "organic"],
    builtIn: true,
  },
];
