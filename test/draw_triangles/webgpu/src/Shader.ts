const vertexShader = `
struct Uniforms {
  modelMatrix: mat4x4<f32>
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex
fn main(@location(0) aVertexPosition:vec3<f32>) -> @builtin(position) vec4<f32> {
    return uniforms.modelMatrix * vec4<f32>(aVertexPosition, 1.0);
}
`;

const fragmentShader = `
struct Colors {
  color: vec3<f32>
};

@group(1) @binding(0) var<uniform> colors : Colors;

@fragment
fn main(@builtin(position) coord_in: vec4<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(colors.color, 1.0);
}
`;

export { vertexShader, fragmentShader };
