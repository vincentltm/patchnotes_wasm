
class CardUSBAudio extends ComputerCard {
    static meta = {
        id: 'usb_audio',
        name: 'USB Audio & MIDI',
        num: '06',
        desc: "Matches PicoSDK Hardware.\nAll 6 Jacks are Bidirectional Audio I/O.\nRerouted CV/Pulse to Audio 3-6."
    };

    constructor(ctx, io) {
        super(ctx, io);

        if (!ctx) return;

        // --- AUDIO INPUT (Device -> Web -> Patch) ---
        // Create 6 gain nodes for the 6 inputs
        this.inGains = [];
        for (let i = 0; i < 6; i++) {
            this.inGains[i] = ctx.createGain();
        }

        // --- AUDIO OUTPUT (Patch -> Web -> Device) ---
        // Create Merger to send 6 channels to destination (which is the device)
        this.outMerger = ctx.createChannelMerger(6);
        this.outMerger.connect(ctx.destination);
    }

    mount() {
        if (!this.ctx || !this.io) return;

        // 1. DEVICE INPUTS (Mic -> Patch Jacks)
        // Map 6 Input Channels from 'Mic_Splitter' to our 6 Output Jacks on the Web UI
        // Jack mappings defined below.
        this.connectInputs();

        // 2. DEVICE OUTPUTS (Patch Jacks -> Speakers)
        // Map 6 Input Jacks on Web UI to the 6 Channels of ctx.destination
        // Jack mappings:
        // Audio 1 In -> Spk Ch 0
        // Audio 2 In -> Spk Ch 1
        // CV 1 In    -> Spk Ch 2
        // CV 2 In    -> Spk Ch 3
        // Pulse 1 In -> Spk Ch 4
        // Pulse 2 In -> Spk Ch 5

        const jackIns = [
            this.io.inputL,     // Ch 0
            this.io.inputR,     // Ch 1
            this.io.cv1In,      // Ch 2
            this.io.cv2In,      // Ch 3
            this.io.pulse1In,   // Ch 4
            this.io.pulse2In    // Ch 5
        ];

        try {
            for (let i = 0; i < 6; i++) {
                jackIns[i].connect(this.outMerger, 0, i);
            }
        } catch (e) {
            console.warn('[USB Audio] Error connecting outputs:', e);
        }

        // 0. Auto-configure Output Channels if possible
        if (this.ctx.destination.maxChannelCount >= 6) {
            // Only force if strictly necessary to avoid spamming properties
            if (this.ctx.destination.channelCount < 6 || this.ctx.destination.channelInterpretation !== 'discrete') {
                try {
                    this.ctx.destination.channelCount = 6;
                    this.ctx.destination.channelCountMode = 'explicit';
                    this.ctx.destination.channelInterpretation = 'discrete';
                    console.log('[USB Audio] Auto-configured 6-channel discrete output.');
                } catch (e) {
                    console.warn('[USB Audio] Failed to auto-configure output:', e);
                }
            }
        }

        // Check for 6-channel Output Support
        if (this.ctx.destination.channelCount < 6) {
            showMessage("Warning: Output is NOT 6-channel", "warning");
            console.warn(`[USB Audio] Destination has ${this.ctx.destination.channelCount} channels. Needed: 6.`);
            console.warn('[USB Audio] macOS Users: Open "Audio MIDI Setup", select this output, and set Format to 6 ch.');
        } else {
            // Verification Log
            if (this.ctx.destination.channelInterpretation !== 'discrete') {
                console.warn('[USB Audio] Warning: Output is 6-channel but NOT discrete. Mixing may occur.');
            }
        }

        // Check for 6-channel Input Support
        if (audioNodes['Mic_Splitter']) {
            if (audioNodes['Mic_Splitter'].numberOfOutputs < 6) {
                showMessage("Warning: Input is NOT 6-channel", "warning");
            } else if (currentMicStream) {
                // Check the track settings
                const track = currentMicStream.getAudioTracks()[0];
                if (track) {
                    const settings = track.getSettings();
                    if (settings.channelCount && settings.channelCount < 6) {
                        showMessage(`Warning: Input Device has only ${settings.channelCount} channels`, "warning");
                        console.warn('[USB Audio] macOS Users: Open "Audio MIDI Setup", select this input, and set Format to 6 ch.');
                    }
                }
            }
        }

        console.log('[USB Audio] Mounted. 6-Channel Mode.');
    }

    unmount() {
        if (!this.ctx) return;

        // Disconnect Internals
        for (let g of this.inGains) g.disconnect();
        this.outMerger.disconnect();

        // Disconnect Mic
        if (audioNodes['Mic_Splitter']) {
            try {
                for (let i = 0; i < 6; i++) {
                    try { audioNodes['Mic_Splitter'].disconnect(this.inGains[i]); } catch (e) { }
                }
            } catch (e) { }
        }

        // Disconnect Inputs -> Merger
        const jackIns = [
            this.io.inputL,
            this.io.inputR,
            this.io.cv1In,
            this.io.cv2In,
            this.io.pulse1In,
            this.io.pulse2In
        ];

        for (let j of jackIns) {
            try { j.disconnect(this.outMerger); } catch (e) { }
        }

        console.log('[USB Audio] Unmounted.');
    }

    update(p, time) {
        // No specific update logic needed for pure audio streaming
    }

    onMicChange() {
        console.log('[USB Audio] Input change detected. Reconnecting...');
        this.connectInputs();
    }

    connectInputs() {
        // Disconnect old upstream connections if possible
        // Note: We can't easily disconnect *from* the splitter, but we can disconnect our gains *from* downstream 
        // and reconnect everything. 
        // Actually, best is to try to connect. If already connected, Web Audio is redundant-safe.

        const jackOuts = [
            this.io.outputL,    // Ch 0
            this.io.outputR,    // Ch 1
            this.io.cv1Out,     // Ch 2
            this.io.cv2Out,     // Ch 3
            this.io.pulse1Out,  // Ch 4
            this.io.pulse2Out   // Ch 5
        ];

        if (audioNodes['Mic_Splitter']) {
            try {
                for (let i = 0; i < 6; i++) {
                    // 1. Connect Splitter -> Gain
                    try { audioNodes['Mic_Splitter'].connect(this.inGains[i], i, 0); } catch (e) { }

                    // 2. Connect Gain -> Output Jack
                    try { this.inGains[i].connect(jackOuts[i]); } catch (e) { }
                }
                console.log('[USB Audio] Connected Mic Inputs 0-5');
            } catch (e) {
                console.warn('[USB Audio] Error connecting Mic inputs:', e);
            }
        } else {
            console.warn('[USB Audio] Mic Splitter not found. Inputs not connected.');
        }
    }
}

if (window.registerCard) {
    window.registerCard(CardUSBAudio);
}
