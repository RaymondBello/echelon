"use client";

import { useState, useEffect } from "react";
import App from "@/components/control/App";

export default function Home() {

  useEffect(() => {

    const canvas: HTMLCanvasElement = document.getElementById(
      "gfx-main"
    ) as HTMLCanvasElement;

    const app = new App(canvas);

    console.log("App created successfully");
    app.init();
    app.run();

  }, []);

  return (
    <main>
      <div className="flex flex-col">
        <div className="flex flex-col">

          {/* Canvas */}
          <div
            id="gfx-div"
            className="flex flex-col"
            // style={{ zIndex: -1 }}
          >
            <canvas
              id="gfx-main"
              // className="absolute bg-gray-700 inset-0 w-full h-full"
              className="bg-gray-700"
              width={800}
              height={700}
            ></canvas>
          </div>

          {/* Controls */}
          <div

            className="flex flex-row items-center justify-end bg-red-500 gap-x-1 p-1"
            style={{ zIndex: 1 }}
          >
            <button
              className="rounded-md px-2 bg-blue-600 hover:bg-red-500"
            >
              Profile
            </button>
            <button
              className="rounded-md px-2 bg-green-600 hover:bg-red-500"
            >
              Chat
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
