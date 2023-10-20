"use client";

import { useState, useEffect } from "react";
import App from "@/components/control/app";

export default function Home() {
  const [keys, setKeys] = useState({
    w: false,
    a: false,
    s: false,
    d: false,
    mouseLeft: false,
    mouseRight: false,
    mouseX: 0,
    mouseY: 0,
  });

  useEffect(() => {
    const canvas: HTMLCanvasElement = document.getElementById(
      "gfx-main"
    ) as HTMLCanvasElement;

    const app = new App(canvas);

    console.log("App created successfully");
    app.run();
  }, []);

  return (
    <main>
      <div className="flex min-h-screen ">
        {/* Canvas */}
        <div>
          <canvas
            id="gfx-main"
            className="absolute bg-gray-700 inset-0 w-full h-full"
            style={{ zIndex: -1 }}
          ></canvas>
        </div>

        {/* Controls */}
        <div className="flex">
          <div className="flex flex-col justify-end items-end">
            <button
              className="rounded-md px-2 bg-blue-600"
              onClick={() => {
                setKeys((prev) => {
                  return {
                    ...prev,
                    w: !prev.w,
                  };
                });
              }}
            >
              Profile
            </button>
          </div>

          <div className="flex flex-col justify-end items-end">
            <button
              className="rounded-md px-2 bg-green-600"
              onClick={() => {
                setKeys((prev) => {
                  return {
                    ...prev,
                    s: !prev.s,
                  };
                });
              }}
            >
              Chat
            </button>
          </div>

          <div>{JSON.stringify(keys)}</div>
        </div>
      </div>
    </main>
  );
}
