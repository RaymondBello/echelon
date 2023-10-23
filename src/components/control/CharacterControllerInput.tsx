

export class CharacterControllerInput {

    // Object to hold the state of different keys
    keys: {
        // Boolean variables to control character movement
        forward: boolean;
        backward: boolean;
        left: boolean;
        right: boolean;
        // Boolean variables to control character actions
        space: boolean;
        shift: boolean;
    }

    // Constructor initializes the keys object
    constructor() {
        this.init();
    }

    // Method to initialize the keys object and add event listeners
    init() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            space: false,
            shift: false,
        };

        // Add event listeners for keydown and keyup events
        document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this.onKeyUp(e), false);

    }

    // Method to handle keydown events
    onKeyDown(event: any) {
        switch (event.keyCode) {
            case 87: // w
                this.keys.forward = true;
                // console.log('forwards')
                break;
            case 65: // a
                this.keys.left = true;
                // console.log('left')
                break;
            case 83: // s
                this.keys.backward = true;
                // console.log('backwards')
                break;
            case 68: // d
                this.keys.right = true;
                // console.log('right')
                break;
            case 32: // SPACE
                this.keys.space = true;
                break;
            case 16: // SHIFT
                this.keys.shift = true;
                break;
        }
    }

    // Method to handle keyup events
    onKeyUp(event: any) {
        switch (event.keyCode) {
            case 87: // w
                this.keys.forward = false;
                break;
            case 65: // a
                this.keys.left = false;
                break;
            case 83: // s
                this.keys.backward = false;
                break;
            case 68: // d
                this.keys.right = false;
                break;
            case 32: // SPACE
                this.keys.space = false;
                break;
            case 16: // SHIFT
                this.keys.shift = false;
                break;
        }
    }
}