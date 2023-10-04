"use client";
import { useEffect, useRef, useState } from "react";

declare type GPUCanvasContext = any;

export default function WebGPUCanvas() {
  const [pageState, setPageState] = useState({ active: true });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

      const device = await adapter?.requestDevice();

      if (!pageState.active) return;
      if (!canvas) {
        console.error("canvas not defined");
        return;
      }

      // Configure the Canvas
      const context = canvas.getContext("webgpu") as GPUCanvasContext;

      const canvasFormat = gpuNavigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device: device,
        format: canvasFormat,
        alphaMode: "premultiplied",
      });

      // Canvas Dimensions and aspect ratio
      //   const devicePixelRatio = window.devicePixelRatio || 1;
      //   canvas.width = canvas.clientWidth * devicePixelRatio;
      //   canvas.height = canvas.clientHeight * devicePixelRatio;
      //   const presentationFormat = gpuNavigator.gpu.getPreferredCanvasFormat();

      // Clear the Canvas
      const encoder = device.createCommandEncoder();

      // Render Pass
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0.3, b: 0, a: 1 }, // New line
          },
        ],
      });

      // End render pass
      pass.end();

      // Finish the GPUCommandBuffer and immediately submit it to the GPU
      device.queue.submit([encoder.finish()]);

      // Visit https://codelabs.developers.google.com/your-first-webgpu-app#2
      //
    };

    // Call init function
    init();
  }, [pageState.active]);

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
