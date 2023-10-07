"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

export default function WebGPUCanvas() {
  const [pageState, setPageState] = useState({ active: true });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Variables for emulator
  const GRID_SIZE = 100;

  // Fetch data using SWR
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, error } = useSWR('/api/readshaders', fetcher);

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
              clearValue: [0.1, 0.2, 0.5, 1.0], // New line
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
    <div className="space-y-5 items-center justify-between">
      <div className="relative flex justify-center place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
        <canvas
          ref={canvasRef}
          className="bg-red-100"
          width="512"
          height="512"
        ></canvas>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <p>
          {" "}
          Status (NOUBDIZC): {0x00}
          <br />
          Program Counter: {0x00}
          <br />A Reg: {0x00}
          <br />X Reg: {0x00}
          <br />Y Reg: {0x00}
          <br />
          Stack Pointer: {0x00}
          <br />
        </p>

        <p>
          Fetched: {0x00}
          <br />
          Opcode: {0x00}
          <br />
          Cycles: {0x00}
          <br />
          Temp: {0x00}
          <br />
          Address Absolute: {0x00}
          <br />
          Address Relative: {0x00}
          <br />
          Clock Count: {0x00}
        </p>

        <p>
          <button className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded">
            Single-step
          </button>
          <br />
          <button className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded">
            Start/Stop
          </button>
        </p>

        <p>
          <button className="bg-red-400 hover:bg-red-700 text-white py-2 px-4 rounded">
            Load ROM file
          </button>
          {" No file found..."}
          <br />
          <button className="bg-green-400 hover:bg-green-700 text-white py-2 px-4 rounded">
            Save
          </button>
        </p>
      </div>
    </div>
  );
}
