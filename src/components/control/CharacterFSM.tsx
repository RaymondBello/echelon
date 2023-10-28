import { FiniteStateMachine } from "../utils/FiniteStateMachine";
import { WalkState, IdleState, DanceState } from "../utils/States";


export class CharacterFSM extends FiniteStateMachine {
    constructor(proxy: any) {
        super();
        // this.proxy = proxy;
        this.Init();
    }

    Init() {
        // this.addState('idle', IdleState);
        // this.addState('walk', WalkState);
        // this.addState('run', RunState);
        // this.addState('dance', DanceState);
    }
};