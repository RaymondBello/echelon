import { Renderer } from "../view/Renderer";
// import { Scene } from "../model/scene";

// Class App definition
export default class App {

    // Class properties
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    currTime: number;
    prevTime: number;
    running: boolean;
    
    // Class constructor
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.currTime = 0;
        this.prevTime = 0;
        this.running = false;
    }

    // Initialization method
    init() {
        this.renderer = new Renderer(this.canvas)
        this.running = true
    }

    // Run method
    run() {
        
        // Requesting animation frame
        requestAnimationFrame(this.run.bind(this));

        // Calculating time difference
        const currTime = performance.now();
        const delta = currTime - this.prevTime;

        // Updating renderer if running
        if (this.running) {
            this.renderer.update(delta)
        }

        // Updating previous time
        this.prevTime = currTime;
    }
}
