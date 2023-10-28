
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
  LoadingManager,
  SkeletonHelper
} from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CharacterControllerInput } from './CharacterControllerInput';
import { FSMAnimation, FiniteStateMachine } from '../utils/FiniteStateMachine';
import { IdleState } from '@/components/utils/states/IdleState';
import { WalkState } from '@/components/utils/states/WalkState';
import { RunState } from '@/components/utils/states/RunState';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let new_variable = "Empty global";
let idleAction: AnimationAction, walkAction: AnimationAction, runAction: AnimationAction;
let actions = [];
let previousState: string;


export class CharacterController {
    params: {
        scene: Scene;
        camera: PerspectiveCamera | OrthographicCamera;
    };

    velocity: Vector3;
    deceleration: Vector3;
    acceleration: Vector3;
    position: Vector3;

  animations: { [key: string]: FSMAnimation } = {}

    input: CharacterControllerInput;
    mixer: AnimationMixer;
    manager: LoadingManager;

    stateMachine: FiniteStateMachine;

    target: any;

    constructor(params: any) {
        this.init(params);
    }

    init(params: {
        scene: Scene;
        camera: PerspectiveCamera | OrthographicCamera;
    }) {
        this.params = params;
        this.deceleration = new Vector3(-0.0005, -0.0001, -5.0);
      this.acceleration = new Vector3(1, 0.25, 59.0);
        this.velocity = new Vector3(0, 0, 0);
        this.position = new Vector3();

        this.animations = {};

      this.input = new CharacterControllerInput();

        this.stateMachine = new FiniteStateMachine();
        this.stateMachine.addState("idle", new IdleState(this.stateMachine));
        this.stateMachine.addState("walk", new WalkState(this.stateMachine));
        // this.stateMachine.addState("run", new RunState(this.stateMachine));

        this.loadModels();
    }

  loadModels() {

    const loader = new GLTFLoader()
    loader.load("/models/Soldier.glb", (gltf) => {

        gltf.scene.scale.set(7, 7, 7);
        this.target = gltf.scene;

        console.log(this.target)
        this.params.scene.add(this.target);

        this.target.traverse((object: any) => {
          if (object.isMesh) object.castShadow = true;
        })

        const skeleton = new SkeletonHelper(this.target);
        skeleton.visible = false;
        this.params.scene.add(skeleton);

        const animations = gltf.animations;
        this.mixer = new AnimationMixer(this.target);

        idleAction = this.mixer.clipAction(animations[0]);
        walkAction = this.mixer.clipAction(animations[3]);
        runAction = this.mixer.clipAction(animations[1]);

        this.stateMachine.addAnimation("idle", { action: idleAction, clip: animations[0] })
        this.stateMachine.addAnimation("walk", { action: walkAction, clip: animations[3] })
        this.stateMachine.addAnimation("run", { action: runAction, clip: animations[1] })

        actions = [idleAction, walkAction, runAction];

        this.stateMachine.SetState('idle');
        walkAction.enabled = false;
        runAction.enabled = false;
        idleAction.enabled = true;

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
            velocity.x * this.deceleration.x,
            velocity.y * this.deceleration.y,
            velocity.z * this.deceleration.z
        );
        frameDecceleration.multiplyScalar(timeInSeconds);
        frameDecceleration.z =
            Math.sign(frameDecceleration.z) *
            Math.min(Math.abs(frameDecceleration.z), Math.abs(velocity.z));

        velocity.add(frameDecceleration);

        const controlObject = this.target;
        const _Q = new Quaternion();
        const _A = new Vector3();
        const _R = controlObject.quaternion.clone();

        const acc = this.acceleration.clone();
        if (this.input.keys.shift) {
            acc.multiplyScalar(2.0);
        }

        if (this.stateMachine.currentState?.Name == "dance") {
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
            _Q.setFromAxisAngle(
                _A,
                4.0 * Math.PI * timeInSeconds * this.acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this.input.keys.right) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(
                _A,
                4.0 * -Math.PI * timeInSeconds * this.acceleration.y
            );
            _R.multiply(_Q);
        }

        controlObject.quaternion.copy(_R);

        const oldPosition = new Vector3();
        oldPosition.copy(controlObject.position);

      const forward = new Vector3(0, 0, -1);
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

    }
}