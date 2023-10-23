import {
    LoopOnce
} from 'three';
import { FiniteStateMachine } from './FiniteStateMachine';
import { CharacterControllerInput } from '../control/CharacterControllerInput';

export class State {

    parent: FiniteStateMachine;

    Name: string;
    
    constructor(parent: any) {
        this.parent = parent;
    }


    Enter(prevState: State) { }
    Exit() { }
    Update(timeElapsed: number, input: CharacterControllerInput) { }
};

export class DanceState extends State {

    finishedCallback: CallableFunction;

    constructor(parent: any) {
        super(parent);

        // this.parent = parent;
        this.Name = 'dance';

        this.finishedCallback = () => {
            this.Finished();
        }
    }

    // get Name() {
    //     return 'dance';
    // }

    Enter(prevState: State) {
        const curAction = this.parent.proxy.animations['dance'].action;
        const mixer = curAction.getMixer();
        mixer.addEventListener('finished', this.finishedCallback);

        if (prevState) {
            const prevAction = this.parent.proxy.animations[prevState.Name].action;

            curAction.reset();
            curAction.setLoop(LoopOnce, 1);
            curAction.clampWhenFinished = true;
            curAction.crossFadeFrom(prevAction, 0.2, true);
            curAction.play();
        } else {
            curAction.play();
        }
    }

    Finished() {
        this.Cleanup();
        this.parent.SetState('idle');
    }

    Cleanup() {
        const action = this.parent.proxy.animations['dance'].action;

        // action.getMixer().removeEventListener('finished', this._CleanupCallback);
    }

    Exit() {
        this.Cleanup();
    }

    Update() {
    }
};

export class WalkState extends State {

    finishedCallback: CallableFunction;

    constructor(parent: any) {
        super(parent);
        // this.parent = parent;
        this.Name = 'walk';
    }

    // get Name() {
    //     return 'walk';
    // }

    Enter(prevState: State) {
        const curAction = this.parent.proxy.animations['walk'].action;
        if (prevState) {
            const prevAction = this.parent.proxy.animations[prevState.Name].action;

            curAction.enabled = true;

            if (prevState.Name == 'run') {
                const ratio = curAction.getClip().duration / prevAction.getClip().duration;
                curAction.time = prevAction.time * ratio;
            } else {
                curAction.time = 0.0;
                curAction.setEffectiveTimeScale(1.0);
                curAction.setEffectiveWeight(1.0);
            }

            curAction.crossFadeFrom(prevAction, 0.5, true);
            curAction.play();
        } else {
            curAction.play();
        }
    }

    Exit() {
    }

    Update(timeElapsed: number, input: CharacterControllerInput) {
        if (input.keys.forward || input.keys.backward) {
            if (input.keys.shift) {
                this.parent.SetState('run');
            }
            return;
        }

        this.parent.SetState('idle');
    }
};

export class IdleState extends State {


    constructor(parent: any) {
        super(parent);
        // this.parent = parent;
        this.Name = 'idle';
    }

    // get Name() {
    //     return 'idle';
    // }

    Enter(prevState: State) {
        // const idleAction = this.parent.proxy.animations['walk'].action;
        const idleAction = this.parent.proxy.animations['idle'].action;
        console.log(this.Name + ":" + idleAction);


        if (prevState) {
            const prevAction = this.parent.proxy.animations[prevState.Name].action;
            // idleAction.time = 0.0;
            // idleAction.enabled = true;
            // idleAction.setEffectiveTimeScale(1.0);
            // idleAction.setEffectiveWeight(1.0);
            // idleAction.crossFadeFrom(prevAction, 0.5, true);
            idleAction.play();

        } else {
            console.log(idleAction);

            idleAction.play();
        }
    }

    Exit() {
    }

    Update(timeElapsed: number, input: CharacterControllerInput) {
        if (input.keys.forward || input.keys.backward) {
            this.parent.SetState('walk');
        } else if (input.keys.space) {
            this.parent.SetState('dance');
        }
    }
};

