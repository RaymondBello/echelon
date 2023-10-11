"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Bus from "./bus";

let nes = new Bus();





export default function WebGPUCanvas() {
  const [pageState, setPageState] = useState({ active: true });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Variables for emulator
  const GRID_SIZE = 16;

  // Fetch data using SWR
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error } = useSWR('/api/readshaders', fetcher);

  // Create hex expression function
  const toHexExpression = (num: number) => {
    const hex = num.toString(16).toUpperCase();
    return num <= 0xFF ? `0x${hex}` : `0x${hex}`;
  };

  // Emulation state variable
  const [emuState, setEmuStage] = useState({
    status_reg: 0x00,
    pc: 0x0000,
    a_reg: 0x00,
    x_reg: 0x00,
    y_reg: 0x00,
    stkp: 0x00,
    fetched: 0x00,
    opcode: "",
    cycles: 0x00,
    temp: 0x00,
    addr_abs: 0x00,
    addr_rel: 0x00,
    clock_cnt: 0x00
  });


  // This function resets the CPU and updates the emulation state
  const reset_cpu = () => {
    nes.cpu.reset();

    // update the emulation state with the current CPU state
    setEmuStage(prevState => ({
      ...prevState,
      status_reg: nes.cpu.status, // update the status register
      pc: nes.cpu.pc, // update the program counter
      a_reg: nes.cpu.a, // update the accumulator register
      x_reg: nes.cpu.x, // update the x register
      y_reg: nes.cpu.y, // update the y register
      stkp: nes.cpu.stkp, // update the stack pointer
      fetched: nes.cpu.fetched, // update the fetched value
      opcode: nes.cpu.lookup[nes.cpu.opcode].name, // update the current opcode
      cycles: nes.cpu.cycles, // update the number of cycles remaining
      temp: nes.cpu.temp, // update the temporary variable
      addr_abs: nes.cpu.addr_abs, // update the absolute address
      addr_rel: nes.cpu.addr_rel, // update the relative address
      clock_cnt: nes.cpu.clock_count // update the clock count
    }));
  }


  // This function clocks the CPU and updates the emulation state
  const clock_cpu = () => {

    // Clock the CPU
    nes.cpu.clock(); // increment the clock count 

    // Clock the CPU for the remaining cycles
    while (nes.cpu.cycles > 0) {
      nes.cpu.clock(); // increment the clock count 
    }

    // update the emulation state with the current CPU state
    setEmuStage(prevState => ({
      ...prevState,
      status_reg: nes.cpu.status, // update the status register
      pc: nes.cpu.pc, // update the program counter
      a_reg: nes.cpu.a, // update the accumulator register
      x_reg: nes.cpu.x, // update the x register
      y_reg: nes.cpu.y, // update the y register
      stkp: nes.cpu.stkp, // update the stack pointer
      fetched: nes.cpu.fetched, // update the fetched value
      opcode: nes.cpu.lookup[nes.cpu.opcode].name, // update the current opcode
      cycles: nes.cpu.cycles, // update the number of cycles remaining
      temp: nes.cpu.temp, // update the temporary variable
      addr_abs: nes.cpu.addr_abs, // update the absolute address
      addr_rel: nes.cpu.addr_rel, // update the relative address
      clock_cnt: nes.cpu.clock_count // update the clock count
    }));

  }


  if (data && data.shaderData) {
    // Create NES Bus

    // Load Program (assembled at https://www.masswerk.at/6502/assembler.html)
    ////////
    // *=$8000
    // LDX #10
    // STX $0000
    // LDX #3
    // STX $0001
    // LDY $0000
    // LDA #0
    // CLC
    // loop
    // ADC $0001
    // DEY
    // BNE loop
    // STA $0002
    // NOP
    // NOP
    // NOP
    //////
    const src = "A2 0A 8E 00 00 A2 03 8E 01 00 AC 00 00 A9 00 18 6D 01 00 88 D0 FA 8D 02 00 EA EA EA";
    const srcArray = new Uint8Array(src.split(" ").map((hex) => parseInt(hex, 16)));
    const nOffset = 0x8000;

    // Load program into RAM
    for (let i = 0; i < srcArray.length; i++) {
      nes.ram[nOffset + i] = srcArray[i];
    }

    // Set Reset Vector
    nes.ram[0xFFFC] = 0x00;
    nes.ram[0xFFFD] = 0x80;

    // Dont forget to set IRQ and NMI vectors if you want to play with those

    // Extract dissassembly
    // mapAsm = nes.cpu.disassemble(0x0000, 0xFFFF);

    // Reset
    // nes.cpu.reset();

    // Clock the CPU
    // nes.cpu.clock();
    // nes.cpu.clock();
    // nes.cpu.clock();



  }


  // Use effect to setup initial canvas
  useEffect(() => {
    const canvas = canvasRef.current;

    const init = async () => {
      interface GPUNavigator extends Navigator {
        gpu: any;
      }

      const gpuNavigator = navigator as GPUNavigator;
      if (!gpuNavigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
      }

      // Request an adapter and device
      const adapter = await gpuNavigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
      }

      // Request a device from the adapter
      const device = await adapter?.requestDevice();

      // If the page is not active, return immediately
      if (!pageState.active) return;

      // If the canvas is not defined, log an error and return
      if (!canvas) {
        console.error("canvas not defined");
        return;
      }

      if (error) {
        console.error('could not load shaders', error);
        return;
      }
      else if (data) {
        console.log('success: loaded shader', data);
      }

      // Configure the Canvas
      const context = canvas.getContext("webgpu") as GPUCanvasContext;

      const canvasFormat = gpuNavigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device: device,
        format: canvasFormat,
        alphaMode: "premultiplied",
      });


      // Steps to implement a WebGPU render pipeline
      // 1. Define the shader stages (vertex and fragment shaders)
      const vertices = new Float32Array([
        // X, Y
        -1, -1, // Triangle 1
        1, -1,
        1, 1,

        -1, -1, // Triangle 2
        1, 1,
        -1, 1,
      ]);


      // Create a buffer for the vertices
      const vertexBuffer = device.createBuffer({
        label: "Cell vertices", // Label for the buffer
        size: vertices.byteLength, // Size of the buffer based on the vertices data
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Usage of the buffer
      });

      // Write the vertices data into the buffer
      device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);


      // Create a uniform buffer that describes the grid.
      // This buffer will be used to store data that remains constant across multiple draw calls.
      // In this case, it's the size of the grid.
      const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
      const uniformBuffer = device.createBuffer({
        label: "Grid Uniforms", // Label for the buffer
        size: uniformArray.byteLength, // Size of the buffer based on the uniformArray data
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // Usage of the buffer
      });
      // Write the uniform data into the buffer
      // This data will be used by the GPU when rendering the grid.
      device.queue.writeBuffer(uniformBuffer, 0, uniformArray);



      // Create an array representing the active state of each cell.
      const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

      // // Populate the grid cell state array using the color bars seen on TVs when connecting.
      // // Each color bar is represented by a unique number.
      // // Define an array of color bars, each represented by a unique number.
      // const colorBars = [1, 2, 3, 4, 5, 6, 7];

      // // Initialize the index of the current color bar to 0.
      // let colorBarIndex = 0;

      // // Loop through each cell in the cell state array.
      // for (let i = 0; i < cellStateArray.length; i++) {
      //   // Set the value of the current cell to the value of the current color bar.
      //   cellStateArray[i] = colorBars[colorBarIndex];

      //   // Increment the index of the current color bar, wrapping around to 0 if necessary.
      //   colorBarIndex = (colorBarIndex + 1) % colorBars.length;
      // }

      for (let i = 0; i < cellStateArray.length; i += 1) {
        cellStateArray[i] = i % GRID_SIZE;
      }

      // console.log(cellStateArray);

      // Create a storage buffer to hold the cell state.
      const cellStateStorage = device.createBuffer({
        label: "Cell State",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(cellStateStorage, 0, cellStateArray);



      // Create a shader module for the device
      // NOTE: This is only be done after the shaders are read
      // and are not undefined
      if (data && data.shaderData) {

        const cellShaderModule = device.createShaderModule({
          label: "Cell Shader",
          code: data.shaderData
        });


        // 2. Define the layout of the pipeline (input and output formats, etc.)
        const vertexBufferLayout = {
          arrayStride: 8,
          attributes: [
            {
              format: "float32x2",
              offset: 0,
              shaderLocation: 0, // Position, see vertex shader
            },
          ],
        };

        // 3. Create the pipeline using the device and the defined layout and shaders
        const cellPipeline = device.createRenderPipeline({
          label: "Cell pipeline",
          layout: "auto",
          vertex: {
            module: cellShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout],
          },
          fragment: {
            module: cellShaderModule,
            entryPoint: "fragmentMain",
            targets: [
              {
                format: canvasFormat,
              },
            ],
          },
        });

        const bindGroup = device.createBindGroup({
          label: "Cell renderer bind group",
          layout: cellPipeline.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: { buffer: uniformBuffer },
            },
            {
              binding: 1,
              resource: { buffer: cellStateStorage },
            }
          ],
        });


        // 4. Create a command encoder
        // Canvas Dimensions and aspect ratio
        //   const devicePixelRatio = window.devicePixelRatio || 1;
        //   canvas.width = canvas.clientWidth * devicePixelRatio;
        //   canvas.height = canvas.clientHeight * devicePixelRatio;
        //   const presentationFormat = gpuNavigator.gpu.getPreferredCanvasFormat();

        // Clear the Canvas
        const encoder = device.createCommandEncoder();


        // 5. Begin a render pass with the command encoder
        // Render Pass
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: "clear",
              storeOp: "store",
              clearValue: [0.3, 0.2, 0.1, 1.0], // New line
            },
          ],
        });


        // 6. Set the pipeline for the render pass
        pass.setPipeline(cellPipeline); // Set the pipeline for the render pass
        pass.setVertexBuffer(0, vertexBuffer); // Set the vertex buffer

        pass.setBindGroup(0, bindGroup); // Set the bind group


        // 7. Draw commands
        pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // 6 vertices


        // 8. End the render pass
        pass.end();


        // 9. Finish encoding commands
        // 10. Submit the command buffer to the device's queue for execution
        // Finish the GPUCommandBuffer and immediately submit it to the GPU
        device.queue.submit([encoder.finish()]);

      }

      // Visit https://codelabs.developers.google.com/your-first-webgpu-app#2
    };

    // Call init function
    init();
  }, [pageState.active && data]);





  return (
    <div className="lg:flex lg:space-x-5 lg:space-y-0 space-y-5 items-center justify-between">

      <div className="relative flex justify-center place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
        <canvas
          ref={canvasRef}
          className="bg-red-100"
          width="512"
          height="512"
        ></canvas>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-1 lg:text-left">
        {/* Explanation of Tailwind CSS classes:
        "mb-32": Margin bottom of 8rem
        "grid": Sets the display to grid
        "text-center": Centers the text
        "lg:max-w-5xl": On large screens, sets the maximum width to 80rem
        "lg:w-full": On large screens, sets the width to 100%
        "lg:mb-0": On large screens, sets the margin bottom to 0
        "lg:grid-cols-4": On large screens, sets the grid to have 4 columns
        "lg:text-left": On large screens, aligns the text to the left */}

        <div>
          <button className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded" onClick={() => clock_cpu()}>
            Single-step
          </button>
          <button className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded">
            Start/Stop
          </button>
          <button className="bg-blue-500 hover:bg-red-700 text-white py-2 px-4 rounded" onClick={() => reset_cpu()}>
            Reset
          </button>
          <br />

          <button className="bg-red-400 hover:bg-red-700 text-white py-2 px-4 rounded">
            Load ROM file
          </button>
          {" No file found... "}
          <button className="bg-green-400 hover:bg-green-700 text-white py-2 px-4 rounded">
            Save
          </button>

          
        </div>


        <div className="tabs-container">

          <ul aria-labelledby="tabs-title">
            <li><a id="tab-1" href="#variables"> Variables </a></li>
            <li><a id="tab-2" href="#disassembler"> Disassembler </a></li>
            <li><a id="tab-4" href="#textures"> Textures </a></li>
            <li><a id="tab-3" href="#settings"> Settings </a></li>
          </ul>

          <div className="tabs__panels flow">
            <div id="variables" aria-labelledby="tab-1">
              <p>This is some random text.1</p>

            </div>

            <div id="disassembler" aria-labelledby="tab-2">
              <br />
              Status (NOUBDIZC): {"0x" + emuState.status_reg.toString(16).toUpperCase()}

              <br />A Register: {toHexExpression(emuState.a_reg)}
              <br />X Register: {toHexExpression(emuState.x_reg)}
              <br />Y Register: {toHexExpression(emuState.y_reg)}
              <br />
              Stack Pointer: {toHexExpression(emuState.stkp)}
              <br />
              Fetched: {toHexExpression(emuState.fetched)}
              <br />
              PC: {toHexExpression(emuState.pc)}
              <br />
              Opcode: {emuState.opcode}
              <br />
              Cycles: {emuState.cycles}
              <br />
              Temp: {toHexExpression(emuState.temp)}
              <br />
              Address Absolute: {toHexExpression(emuState.addr_abs)}
              <br />
              Address Relative: {toHexExpression(emuState.addr_rel)}
              <br />
              Clock Count: {emuState.clock_cnt}

            </div>

            <div id="textures" aria-labelledby="tab-3">
              <p>This is some random text.2</p>

            </div>

            <div id="settings" aria-labelledby="tab-4">
              <p>This is some random text.3</p>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
