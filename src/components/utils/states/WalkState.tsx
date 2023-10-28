import { CharacterControllerInput } from '@/components/control/CharacterControllerInput';
import { State } from "@/components/utils/states/State";

export class WalkState extends State {

    finishedCallback: CallableFunction;

    constructor(parent: any) {
        super(parent);
        this.parent = parent;
        this.Name = 'walk';
    }

    Enter(prevState: State) {
        const curAction = this.parent.animations['walk'].action;
        if (prevState) {
            const prevAction = this.parent.animations[prevState.Name].action;

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