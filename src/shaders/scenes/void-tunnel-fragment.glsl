#include "../noise.glsl"
#include "../sdf.glsl"
#include "../common.glsl"
uniform float uTime;
uniform float uBass;
uniform float uTreble;
uniform float uAmplitude;
uniform float uBeat;
uniform float uHue;
uniform float uIntensity;
uniform float uSpeed;
uniform vec2 uResolution;
uniform float uTunnelRadius;
uniform float uRepeatSize;
uniform float uMarchSpeed;
varying vec2 vUv;

float map(vec3 p) {
  p.z += uTime * uMarchSpeed;
  vec3 rep = opRep(p, vec3(uRepeatSize, uRepeatSize, uRepeatSize));
  float columns = sdCylinder(rep, 2.0, 0.3 + uBass * 0.2);
  float twist = sin(p.z * 0.3 + uTime * 0.5) * 0.5;
  rep.xy = rot2(twist) * rep.xy;
  columns = min(columns, sdBox(rep, vec3(0.2 + uTreble * 0.3)));
  float warp = fbm(p * 0.5 + uTime * 0.1, 3, 2.0, 0.5) * uAmplitude * 2.0;
  float tunnel = -(length(p.xy) - uTunnelRadius - warp);
  return opSmoothUnion(columns, tunnel, 0.5);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;
  float camX = sin(uTime * 0.4) * (uRepeatSize * 0.35);
  float camY = sin(uTime * 0.27 + 1.2) * (uRepeatSize * 0.35);
  vec3 ro = vec3(camX, camY, uTime * uMarchSpeed);
  vec3 rd = normalize(vec3(uv, 1.0));
  float t = 0.0;
  for (int i = 0; i < 80; i++) {
    float d = map(ro + rd * t);
    if (d < 0.001 || t > 50.0) break;
    t += d * 0.8;
  }
  vec3 col = vec3(0.0);
  if (t < 50.0) {
    float fog = exp(-t * 0.05);
    float glow = 1.0 / (1.0 + t * t * 0.01);
    float hueT = uHue + t * 0.02 + uTime * 0.05;
    col = vec3(
      0.5 + 0.5 * cos(TAU * (hueT)),
      0.5 + 0.5 * cos(TAU * (hueT + 0.33)),
      0.5 + 0.5 * cos(TAU * (hueT + 0.67))
    );
    col *= glow * fog;
    col += uBeat * vec3(0.3, 0.1, 0.2) * glow;
  }
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
