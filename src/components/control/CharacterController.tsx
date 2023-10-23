
import {
    WebGLRenderer,
    PerspectiveCamera,
    OrthographicCamera,
    Scene,
    HemisphereLight,
    Vector3,
    Quaternion,
    Raycaster,
    PlaneGeometry,
    MeshBasicMaterial,
    Mesh,
    BoxGeometry,
    MeshPhongMaterial,
    Color,
    AnimationMixer,
    AnimationAction,
    LoadingManager
} from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CharacterControllerInput } from './CharacterControllerInput';
import { CharacterFSM } from './CharacterFSM';

export class CharacterControllerProxy {

    animations: any;

    constructor(animations: any) {
        this.animations = animations;
        // console.log(this.animations)
    }

    getAnimations() {
        return this.animations;
    }

};


export class CharacterController {

    params: {
        scene: Scene,
        camera: PerspectiveCamera | OrthographicCamera;
    }

    velocity: Vector3;
    decceleration: Vector3;
    acceleration: Vector3;
    position: Vector3;

    // Animations
    animations: {
        [name: string]: {
            clip: any,
            action: AnimationAction
    } } = {};
    
    input: CharacterControllerInput;
    mixer: AnimationMixer;
    manager: LoadingManager;

    stateMachine: CharacterFSM;

    target: any;

    constructor(params: any) {
        this.init(params);
    }

    init(params: {
        scene: Scene,
        camera: PerspectiveCamera | OrthographicCamera;
    }) {
        this.params = params;
        this.decceleration = new Vector3(-0.0005, -0.0001, -5.0);
        this.acceleration = new Vector3(1, 0.25, 50.0);
        this.velocity = new Vector3(0, 0, 0);
        this.position = new Vector3();
        
        this.animations = {}
        
        this.input = new CharacterControllerInput();
        this.stateMachine = new CharacterFSM(this.animations);

        this.loadModels();
    }

    loadModels() {

        const loader = new FBXLoader();

        loader.load('/models/mremireh_o_desbiens.fbx', (fbx) => {
        // loader.load('/models/anim/Walking.fbx', (fbx) => {
            fbx.scale.setScalar(0.05)
            fbx.traverse(c => {
                c.castShadow = true;
                c.receiveShadow = true;
            });

            this.target = fbx;
            this.params.scene.add(this.target);
            this.mixer = new AnimationMixer(this.target);

            this.manager = new LoadingManager();
            this.manager.onLoad = () => {
                this.stateMachine.SetState('idle');
            };

            const onLoad = (animName: string, anim: any) => {
                const clip = anim.animations[0];
                const action = this.mixer.clipAction(clip);

                this.animations[animName] = {
                    clip: clip,
                    action: this.mixer.clipAction(clip),
                };

                if (animName == 'dance') {
                    // action.play()
                }
            }

            const loader = new FBXLoader(this.manager);
            loader.load('/models/anim/walk.fbx', (a) => { onLoad('walk', a); });
            loader.load('/models/anim/run.fbx', (a) => { onLoad('run', a); });
            loader.load('/models/anim/idle.fbx', (a) => { onLoad('idle', a); });
            loader.load('/models/anim/dance.fbx', (a) => { onLoad('dance', a); });

            // loader.load('/models/anim/Walking.fbx', (a) => { onLoad('walking', a); });
        });
    }

    update(timeElapsedMilli: number) {

        if (!this.target) {
            return;
        }

        const timeInSeconds = timeElapsedMilli / 1000;

        this.stateMachine.Update(timeInSeconds, this.input);

        const velocity = this.velocity;
        const frameDecceleration = new Vector3(
            velocity.x * this.decceleration.x,
            velocity.y * this.decceleration.y,
            velocity.z * this.decceleration.z
        );
        frameDecceleration.multiplyScalar(timeInSeconds);
        frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
            Math.abs(frameDecceleration.z), Math.abs(velocity.z));

        velocity.add(frameDecceleration);

        const controlObject = this.target;
        const _Q = new Quaternion();
        const _A = new Vector3();
        const _R = controlObject.quaternion.clone();

        const acc = this.acceleration.clone();
        if (this.input.keys.shift) {
            acc.multiplyScalar(2.0);
        }

        if (this.stateMachine.currentState?.Name == 'dance') {
            acc.multiplyScalar(0.0);
        }

        if (this.input.keys.forward) {
            velocity.z += acc.z * timeInSeconds;
        }
        if (this.input.keys.backward) {
            velocity.z -= acc.z * timeInSeconds;
        }
        if (this.input.keys.left) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this.acceleration.y);
            _R.multiply(_Q);
        }
        if (this.input.keys.right) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this.acceleration.y);
            _R.multiply(_Q);
        }

        controlObject.quaternion.copy(_R);

        const oldPosition = new Vector3();
        oldPosition.copy(controlObject.position);

        const forward = new Vector3(0, 0, 1);
        forward.applyQuaternion(controlObject.quaternion);
        forward.normalize();

        const sideways = new Vector3(1, 0, 0);
        sideways.applyQuaternion(controlObject.quaternion);
        sideways.normalize();

        sideways.multiplyScalar(velocity.x * timeInSeconds);
        forward.multiplyScalar(velocity.z * timeInSeconds);

        controlObject.position.add(forward);
        controlObject.position.add(sideways);

        oldPosition.copy(controlObject.position);

        if (this.mixer) {
            this.mixer.update(timeInSeconds);
        }

        if (this.animations && this.stateMachine.currentState?.Name) {
            // console.log(this.stateMachine.currentState.Name);
            // console.log(this.animations[this.stateMachine.currentState.Name].action);
            // this.animations[this.stateMachine.currentState.Name].action.play();
        }


    }

}