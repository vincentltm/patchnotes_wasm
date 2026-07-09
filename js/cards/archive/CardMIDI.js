class CardMIDI extends ComputerCard {
    static meta = {
        id: 'midi',
        name: 'Simple MIDI',
        num: '00',
        desc: "USB MIDI to CV Interface. \nConnect USB to send MIDI. \nOut: CV 1 (Pitch), Pulse 1 (Gate), CV 2 (Vel), Pulse 2 (Clock)"
    };

    constructor(ctx, io) {
        super(ctx, io);
        // Guard against missing audio context (e.g. if Audio Engine not started)
        if (!ctx) {
            // Initialize dummies to prevent update() crashes
            this.gateData = new Float32Array(1);
            return;
        }

        // Visualizer for Gate
        this.gateAnalyser = ctx.createAnalyser();
        this.gateAnalyser.fftSize = 32;
        this.gateData = new Float32Array(1);


        // Input Analysers for MIDI OUT
        // Input assignments: Pulse 1 (Gate), CV 1 (Pitch), Audio 1 (CC 42)

        this.outGateAnalyser = ctx.createAnalyser();
        this.outGateFloat = new Float32Array(1);

        this.outPitchAnalyser = ctx.createAnalyser();
        this.outPitchData = new Float32Array(1);
        this.outGateData = new Float32Array(1);
        this.outCCData = new Float32Array(1);

        this.outCCAnalyser = ctx.createAnalyser();

        // State for MIDI Out Logic
        this.lastGate = false;
        this.lastNote = -1;
        this.lastCC = -1;
        this.ccDebounce = 0;

    }

    mount() {
        if (!this.io) return; // Check stored IO
        if (audioNodes) {
            if (audioNodes['Midi_Pitch']) audioNodes['Midi_Pitch'].connect(this.io.cv1Out);
            if (audioNodes['Midi_Gate']) audioNodes['Midi_Gate'].connect(this.io.pulse1Out);
            if (audioNodes['Midi_Velocity']) audioNodes['Midi_Velocity'].connect(this.io.cv2Out);
            if (audioNodes['Midi_Clock']) audioNodes['Midi_Clock'].connect(this.io.pulse2Out);
        }

        // Connect visualizer
        this.io.pulse1Out.connect(this.gateAnalyser);

        // Connect INPUTS to Analysers for MIDI Out processing
        this.io.pulse1In.connect(this.outGateAnalyser);
        this.io.cv1In.connect(this.outPitchAnalyser);
        this.io.inputL.connect(this.outCCAnalyser); // Audio 1 is inputL on Card


        // Passthrough Audio
        this.io.inputL.connect(this.io.outputL);
        this.io.inputR.connect(this.io.outputR);
    }

    unmount() {
        if (!this.io) return; // Guard against unmounting dummy state

        if (audioNodes) {
            try {
                if (audioNodes['Midi_Pitch']) audioNodes['Midi_Pitch'].disconnect(this.io.cv1Out);
                if (audioNodes['Midi_Gate']) audioNodes['Midi_Gate'].disconnect(this.io.pulse1Out);
                if (audioNodes['Midi_Velocity']) audioNodes['Midi_Velocity'].disconnect(this.io.cv2Out);
                if (audioNodes['Midi_Clock']) audioNodes['Midi_Clock'].disconnect(this.io.pulse2Out);
            } catch (e) { }
        }

        try { this.io.pulse1Out.disconnect(this.gateAnalyser); } catch (e) { }
        try { this.io.pulse1In.disconnect(this.outGateAnalyser); } catch (e) { }
        try { this.io.cv1In.disconnect(this.outPitchAnalyser); } catch (e) { }
        try { this.io.inputL.disconnect(this.outCCAnalyser); } catch (e) { }


        // Reset LED
        const jack = document.getElementById('jack-pulse1out');
        if (jack) jack.style.backgroundColor = '';

        try {
            this.io.inputL.disconnect();
            this.io.inputR.disconnect();
        } catch (e) { }
    }

    update(p, time) {
        if (!this.gateAnalyser) return; // Guard if not initialized

        // Visual Update for Gate (existing)
        this.gateAnalyser.getFloatTimeDomainData(this.gateData);
        const isHighOut = this.gateData[0] > 0.5;
        const jack = document.getElementById('jack-pulse1out');

        if (jack) {
            jack.style.backgroundColor = isHighOut ? '#ffff00' : '';
        }

        // --- MIDI OUT LOGIC ---

        // 1. GATE Detection (Pulse 1 In)
        this.outGateAnalyser.getFloatTimeDomainData(this.outGateFloat);
        const gateVal = this.outGateFloat[0];
        const isGateHigh = gateVal > 0.5; // Threshold

        // 2. PITCH Detection (CV 1 In)
        this.outPitchAnalyser.getFloatTimeDomainData(this.outPitchData);
        const cvVal = this.outPitchData[0];
        // CV (0-1 usually 5V? Standard 1V/Oct). 
        // Engine uses 0.0 = C4 (Note 60) for offsets? No, let's assume 1V/Oct standard if possible, 
        // but inputs are raw floats. 
        // Convention: 0V = C4 (60). +1V = +1 Octave (72).
        // Let's assume input is standard -1..1 or 0..1. 
        // Let's map 0.0 -> 60.
        // Input range is likely small for CV jacks if not scaled.
        // Let's use 1.0 = 5 Octaves (60 semitones) for now, standard Eurorack-ish
        const note = Math.max(0, Math.min(127, Math.round(60 + (cvVal * 60))));

        // Gate Rising Edge -> Note On
        if (isGateHigh && !this.lastGate) {
            if (typeof sendMidiNoteOn === 'function') {
                console.log(`[MIDI CARD] Gate Triggered! Note: ${note} (CV: ${cvVal.toFixed(3)})`);
                sendMidiNoteOn(note, 100); // Fixed velocity 100
                this.lastNote = note;
            }
        }

        // Gate Falling Edge -> Note Off
        if (!isGateHigh && this.lastGate) {
            if (typeof sendMidiNoteOff === 'function') {
                // Determine which note to kill. 
                // Ideally we kill the one we started.
                if (this.lastNote !== -1) {
                    sendMidiNoteOff(this.lastNote);
                    console.log(`[MIDI CARD] Note Off: ${this.lastNote}`);
                    this.lastNote = -1;
                }
            }
        }

        this.lastGate = isGateHigh;

        // 3. CC Detection (Audio 1 In / Input L)
        // Send on change
        if (this.frameCnt === undefined) this.frameCnt = 0;
        this.frameCnt++;

        // Downsample CC checks to avoid flooding (every ~30ms)
        if (this.frameCnt % 2 === 0) {
            this.outCCAnalyser.getFloatTimeDomainData(this.outCCData);
            let ccRaw = this.outCCData[0];
            // Map -1..1 (Audio) to 0..127
            // Clamp
            ccRaw = Math.max(-1, Math.min(1, ccRaw));
            // Unipolarize: (-1..1) -> (0..1)
            const uni = (ccRaw + 1) * 0.5;
            const ccVal = Math.round(uni * 127);

            if (ccVal !== this.lastCC) {
                if (typeof sendMidiCC === 'function') {
                    // CC 42 as requested
                    sendMidiCC(42, ccVal);
                }
                this.lastCC = ccVal;
            }
        }
    }

}

// --- REGISTER CARD ---
if (registerCard) {
    registerCard(CardMIDI);
}