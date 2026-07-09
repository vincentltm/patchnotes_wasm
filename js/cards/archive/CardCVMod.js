class CardCVMod extends ComputerCard {
    static meta = {
        id: 'cvmod',
        name: 'CV Mod',
        num: '14',
        desc: "Simulates a loop of tape (up to 8s) with 4 read heads.\n\nKnob Main: Speed of read heads (Center = 1x)\nKnob X: Loop Duration\nKnob Y: Phase Offset\nSwitch: Up=Toggle Mode, Down=Reset Positions",
    };

    constructor(ctx, io) {
        super(ctx, io);
        if (!ctx) return;

        try {
            this.worklet = new AudioWorkletNode(ctx, 'cvmod-processor', {
                numberOfInputs: 6,
                numberOfOutputs: 6,
                outputChannelCount: [1, 1, 1, 1, 1, 1],
                parameterData: {
                    knobMain: 0.5,
                    knobX: 0.5,
                    knobY: 0.5,
                    switchState: 1 // 0=Down (Reset), 1=Mid, 2=Up (Toggle)
                }
            });
        } catch (e) {
            console.error("CVMod Worklet Error:", e);
            return;
        }

        this.worklet.port.onmessage = (e) => {
            this.updateLEDs(e.data);
        };

        // Params
        this.pMain = this.worklet.parameters.get('knobMain');
        this.pX = this.worklet.parameters.get('knobX');
        this.pY = this.worklet.parameters.get('knobY');
        this.pSwitch = this.worklet.parameters.get('switchState');
    }

    mount() {
        super.mount();
        if (!this.worklet) return;

        // IO Mapping
        // Inputs: 0:L(Rec), 1:R(Speed), 2:CV1(Time), 3:CV2(Phase), 4:P1, 5:P2
        this.io.inputL.connect(this.worklet, 0, 0); // Audio 1 In (Record)
        this.io.inputR.connect(this.worklet, 0, 1); // Audio 2 In (Speed Mod)
        this.io.cv1In.connect(this.worklet, 0, 2);  // CV 1 In (Time Mod)
        this.io.cv2In.connect(this.worklet, 0, 3);  // CV 2 In (Phase Mod)
        this.io.pulse1In.connect(this.worklet, 0, 4); // Reset Pulse
        this.io.pulse2In.connect(this.worklet, 0, 5); // Toggle Pulse

        // Outputs
        // 0:A1(Head1), 1:A2(Head2), 2:CV1(Head3), 3:CV2(Head4), 4:P1, 5:P2
        this.worklet.connect(this.io.outputL, 0);
        this.worklet.connect(this.io.outputR, 1);
        this.worklet.connect(this.io.cv1Out, 2);
        this.worklet.connect(this.io.cv2Out, 3);
        // this.worklet.connect(this.io.pulse1Out, 4); 
        // this.worklet.connect(this.io.pulse2Out, 5); 
    }

    unmount() {
        super.unmount();
        if (!this.worklet) return;
        this.worklet.disconnect();

        this.io.inputL.disconnect(this.worklet, 0, 0);
        this.io.inputR.disconnect(this.worklet, 0, 1);
        this.io.cv1In.disconnect(this.worklet, 0, 2);
        this.io.cv2In.disconnect(this.worklet, 0, 3);
        this.io.pulse1In.disconnect(this.worklet, 0, 4);
        this.io.pulse2In.disconnect(this.worklet, 0, 5);
    }

    update(p, time) {
        if (!this.worklet) return;

        this.pMain.setTargetAtTime(p.main, time, 0.02);
        this.pX.setTargetAtTime(p.x, time, 0.02);
        this.pY.setTargetAtTime(p.y, time, 0.02);

        // Switch mapping
        // UI: 0=Up, 1=Mid, 2=Down
        // C++: Up=Trigger Function, Down=Reset, Middle=Nothing
        // My Logic: 2=Up (Toggle), 1=Mid, 0=Down (Reset)
        // Wait, p.switch from UI is usually 0=Up, 1=Mid, 2=Down.
        // Let's pass it raw and handle in worklet.
        // C++: Up (2) -> Next Func. Down (0) -> Reset.
        this.pSwitch.setValueAtTime(p.switch, time);
    }

    updateLEDs(data) {
        // data = { leds: number (bitmask for func), speedZero: bool }
        const set = (i, on) => {
            const led = document.getElementById(`led-comp-${i}`);
            if (!led) return;
            if (on) {
                led.classList.add('active');
                led.style.boxShadow = `0 0 10px #facc15`;
                led.style.opacity = 1.0;
            } else {
                led.classList.remove('active');
                led.style.boxShadow = '';
                led.style.opacity = 0.2;
            }
        };

        // LED 1: Speed Zero (Top Right) -> Index 1
        set(1, data.speedZero);

        // Function LEDs:
        // C++: uint8_t funcLeds[5] = {1, 3, 2, 6, 4};
        // 1=Led0, 2=Led2, 4=Led4.
        // Ramp(0) -> 1 -> Led0
        // Saw(1) -> 3 -> Led0 + Led2
        // Tri(2) -> 2 -> Led2
        // Sin(3) -> 6 -> Led2 + Led4
        // Steps(4) -> 4 -> Led4

        // Bitmask for LEDs 0, 2, 4
        const mask = data.leds;
        set(0, (mask & 1) !== 0);
        set(2, (mask & 2) !== 0);
        set(4, (mask & 4) !== 0);

        // LEDs 3 and 5 unused? 
        // C++ code: LedOn(5) if pulseFlashCounter > 0.
        set(5, data.flash);
        set(3, false);
    }
}

if (window.registerCard) {
    window.registerCard(CardCVMod);
}
