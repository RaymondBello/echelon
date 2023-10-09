// This is where the shader code will be written
// The shader code is responsible for the graphical effects

struct VertexInput {
    @location(0) pos: vec2f,
    @builtin(instance_index) instance: u32,
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) cell: vec2f, 
    @location(1) cellColor: vec4f,
};

@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage> cellState: array<u32>; 

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    
    let state = f32(cellState[input.instance]); 

    // Expand 32bit into 4 channels R, G, B, A
    let index = cellState[input.instance];

    let red   = f32(index / 8);
    let green = f32(index / 8);
    let blue  = f32(index / 8);
    let alpha = f32(index / 8);

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
    output.cellColor = vec4f(red, green, blue, alpha);
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {

    // return vec4f(input.pos, 0, 1);
    let color = input.cell / grid;

    let cellColor = vec4f(input.cellColor.x, input.cellColor.y, input.cellColor.z, 1);

    let colorr = vec4f(1,0,0,1);

    // return input.cellColor;
    // return colorr;
    return vec4f(color, 1-color.x, 1);
}