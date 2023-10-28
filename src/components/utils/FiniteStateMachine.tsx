import { CharacterControllerInput } from "@/components/control/CharacterControllerInput";
import { State } from "@/components/utils/states/State";

export type FSMAnimation = {
  clip: any;
  action: any;
};

export class FiniteStateMachine {
  states: { [key: string]: State } = {};
  animations: { [key: string]: FSMAnimation } = {};
  currentState: State;

  constructor() {
    this.states = {};
  }

  addState(name: string, newState: State) {
    this.states[name] = newState;
  }

  addAnimation(name: string, animation: FSMAnimation) {
    this.animations[name] = animation;
  }

  SetState(name: string) {
    const prevState = this.currentState;

    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    console.log(name);
    const state = this.states[name];

    this.currentState = state;
    this.currentState.Enter(prevState);
  }

  Update(timeElapsed: number, input: CharacterControllerInput) {
    if (this.currentState) {
      this.currentState.Update(timeElapsed, input);
    }
  }
}
