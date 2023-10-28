
// import { shader } from "@/components/view/shaders/shaders.wgsl"
import React from 'react';
import { useEffect} from "react";
import { TriangleMesh } from "@/components/view/TriangleMesh";
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
    WebGLRenderer,
    PerspectiveCamera,
    Scene,
    HemisphereLight,
    Vector3,
    Raycaster,
    PlaneGeometry,
    MeshBasicMaterial,
    Mesh,
    BoxGeometry,
    MeshPhongMaterial,
    Color,
    Float32BufferAttribute,
    DirectionalLight
} from 'three';
import { CharacterController } from '../control/CharacterController';


export class Renderer{

    canvas: HTMLCanvasElement;
    engine: WebGLRenderer;
    hasPointerLock: boolean;
    camera: PerspectiveCamera;
    scene: Scene;
    controls: PointerLockControls;
    characterControls: CharacterController;

    raycaster: Raycaster;
    geometry: PlaneGeometry;
    material: MeshBasicMaterial;
    mesh: Mesh;

    objects: Array<any>;

    firstLoad: boolean;
    running: boolean = false;

    mixers: any[];


    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = new WebGLRenderer({ canvas: this.canvas });
        this.firstLoad = true;
        this.init()
    }

    init() {

        this.setupDevice();

        this.createAssets();

        this.applySettings();
    }

    setupDevice() {


        this.hasPointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

        const element = document.body;
        const gfxElement = document.getElementById("gfx-div");

        // Hook pointer lock state change events
        document.addEventListener('pointerlockchange', this.pointerLockChange, false);
        document.addEventListener('mozpointerlockchange', this.pointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', this.pointerLockChange, false);

        document.addEventListener('pointerlockerror', this.pointerLockError, false);
        document.addEventListener('mozpointerlockerror', this.pointerLockError, false);
        document.addEventListener('webkitpointerlockerror', this.pointerLockError, false);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);


        gfxElement?.addEventListener('click', (event) => {
            element.requestPointerLock = element.requestPointerLock || (element as any).mozRequestPointerLock || (element as any).webkitRequestPointerLock;
            element.requestPointerLock();
            console.log("Requested Pointer Lock")
        }, false);
    }

    createAssets() {

        // Set the field of view for the camera
        const fieldOfView = 110;

        // Create Camera & Scene
        this.camera = new PerspectiveCamera(fieldOfView, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 10, 15);
        this.scene  = new Scene();

        // var light = new HemisphereLight(0xeeeeff, 0x777788, 0.75);
        var light = new DirectionalLight(0xFFFFFF, 1.0);
        light.position.set(-100, 100, 100);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 4096;
        light.shadow.mapSize.height = 4096;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.left = 50;
        light.shadow.camera.right = -50;
        light.shadow.camera.top = 50;
        light.shadow.camera.bottom = -50;

        light.target.position.set(0, 0, 0);

        this.scene.add(light);

        this.controls = new PointerLockControls(this.camera, document.body);
        this.characterControls = new CharacterController({ camera: this.camera, scene: this.scene });

        this.scene.add(this.controls.getObject());

        // this.raycaster = new Raycaster(new Vector3(), new Vector3(0, - 1, 0), 0, 10);

        // floor
        this.geometry = new PlaneGeometry(2000, 2000, 100, 100);
        this.geometry.rotateX(- Math.PI / 2);
        // this.geometry.setAttribute('color', new Float32BufferAttribute({}, 3));

        const new_material = new MeshBasicMaterial({ color: 0xffffffff });
        this.mesh = new Mesh(this.geometry, new_material);
        this.scene.add(this.mesh);

        // Objects
        this.geometry = new BoxGeometry(20, 20, 20);

        for (let i = 0; i < 100; i++) {
            this.material = new MeshPhongMaterial()

            this.mesh = new Mesh(this.geometry, this.material);
            this.mesh.position.x = Math.floor(Math.random() * 20 - 10) * 20;
            this.mesh.position.y = Math.floor(Math.random() * 20) * 20 + 10;
            this.mesh.position.z = Math.floor(Math.random() * 20 - 10) * 20;

            this.scene.add(this.mesh);

            this.material.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75);

            this.objects?.push(this.mesh);
        }

    }
    
    applySettings() {

        // Setup Renderer
        this.engine.setClearColor(0xffffff);
        this.engine.setPixelRatio(window.devicePixelRatio);
        this.engine.setSize(window.innerWidth, window.innerHeight);

    }

    pointerLockError(event: any) {
        console.log('Seen Pointer lock error')
    }

    pointerLockChange(event: any) {
        console.log('Seen Pointer lock change')
    }

    onWindowResize() {
        // this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.engine.setSize(window.innerWidth, window.innerHeight);
    }

    update(timeElapsed: number) {

        this.engine.render(this.scene, this.camera);
        // console.log(1000/timeElapsed);

        if (this.characterControls) {
            this.characterControls.update(timeElapsed);
        }

        if (this.mixers) {
            this.mixers.map(m => m.update(timeElapsed));
        }


    }

}