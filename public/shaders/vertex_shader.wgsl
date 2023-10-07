// This is where the shader code will be written
// The shader code is responsible for the graphical effects

struct VertexInput {
@location(0) pos: vec2f,
@builtin(instance_index) instance: u32,
};

struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) cell: vec2f, // New line!
};

@group(0) @binding(0) var<uniform> grid: vec2f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    
// Create a cell
let i = f32(input.instance);

// Calculate the x and y coordinates of the cell
let cellX = i % grid.x;
let cellY = floor(i / grid.y);

// Create a 2D vector for the cell
let cell = vec2f(cellX, cellY);

// Calculate the offset of the cell in the grid
let cellOffset = cell / grid * 2; 

// Add 1 to the position before dividing
// This is to ensure that the position is within the grid
let gridPos = (input.pos + 1) / grid -1 + cellOffset;

var output: VertexOutput;
output.pos = vec4(gridPos, 0, 1);
output.cell = cell;
return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
return vec4f(1, 0.5, 0.25, 1);
}