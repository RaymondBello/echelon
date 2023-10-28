import { FiniteStateMachine } from '@/components/utils/FiniteStateMachine';
import { CharacterControllerInput } from '@/components/control/CharacterControllerInput';

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