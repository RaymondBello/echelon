import { CharacterControllerInput } from '@/components/control/CharacterControllerInput';
import { State } from "@/components/utils/states/State";

export class IdleState extends State {


    constructor(parent: any) {
        super(parent);
        this.parent = parent;
        this.Name = 'idle';
    }

    Enter(prevState: State) {
        const idleAction = this.parent.animations['idle'].action;

        if (prevState) {
            const prevAction = this.parent.animations[prevState.Name].action;
            idleAction.time = 0.0;
            idleAction.enabled = true;
            idleAction.setEffectiveTimeScale(1.0);
            idleAction.setEffectiveWeight(1.0);
            idleAction.crossFadeFrom(prevAction, 0.5, true);
            idleAction.play();
        } else {
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