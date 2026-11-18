export const PDF_QUAD_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_unitPos; // 0..1

uniform mat3 u_clipMatrix;
uniform vec2 u_pageSize;

out vec2 v_uv;

void main() {
  vec2 worldPos = a_unitPos * u_pageSize;
  vec3 clip = u_clipMatrix * vec3(worldPos, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_unitPos;
}
`;

export const PDF_QUAD_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_tex;

out vec4 outColor;

void main() {
  outColor = texture(u_tex, v_uv);
}
`;
