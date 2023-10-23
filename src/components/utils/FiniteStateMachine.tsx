import { CharacterControllerInput } from "../control/CharacterControllerInput";
import { State } from "./States";


export class FiniteStateMachine {

    states: { [stateName: string]: any; } = {};
    currentState: State | null;
    proxy: any;

    constructor() {
        this.states = {};
        this.currentState = null;
    }

    addState(name: string, type: any) {
        this.states[name] = type;
    }

    SetState(name:string) {
        const prevState = this.currentState;

        if (prevState) {
            if (prevState.Name == name) {
                return;
            }
            prevState.Exit();
        }

        console.log(name)
        const state = new this.states[name](this);

        this.currentState = state;
        state.Enter(prevState);
    }

    Update(timeElapsed: number, input: CharacterControllerInput) {
        if (this.currentState) {
            this.currentState.Update(timeElapsed, input);
        }
    }
};