class CardSheep extends ComputerCard {
    static meta = {
        id: 'sheep',
        name: 'Sheep',
        num: '22',
        desc: "A time-stretching and pitch-shifting granular processor and digital degradation playground.\n\nKnob Main: Speed/Direction (-2x to +2x)\nKnob X: Delay/Spread\nKnob Y: Grain Size\nSwitch: Up=Freeze, Mid=Normal, Down=Loop/Glitch",
    };

    constructor(ctx, io) {
        super(ctx, io);
        if (!ctx) return;

        try {
            this.worklet = new AudioWorkletNode(ctx, 'sheep-processor', {
                numberOfInputs: 6,
                numberOfOutputs: 6,
                outputChannelCount: [1, 1, 1, 1, 1, 1],
                parameterData: {
                    knobMain: 0.5,
                    knobX: 0.5,
                    knobY: 0.5,
                    switchState: 1, // 0=Up (Freeze), 1=Mid (Normal), 2=Down (Loop)
                    connectedCV1: 0,
                    connectedCV2: 0,
                    connectedPulse1: 0,
                    connectedPulse2: 0
                }
            });
        } catch (e) {
            console.error("Sheep Worklet Error:", e);
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
        this.pConnCV1 = this.worklet.parameters.get('connectedCV1');
        this.pConnCV2 = this.worklet.parameters.get('connectedCV2');
        this.pConnP1 = this.worklet.parameters.get('connectedPulse1');
        this.pConnP2 = this.worklet.parameters.get('connectedPulse2');
    }

    mount() {
        super.mount();
        if (!this.worklet) return;

        // IO Mapping
        // Inputs: 0: AudioL, 1: AudioR, 2: CV1, 3: CV2, 4: Pulse1, 5: Pulse2
        this.io.inputL.connect(this.worklet, 0, 0);
        this.io.inputR.connect(this.worklet, 0, 1);
        this.io.cv1In.connect(this.worklet, 0, 2);
        this.io.cv2In.connect(this.worklet, 0, 3);
        this.io.pulse1In.connect(this.worklet, 0, 4);
        this.io.pulse2In.connect(this.worklet, 0, 5);

        // Outputs
        // 0: AudioL, 1: AudioR, 2: CV1(Rnd), 3: CV2(LFO), 4: Pulse1(LoopEnd), 5: Pulse2(Clock)
        this.worklet.connect(this.io.outputL, 0);
        this.worklet.connect(this.io.outputR, 1);
        this.worklet.connect(this.io.cv1Out, 2);
        this.worklet.connect(this.io.cv2Out, 3);
        this.worklet.connect(this.io.pulse1Out, 4);
        this.worklet.connect(this.io.pulse2Out, 5);
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

    // Helper to check connection
    isPlugged(jackId) {
        if (typeof cableData === 'undefined') return false;
        return cableData.some(c => c.start === jackId || c.end === jackId);
    }

    update(p, time) {
        if (!this.worklet) return;

        this.pMain.setTargetAtTime(p.main, time, 0.02);
        this.pX.setTargetAtTime(p.x, time, 0.02);
        this.pY.setTargetAtTime(p.y, time, 0.02);

        // p.switch: 0=Up, 1=Mid, 2=Down
        // C++ Switch: Up=Freeze, Middle=Normal, Down=Loop
        // Our params.switchState maps 1:1 if we define it that way.
        // Let's assume p.switch follows standard [0, 1, 2] from UI
        this.pSwitch.setValueAtTime(p.switch, time);

        // Check Connections
        const cv1Plugged = this.isPlugged('jack-cv1in');
        const cv2Plugged = this.isPlugged('jack-cv2in');
        const p1Plugged = this.isPlugged('jack-pulse1in');
        const p2Plugged = this.isPlugged('jack-pulse2in');

        this.pConnCV1.setValueAtTime(cv1Plugged ? 1 : 0, time);
        this.pConnCV2.setValueAtTime(cv2Plugged ? 1 : 0, time);
        this.pConnP1.setValueAtTime(p1Plugged ? 1 : 0, time);
        this.pConnP2.setValueAtTime(p2Plugged ? 1 : 0, time);
    }

    updateLEDs(data) {
        // data: { L: float, R: float, cv1: float, cv2: float, p1: 0/1, p2: 0/1 }
        const set = (i, val, color) => {
            const led = document.getElementById(`led-comp-${i}`);
            if (!led) return;
            // Map brightness roughly
            let brightness = val;
            if (brightness > 1) brightness = 1;

            if (brightness > 0.05) {
                led.classList.add('active');
                led.style.boxShadow = `0 0 ${brightness * 10}px ${color}`;
                led.style.opacity = 0.4 + (brightness * 0.6);
            } else {
                led.classList.remove('active');
                led.style.boxShadow = '';
                led.style.opacity = 0.2;
            }
        };

        set(0, data.L, '#4ade80'); // Audio L
        set(1, data.R, '#4ade80'); // Audio R
        set(2, data.cv1, '#facc15'); // CV1
        set(3, data.cv2, '#facc15'); // CV2
        set(4, data.p1, '#ef4444'); // Pulse 1
        set(5, data.p2, '#ef4444'); // Pulse 2
    }
}

if (window.registerCard) {
    window.registerCard(CardSheep);
}
