export const LINE_INSTANCED_VERT = `#version 300 es
precision highp float;

// Quad corner: (0..1 along line, -0.5..+0.5 perpendicular)
layout(location = 0) in vec2 a_quad;

// Per-instance attributes
layout(location = 1) in vec2 a_p1;
layout(location = 2) in vec2 a_p2;
layout(location = 3) in vec4 a_color;
layout(location = 4) in float a_width;
layout(location = 5) in float a_screenSpace;
layout(location = 6) in vec2 a_dash; // (dashLen, gapLen)

uniform mat3 u_clipMatrix;
uniform float u_zoom;

out vec4 v_color;
out float v_distAlong;
out vec2 v_dash;

void main() {
  vec2 dir = a_p2 - a_p1;
  float len = max(length(dir), 0.0001);
  vec2 tangent = dir / len;
  vec2 normal = vec2(-tangent.y, tangent.x);

  float worldWidth = a_screenSpace > 0.5 ? (a_width / max(u_zoom, 0.01)) : a_width;
  vec2 worldPos = a_p1 + tangent * (a_quad.x * len) + normal * (a_quad.y * worldWidth);

  vec3 clip = u_clipMatrix * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);

  v_color = a_color;
  v_distAlong = a_quad.x * len * u_zoom;
  v_dash = a_dash;
}
`;

export const LINE_INSTANCED_FRAG = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_distAlong;
in vec2 v_dash;

out vec4 outColor;

void main() {
  if (v_dash.x > 0.0 && v_dash.y > 0.0) {
    float cycle = v_dash.x + v_dash.y;
    float m = mod(v_distAlong, cycle);
    if (m > v_dash.x) {
      discard;
    }
  }
  outColor = v_color;
}
`;
