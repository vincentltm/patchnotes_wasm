// =========================================================================
// AUDIO-ENGINE.JS
// Handles the sound engine, audio routing and IO (Stereo, Midi, Speaker)
// =========================================================================

// PiezoContactMic — loaded lazily after worklets resolve
let piezoMic = null;

/**
 * Tries to load the pre-extracted OGG piezo samples from assets/piezo/.
 * Silently falls back (leaves piezoMic = null) if the manifest is missing —
 * you must run `node scripts/extract-piezo.js` first to generate the files.
 */
async function initPiezoContactMic() {
    if (!window.PiezoContactMic || !audioCtx) return;
    if (piezoMic && piezoMic.loaded) return; // already loaded
    try {
        piezoMic = new PiezoContactMic(audioCtx, 'assets/piezo/manifest.json');
        await piezoMic.load();
        // Wire output into Amp input if the graph is ready and amp input is unpatched
        if (audioNodes['Amp'] && audioNodes['Amp'].input) {
            try { piezoMic.output.connect(audioNodes['Amp'].input); } catch(e) {}
        }
        console.log('[PiezoContactMic] Loaded — groups:', piezoMic.groups.join(', '));
    } catch(e) {
        piezoMic = null;
        console.info('[PiezoContactMic] Not available — run `node scripts/extract-piezo.js` to enable real samples.', e.message);
    }
}

// Stop any active granular loop when mouse is released anywhere on the page
document.addEventListener('mouseup', () => {
    if (piezoMic) piezoMic.stopLoop();
});
document.addEventListener('touchend', () => {
    if (piezoMic) piezoMic.stopLoop();
});

/* =========================================================================
   AUDIO WORKLETS
   ========================================================================= */


// --- VCO WORKLET ---
const vcoWorkletCode = `
class VCOProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'frequency', defaultValue: 440, minValue: 0 },
            { name: 'detune', defaultValue: 0 },
            { name: 'fmGain', defaultValue: 0 }, // AC Mod Depth
            { name: 'feedbackAmt', defaultValue: 0 } // Switch
        ];
    }

    constructor() {
        super();
        this.phase = 0;
    }

    poly_blep(t, dt) {
        if (t < dt) {
            let x = t / dt;
            return 2 * x - x * x - 1;
        } else if (t > 1 - dt) {
            let x = (t - 1) / dt;
            return x * x + 2 * x + 1;
        }
        return 0;
    }

    process(inputs, outputs, parameters) {
        // Use fixed 128 size, or fallback to output length
        const outSqr = outputs[0] ? outputs[0][0] : null;
        const outSin = outputs[1] ? outputs[1][0] : null;
        
        // Safety: If no outputs are connected, we still need to advance validation phase but maybe skip calc?
        // But let's assume 128 frame per block usually.
        const bufferSize = 128;

        const freqParams = parameters.frequency;
        const detuneParams = parameters.detune;
        const fbParams = parameters.feedbackAmt;
        const fmGainParams = parameters.fmGain;

        const sampleRate = 48000;
        const nyquist = sampleRate / 2;

        for (let i = 0; i < bufferSize; i++) {
            const baseFreq = freqParams.length > 1 ? freqParams[i] : freqParams[0];
            const detune = detuneParams.length > 1 ? detuneParams[i] : detuneParams[0];
            const fbNorm = fbParams.length > 1 ? fbParams[i] : fbParams[0];
            const fmKnob = fmGainParams.length > 1 ? fmGainParams[i] : fmGainParams[0];

            let totalDetune = detune;
            
            // Apply Feedback
            if (fbNorm > 0.01) {
                const currentSin = Math.sin(this.phase * 2 * Math.PI);
                
                // Scaled Feedback (0.3 factor)
                totalDetune += (currentSin * fmKnob * 0.3);
            }

            // Calculate Frequency
            let freq = baseFreq * Math.pow(2, totalDetune / 1200);
            
            // --- STABILITY FIX: Clamp Frequency ---
            // Prevents dt > 0.5 which breaks PolyBLEP and causes instability
            if (freq > nyquist) freq = nyquist;
            if (freq < 0) freq = 0;

            const dt = freq / sampleRate;
            this.phase += dt;
            if (this.phase >= 1.0) this.phase -= 1.0;

            const sineSamp = Math.sin(this.phase * 2 * Math.PI);
            if(outSin && outSin.length > i) outSin[i] = sineSamp * 0.458; 

            // Square with PolyBLEP
            let sqrSamp = this.phase < 0.5 ? 1.0 : -1.0;
            sqrSamp += this.poly_blep(this.phase, dt);
            sqrSamp -= this.poly_blep((this.phase + 0.5) % 1.0, dt);
            
            if(outSqr && outSqr.length > i) outSqr[i] = sqrSamp * 0.375; 
        }

        return true;
    }
}
registerProcessor('vco-processor', VCOProcessor);
`;

const toolboxWorkletCode = `
class ToolboxProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'main', defaultValue: 0.5 },
            { name: 'x', defaultValue: 0 },
            { name: 'y', defaultValue: 0 },
            { name: 'mode', defaultValue: 0 }, // Switch: 0=Up, 1=Mid, 2=Down
            { name: 'connectedP1', defaultValue: 0 }, // 0 = False, 1 = True
            { name: 'connectedCV1', defaultValue: 0 } // 0 = False, 1 = True
        ];
    }

    constructor() {
        super();
        this.noiseState = 2463534242;
        this.shVal = 0;
        this.timer = 0; // Clock Timer Phase (0..1)
        this.clockTimer = 0; // Trigger Hold Timer
        this.coinTimer = 0; // Trigger Hold Timer
        this.noiseType = 0;
        this.noiseTimer = 0;
        this.noiseVal = 0;
        this.lastSwitch = 0;

        // Pulse Detection
        this.lastPulse1 = 0;
        this.lastPulse2 = 0;
    }

    xorshift32() {
        this.noiseState ^= this.noiseState << 13;
        this.noiseState ^= this.noiseState >> 17;
        this.noiseState ^= this.noiseState << 5;
        // Keep it unsigned 32-bit
        this.noiseState = this.noiseState >>> 0; 
        return this.noiseState;
    }

    // Returns -1 to 1
    noise12() {
        const r = (this.xorshift32() >>> 20) & 0xFFF; // 12-bit (0-4095)
        return (r - 2048) / 2048.0; 
    }

    getNoise() {
        if (this.noiseType >= 1) {
            if (this.noiseTimer <= 0) {
                this.noiseVal = this.noise12();
                this.noiseTimer = 2 << this.noiseType;
            } else {
                this.noiseTimer--;
            }
            return this.noiseVal;
        }
        return this.noise12();
    }

    coinflip(prob) { // prob 0..1
        const r = (this.xorshift32() >>> 20) / 4096.0;
        return r < prob;
    }

    process(inputs, outputs, parameters) {
        // Inputs: 6 mono inputs
        // inputs[n] is array of Channels. inputs[n][0] is Float32Array of samples.
        const inAudio1 = inputs[0][0] || null;
        const inAudio2 = inputs[1][0] || null;
        const inCV1 = inputs[2][0] || null;
        const inCV2 = inputs[3][0] || null;
        const inPulse1 = inputs[4][0] || null;
        const inPulse2 = inputs[5][0] || null;

        const outAudio1 = outputs[0][0];
        const outAudio2 = outputs[1][0];
        const outCV1 = outputs[2][0];
        const outCV2 = outputs[3][0];
        const outPulse1 = outputs[4][0];
        const outPulse2 = outputs[5][0];

        const paramMain = parameters.main;
        const paramX = parameters.x;
        const paramY = parameters.y;
        const paramMode = parameters.mode;
        const paramConnP1 = parameters.connectedP1;
        const paramConnCV1 = parameters.connectedCV1;

        for (let i = 0; i < 128; i++) {
            const pMain = paramMain.length > 1 ? paramMain[i] : paramMain[0];
            const pX = paramX.length > 1 ? paramX[i] : paramX[0];
            const pY = paramY.length > 1 ? paramY[i] : paramY[0];
            // Connected params
            const isConnP1 = (paramConnP1.length > 1 ? paramConnP1[i] : paramConnP1[0]) > 0.5;
            const isConnCV1 = (paramConnCV1.length > 1 ? paramConnCV1[i] : paramConnCV1[0]) > 0.5;
            
            const pMode = Math.round(paramMode.length > 1 ? paramMode[i] : paramMode[0]);

            const a = inAudio1 ? inAudio1[i] : 1.0; 
            const c = inAudio2 ? inAudio2[i] : 1.0;
            const cv1 = inCV1 ? inCV1[i] : 0.0;
            const cv2 = inCV2 ? inCV2[i] : 0.0;
            const p1Val = inPulse1 ? inPulse1[i] : 0.0;
            const p2Val = inPulse2 ? inPulse2[i] : 0.0;

            // --- NOISE TYPE SWITCHING ---
            // Detect switch change to Down (2)
            if (pMode === 2 && this.lastSwitch !== 2) {
                 this.noiseType = (this.noiseType + 1) % 7;
            }
            this.lastSwitch = pMode;

            // --- AUDIO LOGIC ---
            // b = Main (Bipolar -1 to 1). pMain is 0..1
            const b = (pMain - 0.5) * 2.0; 
            // d = X (Unipolar 0 to 1).
            const d = pX;

            let out1 = 0;
            if (pMode === 0) { // Up: Ring/VCA
               // (A * B) * (C * D)
               out1 = (a * b) * (c * d);
            } else { // Mid/Down: Mixer
               // (A * B) + (C * D)
               out1 = (a * b) + (c * d);
            }
            if (outAudio1) outAudio1[i] = out1;

            // --- NOISE OUTPUT ---
            const n = this.getNoise();
            if (outAudio2) outAudio2[i] = n;

            // --- CV LOGIC ---
            // CVOut1 = CV1 * CV2 (Ring Mod)
            if (outCV1) outCV1[i] = cv1 * cv2; 

            // --- CLOCK LOGIC ---
            let clockTrig = false;
            
            // Pulse 1 Input detection (Schmitt Triggerish)
            const pulse1High = p1Val > 0.5;
            if (isConnP1) { // CONNECTED
                 if (pulse1High && !this.lastPulse1) clockTrig = true;
            } else { // UNPLUGGED -> Internal Clock
                 // Exp4000(KnobVal(Y) >> 1)
                 // Y is 0..1. 
                 // Simple exponential clock:
                 const rate = 0.5 * Math.pow(100, pY); // Range
                 this.timer += (rate / 48000.0);
                 if (this.timer > 1.0) {
                     this.timer -= 1.0;
                     clockTrig = true;
                 }
            }
            this.lastPulse1 = pulse1High;

            if (clockTrig) {
                this.clockTimer = 240; // ~5ms pulse at 48k

                // S&H Sample
                if (isConnCV1) { 
                     this.shVal = cv1; 
                } else {
                     this.shVal = n;
                }
                
                // Pulse 2 Logic (Coin Flip)
                // If Pulse 2 IN is Unplugged or High -> Gate Open
                const p2Gate = (!inPulse2) || (p2Val > 0.5); 
                
                if (p2Gate) {
                    let p2 = false;
                    if (isConnP1) { // If external clock (Pulse 1 plugged)
                        p2 = this.coinflip(pY);
                    } else {
                        // Internal: 50% chance
                        p2 = this.coinflip(0.5);
                    }
                    if (p2) this.coinTimer = 240;
                }
            }

            // --- PULSE OUTPUTS ---
            if (outPulse1) outPulse1[i] = this.clockTimer > 0 ? 1.0 : 0.0;
            if (outPulse2) outPulse2[i] = this.coinTimer > 0 ? 1.0 : 0.0;

            if (this.clockTimer > 0) this.clockTimer--;
            if (this.coinTimer > 0) this.coinTimer--;

            // --- CV2 OUT ---
            if (outCV2) outCV2[i] = this.shVal;
        }

        // Output LED data every ~16 frames (approx 40ms)
        if (!this.frameCnt) this.frameCnt = 0;
        this.frameCnt++;
        if (this.frameCnt > 16) { 
            this.frameCnt = 0;
            this.port.postMessage({
                audio1: outAudio1 ? Math.abs(outAudio1[0]) : 0,
                audio2: outAudio2 ? Math.abs(outAudio2[0]) : 0,
                cv1: outCV1 ? Math.abs(outCV1[0]) : 0,
                cv2: outCV2 ? Math.abs(outCV2[0]) : 0,
                p1: outPulse1 ? outPulse1[0] : 0,
                p2: outPulse2 ? outPulse2[0] : 0
            });
        }

        return true;
    }
}
registerProcessor('toolbox-processor', ToolboxProcessor);
`;

const benjolinWorkletCode = `
class BenjolinProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'knobMain', defaultValue: 0.5, minValue: 0, maxValue: 1 },
            { name: 'knobX', defaultValue: 0.5, minValue: 0, maxValue: 1 },
            { name: 'knobY', defaultValue: 0.5, minValue: 0, maxValue: 1 },
            { name: 'switchState', defaultValue: 1, minValue: 0, maxValue: 2 } // 0=Loop, 1=Run, 2=Write
        ];
    }

    constructor() {
        super();
        this.SHIFT_REG_SIZE = 6;
        this.bits = new Int32Array(this.SHIFT_REG_SIZE); 
        this.bits.fill(0);
        
        // Clock triggers
        this.lastFwd = 0;
        this.lastBack = 0;
        
        // S&H
        this.s_vca = 0;
        this.s_offset = 2048;
        
        // LED Sync 
        this.ledCounter = 0;

        this.zeroArray = new Float32Array(128);
    }

    process(inputs, outputs, parameters) {
        // Inputs: 0:ClkFwd, 1:ClkBack, 2:Data, 3:Prob, 4:OffCV, 5:VCACV
        const clkFwd = inputs[0][0] || this.zeroArray;
        const clkBack = inputs[1][0] || this.zeroArray;
        const dataIn = inputs[2][0] || this.zeroArray;
        const probMod = inputs[3][0] || this.zeroArray;
        const offCv = inputs[4][0] || this.zeroArray;
        const vcaCv = inputs[5][0] || this.zeroArray;

        // Parameters
        const kMain = parameters.knobMain.length > 1 ? parameters.knobMain : [parameters.knobMain[0]];
        const kX = parameters.knobX.length > 1 ? parameters.knobX : [parameters.knobX[0]];
        const kY = parameters.knobY.length > 1 ? parameters.knobY : [parameters.knobY[0]];
        const swState = parameters.switchState.length > 1 ? parameters.switchState : [parameters.switchState[0]];

        // Outputs
        // 0:R1, 1:R2, 2:CV1, 3:CV2, 4:P1, 5:P2
        const outR1 = outputs[0][0];
        const outR2 = outputs[1][0];
        const outCV1 = outputs[2][0];
        const outCV2 = outputs[3][0];
        const outPulse1 = outputs[4][0];
        const outPulse2 = outputs[5][0];

        // Process Loop
        for (let i = 0; i < 128; i++) {
            // 1. Clock Detection
            let triggerFwd = false;
            let triggerBack = false;
            const THRESHOLD = 0.1; // Sensitive 
            const LOW = 0.05;

            const fwdSample = clkFwd[i];
            if (fwdSample > THRESHOLD && this.lastFwd <= THRESHOLD) triggerFwd = true;
            this.lastFwd = fwdSample;
            
            const backSample = clkBack[i];
            if (backSample > THRESHOLD && this.lastBack <= THRESHOLD) triggerBack = true;
            this.lastBack = backSample;

            // 2. State & Rotation
            const sw = Math.round(swState.length > 1 ? swState[i] : swState[0]);
            const mkMain = kMain.length > 1 ? kMain[i] : kMain[0];
            const mkX = kX.length > 1 ? kX[i] : kX[0];
            const mkY = kY.length > 1 ? kY[i] : kY[0];
            
            // S&H sampling logic moved to trigger events?
            // Actually original code sampled on trigger.
            // Let's calculate params per sample though.

            // Calc Probability 0..4095
            let paramP = mkMain * 4095;
            let modP = probMod[i] * 2048; 
            let turingP = paramP + modP;
            if (turingP < 0) turingP = 0;
            if (turingP > 4095) turingP = 4095;
            
            let illusion = false;
            if (turingP < 15) { turingP = 0; illusion = true; }
            else if (turingP > 4080) turingP = 4095;

            // Rotate Logic
            if (triggerFwd) {
                // Right Rotate
                const last = this.bits[5];
                for (let k = 5; k > 0; k--) this.bits[k] = this.bits[k-1];
                this.bits[0] = last;
                
                // Logic
                if (sw === 2) { // Write
                    this.bits[0] = 0x3;
                } else if (sw === 0 || illusion) { // Loop
                    this.bits[0] = (~this.bits[0]) & 0x3;
                } else { // Run
                    let dVal = 0;
                    // Logic: if dataIn is active use it, else rand.
                    // Simple check: abs input > 0.01
                    if (Math.abs(dataIn[i]) < 0.01) {
                         dVal = Math.floor(Math.random() * 4096);
                    } else {
                         // Map -1..1 -> 0..4096
                         dVal = Math.floor(dataIn[i] * 2048 + 2048);
                    }
                    if (dVal > turingP) this.bits[0] = (~dVal) & 0x3;
                }
            }
            
            if (triggerBack) {
                // Left Rotate
                const first = this.bits[0];
                for (let k = 0; k < 5; k++) this.bits[k] = this.bits[k+1];
                this.bits[5] = first;
                
                // Logic
                 if (sw === 2) { // Write
                    this.bits[5] = 0x0;
                } else if (sw === 0 || illusion) { // Loop
                    this.bits[5] = (~this.bits[5]) & 0x3;
                } else { // Run
                    let dVal = 0;
                    if (Math.abs(dataIn[i]) < 0.01) {
                         dVal = Math.floor(Math.random() * 4096);
                    } else {
                         dVal = Math.floor(dataIn[i] * 2048 + 2048);
                    }
                    if (dVal > 4094) dVal = 4094;
                    if (dVal < 1) dVal = 1;
                    if (dVal > turingP) this.bits[5] = (~dVal) & 0x3;
                }
            }
            
            // Continuous Controls (Offset & VCA)
            // C++: calcOffset() and calcVCA() run every sample.
            this.updateControls(mkX, mkY, offCv[i], vcaCv[i]);

            // 3. Compute Outputs
            let r1 = 0; 
            for (let k=0; k<3; k++) r1 |= ((this.bits[k] << (2*k)) & 0x3F);
            let r2 = 0;
            for (let k=0; k<3; k++) r2 |= ((this.bits[k+3] << (2*k)) & 0x3F);
            
            r1 = r1 << 6; r2 = r2 << 6; // 12 bit
            
            // S&H Mod (Actually continuous VCA/Offset)
            r1 = r1 * this.s_vca; r2 = r2 * this.s_vca;
            r1 += this.s_offset; r2 += this.s_offset;
            
            r1 -= 2048; r2 -= 2048;
            r1 *= -1; r2 *= -1;
            
            // Clip
            if (r1 > 2047) r1 = 2047; if (r1 < -2048) r1 = -2048;
            if (r2 > 2047) r2 = 2047; if (r2 < -2048) r2 = -2048;
            
            const q1 = r1; const q2 = r2;
            const norm = (v) => (v / 2048.0) * 0.5;
            
            if (outR1) outR1[i] = norm(r1);
            if (outR2) outR2[i] = norm(r2);
            
            // Quantize CV
            const step = 34.13;
            const cv1 = Math.round(q1 / step) * step;
            const cv2 = Math.round(q2 / step) * step;
            
            if (outCV1) outCV1[i] = norm(cv1);
            if (outCV2) outCV2[i] = norm(cv2);
            
            // Pulses
            const p1 = this.bits[2] & 0x1; 
            const p2 = this.bits[5] & 0x1;
            if (outPulse1) outPulse1[i] = p1; 
            if (outPulse2) outPulse2[i] = p2;
        } // End loop
        
        // LED Update (Downsample)
        this.ledCounter++;
        if (this.ledCounter > 16) { 
            this.port.postMessage({ bits: Array.from(this.bits) });
            this.ledCounter = 0;
        }

        return true;
    }
    
    updateControls(kx, ky, offCv, vcaCv) {
        // VCA (Unipolar VCA)
        let vcaVal = ky;
        if (Math.abs(vcaCv) > 0.01) {
            let cv = (vcaCv + 1) / 2;
            vcaVal = cv * ky;
        }
        this.s_vca = vcaVal;

        // Offset (Bipolar Attenuverter)
        let offVal = kx * 4096;
        if (Math.abs(offCv) > 0.01) {
             // C++: offset = CV * (Knob - 2048) >> 12; offset += 2048;
             // offCv in JS is -1..1. C++ CV is -2048..2048 approx.
             // Knob term (kx*4096 - 2048) is -2048..2048.
             // Mult Result should be +/- 1024 approx range (since >> 12 divides by 4096).
             // Math: (offCv * 2048) * (knobBip) / 4096
             
             let knobBip = kx * 4096 - 2048; 
             offVal = (offCv * 2048) * knobBip / 4096;
             offVal += 2048;
        }
        this.s_offset = offVal;
    }
}
registerProcessor('benjolin-processor', BenjolinProcessor);
`;


// --- SLOPES WORKLET ---
const slopesWorkletCode = `
class SlopesProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.currentVoltage = 0;
        this.loopOffset = true; // loop flip-flop state 
        
        // LED Accumulators
        this.riseSamples = 0;
        this.fallSamples = 0;
        this.totalSamples = 0;
        
        this.params = {
            mode: 1,       // 0: Loop, 1: Slew, 2: Gate
            shape: 1,      // 0: Shape A, 1: Both, 2: Shape B
            knobRate: 0.5, 
            isExponential: options.processorOptions.isExponential || false
        };

        this.port.onmessage = (e) => {
            Object.assign(this.params, e.data);
        };

        this.zeroArray = new Float32Array(128);
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0][0];
        const inputL = inputs[0][0] || this.zeroArray;
        const cvIn   = (inputs[0] && inputs[0][1]) || this.zeroArray;

        const RAIL_MAX = 1.0; 
        const LOOP_OFFSET = 0.99; 
        const BLIP_OFFSET = 0.66;
        const EXP_AMT = 0.17;
        const MAX_COEFF = 0.012;       
        const INSTANT = 0.0118;
        // LED Update Rate (~30Hz)
        const LED_UPDATE_RATE = 1600;

        for (let i = 0; i < output.length; i++) {
            // --- 1. Rise/fall rate control ---
           
            let speedCtrl = this.params.knobRate + (cvIn[i] * 0.5)
                            - this.params.isExponential*this.currentVoltage*EXP_AMT;
				
            speedCtrl = Math.max(0.0, Math.min(1.0, speedCtrl));

            let rate = MAX_COEFF * Math.exp(-4*speedCtrl*(2+speedCtrl));
            let riseCoeff = (this.params.shape === 0)?INSTANT:rate;
            let fallCoeff = (this.params.shape === 2)?INSTANT:rate;

            // --- 2. Target logic  ---
            let target = inputL[i]; // target is input, by default

            if (this.params.mode === 0 && this.loopOffset) 
                target += LOOP_OFFSET;
            else if (this.params.mode === 2)
                target += BLIP_OFFSET;

            // --- 4. Travel towards target ---

            const delta = target - this.currentVoltage;
            const incr = (delta>0) ? riseCoeff : -fallCoeff;
            this.currentVoltage = Math.min(this.currentVoltage + incr, RAIL_MAX);

            // --- 5. Behaviour upon hitting target  ---
			if (delta*(target-this.currentVoltage)<0) // if we went past the target
			{					
				this.currentVoltage = target; // clamp output to target
				if (this.params.mode === 0) // if looping, toggle flip-flop of target position
					this.loopOffset = !this.loopOffset;
			}

            output[i] = this.currentVoltage;

            // --- 6. LED accumulation ---
            let dir = Math.tanh(delta*-30);
            if (dir > 0) this.riseSamples += dir;
            else this.fallSamples -= dir;
        }

        // --- SEND LED UPDATE ---
        this.totalSamples += 128;
        if (this.totalSamples >= LED_UPDATE_RATE) {
            // Quite aggressive gamma correction on LEDs
            const rVal = Math.pow(this.riseSamples / this.totalSamples, 0.25);
            const fVal = Math.pow(this.fallSamples / this.totalSamples, 0.25);
            this.port.postMessage({ rise: rVal, fall: fVal });
            this.riseSamples = 0; this.fallSamples = 0; this.totalSamples = 0;
        }

        return true;
    }
}
registerProcessor('slopes-processor', SlopesProcessor);
`;

// --- HUMPBACK FILTER WORKLET (4x Oversampled OTA SVF) ---
// Ported from Workshop System VCV HumpbackFilter.hpp
// Upgrades: 4x oversampling, OTA asymmetric bias (tanh+0.28 offset), JFET soft-knee clamp,
// AC-coupled resonance HPF (33kΩ×0.33µF), resistor-network gainRes formula
const humpbackWorkletCode = `
class HumpbackFilterProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'cutoff', defaultValue: 1000, minValue: 10, maxValue: 22000 },
            { name: 'resonance', defaultValue: 0, minValue: 0, maxValue: 2.0 }, 
            { name: 'mode', defaultValue: 0 } 
        ];
    }

    constructor() {
        super();
        this.ic1eq    = 0; // Internal State 1 (Bandpass)
        this.ic2eq    = 0; // Internal State 2 (Lowpass)
        this.resHpState = 0; // AC-coupling capacitor state (C3: 33kΩ × 0.33µF, fc≈14.6 Hz)
    }

    softKneeClip(x, vt, lim) {
        const ax = Math.abs(x);
        if (ax <= vt) return x;
        const d = lim - vt;
        return (x > 0 ? 1 : -1) * (vt + d * Math.tanh((ax - vt) / d));
    }

    process(inputs, outputs, parameters) {
        const input      = inputs[0][0];
        const outLP      = outputs[0][0];
        const outSwitched = outputs[1][0];

        const cutParams  = parameters.cutoff;
        const resParams  = parameters.resonance;
        const modeParams = parameters.mode;

        // Physical constants — used AS-IS from Workshop System VCV HumpbackFilter.hpp.
        // The Workshop System operates at instrument level (~±1V audio, NOT ±5V Eurorack),
        // so these constants map directly onto the Web Audio ±1.0 normalised domain.
        const V_rail   = 2.1;    // ±10.5V op-amp rail  (2.1 in 1V-normalised domain)
        const V_jfet   = 2.52;   // ±12.6V JFET clamp   (2.52 in 1V-normalised domain)
        const G_ota    = 2.0;    // OTA saturation scale
        const V_thresh = 2.0;    // Soft-knee threshold
        const S_res    = 0.12;   // Resonance feedback scaling (dimensionless)

        // 4x oversampled rate and AC-coupling HPF coefficient (C3: 33kΩ×0.33µF)
        // Note: alphaHp computed at OVERSAMPLED rate (not base rate) for physical accuracy.
        const oversampleRate = sampleRate * 4;
        const tau    = 33000 * 0.33e-6; // 0.01089 s
        const dtOs   = 1 / oversampleRate;
        const alphaHp = tau / (tau + dtOs);

        for (let i = 0; i < (outLP ? outLP.length : 128); i++) {
            const cutoff = cutParams.length  > 1 ? cutParams[i]  : cutParams[0];
            const res    = resParams.length  > 1 ? resParams[i]  : resParams[0];
            const mode   = modeParams.length > 1 ? modeParams[i] : modeParams[0];

            // Seed noise for self-oscillation startup
            let inSample = input ? input[i] : 0;
            inSample += (Math.random() - 0.5) * 0.002;

            // Resonance potentiometer mapping (100kΩ B-type, calibrated at w=0.83)
            const w = Math.max(0, Math.min(1, res / 2.0)); // 0..2.0 param → 0..1.0
            const w_eff = w <= 0.83 ? -0.55 + w * (1.38 / 0.83) : w;
            const R_pot = 100000, R_fb = 47000, R_in = 22000;
            const alphaRes = 101000 / (101000 + w_eff * R_pot);
            const gainRes  = alphaRes - (R_fb / (R_in + (1 - w_eff) * R_pot)) * (1 - alphaRes);

            // Cutoff coefficient with 1.60× pre-compensation for 4x oversampling
            const compCutoff = Math.min(cutoff * 1.60, 22000);
            let f = 2 * Math.sin(Math.PI * compCutoff / oversampleRate);
            if (f > 0.9) f = 0.9;

            // 4x oversampling loop — accumulate decimation average
            let sumLow = 0, sumVal = 0;

            for (let sub = 0; sub < 4; sub++) {
                const low  = this.ic2eq;
                const band = this.ic1eq;

                // JFET source-follower buffers: clamp at gate voltage limits
                const lowBuf  = Math.max(-V_jfet, Math.min(V_jfet, low));
                const bandBuf = Math.max(-V_jfet, Math.min(V_jfet, band));

                // IC4B differential resonance feedback, clamped at op-amp rail
                const vOutRes     = gainRes * bandBuf;
                const resFeedback = Math.max(-V_rail, Math.min(V_rail, vOutRes));

                // AC-coupled resonance path: C3 HPF removes DC offset from feedback
                const hpOut = resFeedback - this.resHpState;
                this.resHpState = this.resHpState * alphaHp + resFeedback * (1 - alphaHp);

                // IC3A inverting summer: mixes input + LP state + AC-resonance feedback
                const high        = -0.4545 * (inSample + lowBuf) - 3.03 * S_res * hpOut;
                const highClipped = Math.max(-V_rail, Math.min(V_rail, high));

                // OTA integrators with asymmetric bias (0.28 quiescent current offset)
                const bandNew = band + f * G_ota * (Math.tanh(highClipped / G_ota + 0.28) - 0.27290);
                const lowNew  = low  + f * G_ota * (Math.tanh(bandNew    / G_ota + 0.28) - 0.27290);

                // Soft-knee clamp state variables at JFET gate limits
                this.ic1eq = this.softKneeClip(bandNew, V_thresh, V_jfet);
                this.ic2eq = this.softKneeClip(lowNew,  V_thresh, V_jfet);

                const curLow  = Math.max(-V_rail, Math.min(V_rail, this.ic2eq));
                const curBand = Math.max(-V_rail, Math.min(V_rail, this.ic1eq));

                // Mode mapping (matches patchnotes UI convention):
                // mode 0 = HP, mode 1 = BP, mode 2 = Notch
                let curVal;
                if (mode < 0.5)      curVal = highClipped;       // HP
                else if (mode < 1.5) curVal = curBand;           // BP
                else                 curVal = highClipped + curLow; // Notch

                sumLow += curLow;
                sumVal += curVal;
            }

            // Decimate: average across 4 oversampled substeps
            if (outLP)       outLP[i]       = sumLow / 4;
            if (outSwitched) outSwitched[i] = sumVal / 4;
        }
        return true;
    }
}
registerProcessor('humpback-processor', HumpbackFilterProcessor);
`;

// --- AMPLIFIER WORKLET (Mikrophonie Mic Preamp + BJT LoFi Drive) ---
// Ported from Workshop System VCV Amplifier.hpp
// Mode 0: Mikrophonie non-inverting op-amp (log-pot taper, RC network, soft-clip anti-lockup)
// Mode 1: BJT differential pair (Mini Drive, asymmetric rails −9.2V/+5.3V, pink+hum noise)
const ampWorkletCode = `
class AmpProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'gain', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
            { name: 'mode', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 }
        ];
    }

    constructor() {
        super();
        this.noiseSeed   = (Math.random() * 4294967295 + 1) >>> 0;
        this.pinkB0 = 0; this.pinkB1 = 0; this.pinkB2 = 0;
        this.stagePinkB0 = 0; this.stagePinkB1 = 0; this.stagePinkB2 = 0;
        this.humPhase    = Math.random() * 2 * Math.PI;
        this.popcornState = 0;
        this.micHpState  = 0;
        this.micLpState  = 0;
        this.lofiInHpState  = 0;
        this.lofiOutHpState = 0;
        this.rmsSmooth   = 0.001;
        this.smoothAmpLevel = 0;
        this.vuCounter   = 0;
    }

    nextNoise() {
        this.noiseSeed = (this.noiseSeed * 1664525 + 1013904223) >>> 0;
        return (this.noiseSeed / 4294967296) - 0.5;
    }

    getMicTaper(n) {
        if (n <= 0) return 0; if (n >= 1) return 1;
        const xs = [0,0.05,0.20,0.35,0.50,0.65,0.80,0.95,1.0];
        const ys = [0,0.073398,0.314201,0.836420,0.943054,0.973946,0.988000,0.996000,1.0];
        for (let i = 0; i < 8; i++) {
            if (n >= xs[i] && n <= xs[i+1]) {
                return ys[i] + (n-xs[i])/(xs[i+1]-xs[i]) * (ys[i+1]-ys[i]);
            }
        }
        return 1;
    }

    getLofiTaper(n) {
        if (n <= 0) return 0; if (n >= 1) return 0.014845;
        const xs = [0,0.05,0.20,0.35,0.50,0.65,0.80,0.95,1.0];
        const ys = [0,0.000938,0.007323,0.011752,0.013114,0.013894,0.014824,0.015079,0.014845];
        for (let i = 0; i < 8; i++) {
            if (n >= xs[i] && n <= xs[i+1]) {
                return ys[i] + (n-xs[i])/(xs[i+1]-xs[i]) * (ys[i+1]-ys[i]);
            }
        }
        return 0.014845;
    }

    softClip(x, limit) {
        const thr = limit * 0.8, ax = Math.abs(x);
        if (ax < thr) return x;
        const r = limit - thr, v = thr + r * Math.tanh((ax - thr) / r);
        return x > 0 ? v : -v;
    }

    process(inputs, outputs, parameters) {
        const inp  = inputs[0] ? inputs[0][0] : null;
        const out  = outputs[0][0];
        const dt   = 1 / sampleRate;
        const gainP = parameters.gain;
        const modeP = parameters.mode;

        for (let i = 0; i < 128; i++) {
            const inputVal = inp ? inp[i] : 0; // Web Audio normalised (±1.0 = full instrument level)
            const normGain = Math.max(0, Math.min(1, gainP.length > 1 ? gainP[i] : gainP[0]));
            const mode     = Math.round(modeP.length > 1 ? modeP[i] : modeP[0]);

            // Shared noise sources (pink noise via Paul Kellett 3-pole + 60Hz hum)
            // Noise levels in normalised units (÷12 vs physical, Workshop System instrument level)
            const nr = this.nextNoise();
            const w  = nr * 2;
            this.pinkB0 = 0.99765*this.pinkB0 + w*0.0990460;
            this.pinkB1 = 0.96300*this.pinkB1 + w*0.2965164;
            this.pinkB2 = 0.57000*this.pinkB2 + w*1.0526913;
            const pink = (this.pinkB0 + this.pinkB1 + this.pinkB2 + w*0.1848) * 0.05;
            this.humPhase += 2*Math.PI*60*dt;
            if (this.humPhase > 2*Math.PI) this.humPhase -= 2*Math.PI;
            const hum = (Math.sin(this.humPhase) + 0.3*Math.sin(this.humPhase*2) + 0.15*Math.sin(this.humPhase*3)) / 1.45;

            let preampOut = 0;

            if (mode === 0) {
                // === Mode 0: Mikrophonie-style non-inverting op-amp preamp ===
                const rp = this.nextNoise();
                if (rp > 0.4998) this.popcornState = this.nextNoise() * 0.05;
                // Input-referred noise (instrument-level: 300µV/12 normalised)
                const aNoise = nr*0.00005 + pink*0.000067 + hum*0.000025 + this.popcornState*0.0001;
                const micIn  = inputVal + aNoise;

                // Input HPF: C5=4.7µF, R5=1MΩ → fc≈0.034 Hz (DC block)
                const a_hp = dt / (4.7 + dt);
                this.micHpState += a_hp * (micIn - this.micHpState);
                const hpF = micIn - this.micHpState;

                // Gain network: R7=100kΩ log-pot, R6=10kΩ, R8=510Ω
                const wP    = this.getMicTaper(normGain);
                const Rp23  = (1-wP)*100000;
                const Rg    = (10000*(Rp23+510)) / (10000+Rp23+510);
                const Rf    = wP*100000;
                const Av    = 1 + Rf/Rg;
                const a_lp  = dt / (Rf*22e-12 + dt); // C7=22pF feedback cap
                const lim   = 1.0; // ±1.0 normalised rail (=±12V physical in Workshop System)

                const Vc_lin   = this.micLpState + a_lp*((Av-1)*hpF - this.micLpState);
                const Vout_lin = hpF + Vc_lin;
                if (Math.abs(Vout_lin) > lim*0.8) {
                    preampOut = this.softClip(Vout_lin, lim);
                    this.micLpState = ((1-a_lp)*this.micLpState + a_lp*(Av-1)*preampOut) / (1+a_lp*(Av-1));
                } else {
                    this.micLpState = Vc_lin;
                    preampOut       = Vout_lin;
                }
            } else {
                // === Mode 1: BJT Differential Pair (Mini Drive) ===
                const v_n_in = nr*0.000017 + pink*0.00002 + hum*0.0000083;
                const taper  = this.getLofiTaper(normGain);
                const inAtt  = (inputVal + v_n_in) * taper;

                const a_in = dt / (1/(2*Math.PI*15.9) + dt); // HPF fc=15.9 Hz
                this.lofiInHpState += a_in * (inAtt - this.lofiInHpState);
                const v_ac = inAtt - this.lofiInHpState;

                const sr2 = this.nextNoise(), sw2 = sr2*2;
                this.stagePinkB0 = 0.99765*this.stagePinkB0 + sw2*0.0990460;
                this.stagePinkB1 = 0.96300*this.stagePinkB1 + sw2*0.2965164;
                this.stagePinkB2 = 0.57000*this.stagePinkB2 + sw2*1.0526913;
                const sp  = (this.stagePinkB0+this.stagePinkB1+this.stagePinkB2+sw2*0.1848)*0.05;
                const v_ns = (sr2*0.000025 + sp*0.000025 + hum*0.0000125) * normGain;

                // Closed-loop BJT: A_cl=201, asymmetric rails −9.2V/+5.3V → normalised by ÷12
                const vOut = Math.max(-0.767, Math.min(0.442, 201*(v_ac+v_ns)));
                const a_out = dt / (1/(2*Math.PI*1.59) + dt); // HPF fc=1.59 Hz
                this.lofiOutHpState += a_out * (vOut - this.lofiOutHpState);
                preampOut = Math.max(-1.0, Math.min(1.0, (vOut - this.lofiOutHpState)*1.58));
            }

            // VU meter (fast attack / slow decay)
            const rect = Math.abs(preampOut);
            this.rmsSmooth += (rect - this.rmsSmooth) * (rect > this.rmsSmooth ? 0.005 : 0.0005);
            out[i] = Math.max(-1.0, Math.min(1.0, preampOut)); // output IS already in ±1.0 normalised
        }

        // Post VU level every 16 frames (≈2.7 ms at 48kHz)
        if (++this.vuCounter >= 16) {
            this.vuCounter = 0;
            const db = 20*Math.log10(Math.max(1e-5, this.rmsSmooth));
            const tgt = Math.max(0, Math.min(1, (db+20)/26));
            this.smoothAmpLevel += (tgt-this.smoothAmpLevel) * (tgt>this.smoothAmpLevel ? 0.008 : 0.0004);
            this.port.postMessage({ type:'vu', level: this.smoothAmpLevel*4.5 });
        }
        return true;
    }
}
registerProcessor('amp-processor', AmpProcessor);
`;

// --- RING MODULATOR WORKLET (Schottky Diode Four-Quadrant Multiplier) ---
// Ported from Workshop System VCV RingMod.hpp (Sebastian Azevedo design)
// Double-tanh saturation on both inputs models Schottky diode forward-voltage limiting
const ringModWorkletCode = `
class RingModProcessor extends AudioWorkletProcessor {
    constructor() { super(); }

    process(inputs, outputs, parameters) {
        const inA = inputs[0] ? inputs[0][0] : null;
        const inB = inputs[1] ? inputs[1][0] : null;
        const out = outputs[0][0];

        // Physical constants (Web Audio 1.0 = 12V reference)
        // VCV: A_sat=B_sat=10V, product normalised by 5V, output ±12V rail
        const A_SAT = 10/12, B_SAT = 10/12, NORM = 5/12;

        for (let i = 0; i < 128; i++) {
            const a = inA ? inA[i] : 0;
            const b = inB ? inB[i] : 0;
            const satA = A_SAT * Math.tanh(a / A_SAT);
            const satB = B_SAT * Math.tanh(b / B_SAT);
            // Normalised multiply + output rail soft-clamp (±1.0)
            out[i] = Math.tanh((satA * satB) / NORM);
        }
        return true;
    }
}
registerProcessor('ringmod-processor', RingModProcessor);
`;

// --- STOMP WORKLET (Analog Effects Send/Return with Resistor-Network Blend) ---
// Ported from Workshop System VCV Stomp.hpp
// Resistor-network passive blend, bilinear HPF DC-blocker, stability LPF, 1-sample feedback delay
const stompWorkletCode = `
class StompProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'blend',  defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
            { name: 'fbKnob', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0 },
            { name: 'pedalboardConnected', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0 }
        ];
    }

    constructor() {
        super();
        this.hp_w_last = 0; this.hp_input_last = 0;  // HPF DC-blocker state
        this.last_V_target = 0; this.last_V_U4C_out = 0;
        this.last_V_U4C_feedback = 0; // 1-sample feedback delay (avoids algebraic loop)
        this.noiseSeed = (Math.random()*4294967295+1)>>>0;
        this.pinkB0=0; this.pinkB1=0; this.pinkB2=0;
        this.humPhase = Math.random()*2*Math.PI;
    }

    nextNoise() {
        this.noiseSeed = (this.noiseSeed*1664525+1013904223)>>>0;
        return (this.noiseSeed/4294967296)-0.5;
    }

    process(inputs, outputs, parameters) {
        const dryIn  = inputs[0] ? inputs[0][0] : null;
        const retIn  = inputs[1] ? inputs[1][0] : null;
        const sendOut  = outputs[0][0];
        const finalOut = outputs[1][0];

        const dt = 1/sampleRate;
        const blendP = parameters.blend, fbP = parameters.fbKnob;
        const pbConnectedP = parameters.pedalboardConnected;

        // HPF (DC-blocker): C28=100nF, R98=1MΩ → fc=1.59 Hz (bilinear)
        const alpha_hp = Math.exp(-2*Math.PI*1.59/sampleRate);
        // Stability LPF: R94=330kΩ, C27=47pF → fc≈10.26 kHz (bilinear)
        const K=2*(3.3e5*47e-12)*sampleRate, cb=1/(1+K), ca=(1-K)/(1+K);

        for (let i = 0; i < 128; i++) {
            const stompIn    = (dryIn ? dryIn[i] : 0) * 12; // → physical volts
            const returnJack = (retIn ? retIn[i] : 0) * 12;

            const pbConnected = pbConnectedP.length > 1 ? pbConnectedP[i] : pbConnectedP[0];
            const isPb = pbConnected > 0.5;

            this.humPhase += 2*Math.PI*60*dt;
            if (this.humPhase > 2*Math.PI) this.humPhase -= 2*Math.PI;
            const hum = (Math.sin(this.humPhase)+0.3*Math.sin(this.humPhase*2)+0.15*Math.sin(this.humPhase*3))/1.45;
            const w2 = this.nextNoise()*2;
            this.pinkB0=0.99765*this.pinkB0+w2*0.0990460;
            this.pinkB1=0.96300*this.pinkB1+w2*0.2965164;
            this.pinkB2=0.57000*this.pinkB2+w2*1.0526913;
            const pink=(this.pinkB0+this.pinkB1+this.pinkB2+w2*0.1848)*0.05;
            const n_U4A=this.nextNoise()*0.00005+pink*0.00005+hum*0.00003;
            const n_U4D=this.nextNoise()*0.0001;
            const n_U4C=this.nextNoise()*0.00005+pink*0.00005+hum*0.00003;

            // Feedback pot: 24kΩ resistor-network law on 100kΩ pot
            const x    = Math.max(0,Math.min(1, fbP.length>1 ? fbP[i] : fbP[0]));
            const num  = 31*x - 25*x*x, den = 6+50*x-50*x*x;
            const ratio = Math.abs(den)>1e-6 ? Math.max(0,Math.min(1,num/den)) : 0.5;
            const gain_fb = 2*ratio - 1; // −1..+1

            // U4D attenuverter (1-sample delay on feedback — topologically correct)
            const V_U4D = Math.max(-11.5,Math.min(11.5, gain_fb*this.last_V_U4C_feedback + n_U4D));
            // U4A input stage: −0.082× (Eurorack → instrument level)
            const V_U4A = Math.max(-11.5,Math.min(11.5, -0.082*stompIn - 0.082*V_U4D + n_U4A));

            sendOut[i] = (V_U4A / (isPb ? 0.082 : 1.0)) / 12; // Boost if pedalboard is connected, otherwise output at instrument level + normalise

            // Return: Eurorack → instrument level → HPF DC-blocker
            const Vr = returnJack * (isPb ? 0.082 : 1.0);
            const hw = Vr - this.hp_input_last + alpha_hp*this.hp_w_last;
            this.hp_input_last=Vr; this.hp_w_last=hw;
            const V_ret = hw;

            // Passive resistor-network blend (U4C, −22× inverting summer)
            const y = Math.max(0.0, Math.min(1.0, blendP.length>1 ? blendP[i] : blendP[0]));
            const tw = V_ret  * (2*y)     / (4*y+3);
            const td = V_U4A * (2*(1-y)) / (7-4*y);
            const V_target = -22*(tw+td+n_U4C);

            // Stability LPF (bilinear)
            const Vout = cb*(V_target+this.last_V_target) - ca*this.last_V_U4C_out;
            this.last_V_target = V_target;
            const Vcl = Math.max(-11.5,Math.min(11.5,Vout));
            this.last_V_U4C_out      = Vcl;
            this.last_V_U4C_feedback = Vcl;

            finalOut[i] = Vcl/12; // → normalised
        }
        return true;
    }
}
registerProcessor('stomp-processor', StompProcessor);
`;

// --- RECORDER WORKLET ---
const recorderWorkletCode = `
class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.recording = false;
        this.bufferSize = 4096;
        this.bufferIdx = 0;
        this.bufferL = new Float32Array(this.bufferSize);
        this.bufferR = new Float32Array(this.bufferSize);

        this.port.onmessage = (e) => {
            if (e.data === 'start') {
                this.recording = true;
                this.bufferIdx = 0;
            } else if (e.data === 'stop') {
                this.recording = false;
                // Flush remaining data
                if (this.bufferIdx > 0) {
                    this.sendBuffers();
                }
            }
        };
    }

    sendBuffers() {
        const l = this.bufferL.slice(0, this.bufferIdx);
        const r = this.bufferR.slice(0, this.bufferIdx);
        this.port.postMessage({ l, r }, [l.buffer, r.buffer]);
        this.bufferIdx = 0;
    }

    process(inputs) {
        if (!this.recording) return true;
        
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const inputL = input[0];
        const inputR = input[1];
        
        // Safety check
        if (!inputL || !inputR) return true;

        for (let i = 0; i < inputL.length; i++) {
            this.bufferL[this.bufferIdx] = inputL[i];
            this.bufferR[this.bufferIdx] = inputR[i];
            this.bufferIdx++;

            if (this.bufferIdx >= this.bufferSize) {
                this.sendBuffers();
            }
        }
        return true;
    }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;

// --- CVMOD WORKLET ---
const cvmodWorkletCode = `
class CVModProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'knobMain', defaultValue: 0.5 },
            { name: 'knobX', defaultValue: 0.5 },
            { name: 'knobY', defaultValue: 0.5 },
            { name: 'switchState', defaultValue: 1 }
        ];
    }

    constructor() {
        super();
        this.BUFFER_LENGTH = 384000; // 8s at 48kHz
        this.buffer = new Float32Array(this.BUFFER_LENGTH);
        this.pow2_128 = new Float32Array(128);

        // Precompute Pow2 table (emulating C++ table)
        // C++: f=2^26, f *= 2^(1/128).
        // It's basically an exponential lookup.
        // We can just use Math.pow in JS, optimization likely not critical unless heavy.
        
        this.loopSize = 96000;
        this.loopIndex = 0;
        this.playbackPhase = [0, 0, 0, 0];
        this.recordPhase = 0;
        
        this.sampleCount = 0;
        
        this.pulseFlashCounter = 0;
        this.resetTrigger = false;
        this.nextFunctionTrigger = false;
        this.lastSwitch = 1;

        this.function = 0; // 0=Ramp, 1=Saw, 2=Tri, 3=Sin, 4=Steps
        this.funcLeds = [1, 3, 2, 6, 4]; // Bitmasks

        this.lastExtraRecordingIndex = 0;
        
        this.ledFrame = 0;
        this.speedZero = false;

        this.zeroArray = new Float32Array(128);
    }

    process(inputs, outputs, parameters) {
        // In: 0:Rec, 1:SpeedCV, 2:TimeCV, 3:PhaseCV, 4:Rst, 5:Tog
        const inRec = inputs[0][0] || this.zeroArray;
        const inSpeed = inputs[1][0] || this.zeroArray;
        const inTime = inputs[2][0] || this.zeroArray;
        const inPhase = inputs[3][0] || this.zeroArray;
        const inP1 = inputs[4][0] || this.zeroArray;
        const inP2 = inputs[5][0] || this.zeroArray;

        // Out: 0:H1, 1:H2, 2:H3, 3:H4
        const out1 = outputs[0][0];
        const out2 = outputs[1][0];
        const out3 = outputs[2][0];
        const out4 = outputs[3][0];

        const pMain = parameters.knobMain[0];
        const pX = parameters.knobX[0];
        const pY = parameters.knobY[0];
        const pSwitch = Math.round(parameters.switchState[0]);

        // Detect Switch Edges
        // 0=Up (Toggle Func), 1=Mid, 2=Down (Reset)
        if (pSwitch !== this.lastSwitch) {
            if (pSwitch === 2 && this.lastSwitch !== 2) this.resetTrigger = true; // Down Edge -> Reset
            if (pSwitch === 0 && this.lastSwitch !== 0) this.nextFunctionTrigger = true; // Up Edge -> Next Function
            this.lastSwitch = pSwitch;
        }

        for (let i = 0; i < 128; i++) {
            // Pulse Triggers
            if (inP1[i] > 0.5 && this.lastP1 <= 0.5) this.resetTrigger = true;
            this.lastP1 = inP1[i];
            
            if (inP2[i] > 0.5 && this.lastP2 <= 0.5) this.nextFunctionTrigger = true;
            this.lastP2 = inP2[i];


            if (this.nextFunctionTrigger) {
                this.function = (this.function + 1) % 5;
                this.nextFunctionTrigger = false;
            }

            // Controls
            let phaseKnob = (pY * 4095) + (inPhase[i] * 2048); // 0..4095
            phaseKnob = Math.max(0, Math.min(4095, phaseKnob));

            let timeKnobVal = (pX * 4095) + (inTime[i] * 2048);
            timeKnobVal = Math.max(0, Math.min(4095, timeKnobVal));

            // Speed Knob (-1900 to 1900 approx)
            let speedKnob = (pMain * 4096) - 2048; 
            // Deadzone
            if (speedKnob > 100) speedKnob -= 100;
            else if (speedKnob < -100) speedKnob += 100;
            else speedKnob = 0;

            speedKnob += (inSpeed[i] * 2048);
            speedKnob = Math.max(-1900, Math.min(1900, speedKnob));
            
            this.speedZero = (speedKnob === 0);

            // Loop Size
            // C++: Pow2(39125 + timeKnob*7)
            // Range: 39125 to 67790
            // Pow2 maps these to some range.
            // If we assume a similar exponential mapping:
            // Shortest: ~62ms, Longest: ~8s.
            // 48kHz sample logic.
            const minS = 3000; // ~62ms
            const maxS = 380000; 
            
            // Logarithmic mapping for X?
            // Simple exponential: min * (max/min)^k
            const ratio = maxS / minS; // ~126
            // k = timeKnobVal / 4095
            const k = timeKnobVal / 4095.0;
            this.loopSize = Math.floor(minS * Math.pow(ratio, k));
            
            if (this.loopSize >= this.BUFFER_LENGTH) this.loopSize = this.BUFFER_LENGTH - 1;

            this.loopIndex++;
            if (this.loopIndex >= this.loopSize) {
                this.loopIndex = 0;
                this.pulseFlashCounter = 2400; // Flash
            }

            // Loop Increment (32-bit phase space)
            // 2^32 / loopSize
            const loopIncrement = 4294967296.0 / this.loopSize;
            this.recordPhase = (this.loopIndex / this.loopSize) * 4294967296.0;

            let recVal = inRec[i];
            this.buffer[this.loopIndex] = recVal;
            
            // Playback Phase Advance
            for (let h=0; h<4; h++) {
                // Exponential Rate Logic
                // s = speedKnob (-1900..1900)
                // k = 2 * (2*h - 3) -> coeff per head (-6, -2, 2, 6)
                // multiplier = 2 ^ (s * k / 4096)
                
                const s = speedKnob; 
                const coeff = 2 * (2*h - 3);
                
                // Avoid heavy Math.pow every sample if possible, but 4x per sample is likely fine on modern engines.
                // Optimize: (s*k)/4096
                const power = (s * coeff) / 4096.0;
                const multiplier = Math.pow(2, power);
                
                const rate = loopIncrement * multiplier;
                
                this.playbackPhase[h] += rate;
            }

            if (this.resetTrigger) {
                for(let h=0; h<4; h++) this.playbackPhase[h] = this.recordPhase;
                this.resetTrigger = false;
            }

            // Calc Positions
            const readPos = [];
            for(let h=0; h<4; h++) {
                let p = this.playbackPhase[h];
                // Subtract Phase Knob offset
                // phaseKnob * i * 262144 (large offset)
                // We are in 32-bit domain.
                const offset = phaseKnob * h * 10000000; // scale up
                p -= offset;
                
                // Function Transform
                p = this.applyFunction(this.function, p);
                
                // Map to buffer
                // (p * loopSize) >> 32
                // JS: p / 2^32 * loopSize
                const norm = (p >>> 0) / 4294967296.0;
                let sIdx = norm * this.loopSize;
                
                // Wrap safely
                while(sIdx < 0) sIdx += this.loopSize;
                while(sIdx >= this.loopSize) sIdx -= this.loopSize;
                
                readPos[h] = sIdx;
            }

            // Output
            if (out1) out1[i] = this.readSmooth(readPos[0]);
            if (out2) out2[i] = this.readSmooth(readPos[1]);
            if (out3) out3[i] = this.readSmooth(readPos[2]);
            if (out4) out4[i] = this.readSmooth(readPos[3]);
        }
        
        // LEDs
        this.ledFrame++;
        if (this.ledFrame > 64) {
            this.ledFrame = 0;
            if (this.pulseFlashCounter > 0) this.pulseFlashCounter -= 100;
            
            this.port.postMessage({
                leds: this.funcLeds[this.function],
                speedZero: this.speedZero,
                flash: this.pulseFlashCounter > 0
            });
        }

        return true;
    }

    readSmooth(pos) {
        const iA = Math.floor(pos);
        const iB = (iA + 1) % this.loopSize;
        const frac = pos - iA;
        return this.buffer[iA] + (this.buffer[iB] - this.buffer[iA]) * frac;
    }

    applyFunction(type, phase) {
        // Phase is signed 32-int treated.
        // We use JS numbers, so convert to signed 32 range -2^31 .. 2^31 approx?
        // Or normalized 0..1?
        // Let's use normalized 0..1 from the earlier (p >>> 0) logic, but do func first.
        
        // Let's treat phase as 0..1 float for easier math, wrapping 1->0
        let p = (phase >>> 0) / 4294967296.0;
        
        switch(type) {
            case 0: // Ramp
                return phase; 
            case 1: // Saw (Inverted Ramp)
                return (-p) * 4294967296.0;
            case 2: // Tri
                // 0..0.5 -> 0..1, 0.5..1 -> 1..0
                if (p < 0.5) return (p * 2) * 4294967296.0;
                else return ((1.0 - p) * 2) * 4294967296.0;
            case 3: // Sin
                return (0.5 - 0.5 * Math.cos(2 * Math.PI * p)) * 4294967296.0;
            case 4: // Steps
                // Quantize to 16 steps
                const steps = 16;
                return (Math.floor(p * steps) / steps) * 4294967296.0;
        }
        return phase;
    }
}
registerProcessor('cvmod-processor', CVModProcessor);
`;

// --- SHEEP WORKLET ---
const sheepWorkletCode = `
class SheepProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'knobMain', defaultValue: 0.5 },
            { name: 'knobX', defaultValue: 0.5 },
            { name: 'knobY', defaultValue: 0.5 },
            { name: 'switchState', defaultValue: 1 }, // 0=Freeze, 1=Normal, 2=Loop
            { name: 'connectedCV1', defaultValue: 0 },
            { name: 'connectedCV2', defaultValue: 0 },
            { name: 'connectedPulse1', defaultValue: 0 },
            { name: 'connectedPulse2', defaultValue: 0 }
        ];
    }

    constructor() {
        super();
        // Buffer Config
        // 5 seconds @ 48kHz = 240,000 samples.
        this.BUFFER_LENGTH = 240000; 
        this.bufferL = new Float32Array(this.BUFFER_LENGTH);
        this.bufferR = new Float32Array(this.BUFFER_LENGTH);
        this.writeHead = 0;

        // Constants
        this.MAX_GRAINS = 14;
        this.SAFETY_MARGIN = 120;
        
        // Grains
        this.grains = [];
        for(let i=0; i<this.MAX_GRAINS; i++) {
            this.grains.push({
                active: false,
                readPos: 0,     // Float for fractional reading
                sampleCount: 0,
                startPos: 0,
                loopSize: 0,
                looping: false,
                pulseTriggered: false,
                speed: 1.0,
                baselineCtrl: 0,
                delayDist: 0,
                spread: 0,
                size: 1000
            });
        }

        // State
        this.loopMode = false;
        this.globalSampleCounter = 0;
        this.lastP1 = 0;
        
        // Output pulse counters
        this.pulse1Counter = 0;
        this.pulse2Counter = 0;
        this.stochasticCounter = 0;
        
        // Output Value State
        this.cv1Noise = 0;
        this.cv2Phase = 0;
        
        // Cached calculations
        this.cachedActiveCount = 0;
        this.invSampleRate = 1.0 / 48000;
        
        // LED downsampling
        this.ledFrame = 0;
        this.lastOutL = 0;
        this.lastOutR = 0;
    }

    process(inputs, outputs, parameters) {
        // I/O
        // In: 0:L, 1:R, 2:CV1, 3:CV2, 4:P1, 5:P2
        const inL = inputs[0][0] || new Float32Array(128).fill(0);
        const inR = inputs[1][0] || new Float32Array(128).fill(0);
        const inCV1 = inputs[2][0] || new Float32Array(128).fill(0);
        const inCV2 = inputs[3][0] || new Float32Array(128).fill(0);
        const inP1 = inputs[4][0] || new Float32Array(128).fill(0);
        const inP2 = inputs[5][0] || new Float32Array(128).fill(0);

        // Out
        const outL = outputs[0][0];
        const outR = outputs[1][0];
        const outCV1 = outputs[2][0];
        const outCV2 = outputs[3][0];
        const outP1 = outputs[4][0];
        const outP2 = outputs[5][0];

        // Params
        // We'll just take the first value for efficiency (audio-rate changes for these might be overkill)
        const pMain = parameters.knobMain[0];
        const pX = parameters.knobX[0];
        const pY = parameters.knobY[0];
        const pSw = Math.round(parameters.switchState[0]);
        const connCV1 = parameters.connectedCV1[0] > 0.5;
        const connCV2 = parameters.connectedCV2[0] > 0.5;
        const connP1 = parameters.connectedPulse1[0] > 0.5;
        const connP2 = parameters.connectedPulse2[0] > 0.5;

        // Process Loop
        for (let i = 0; i < 128; i++) {
            this.globalSampleCounter++;

            // --- 1. Audio Recording ---
            // If not frozen (Switch Up = 0)
            if (pSw !== 0) {
                 this.bufferL[this.writeHead] = inL[i];
                 this.bufferR[this.writeHead] = inR[i];
            }
            
            this.writeHead++;
            if (this.writeHead >= this.BUFFER_LENGTH) this.writeHead = 0;

            // --- 2. Parameters & Control Logic ---
            
            // X Knob: Delay/Spread
            let delayTime = 0;
            let spreadAmt = 0; 
            
            if (!connCV1) {
                // X Knob split: Left=Delay, Right=Spread
                if (pX <= 0.5) {
                    // Normalize 0..0.5 to 0..1
                    const normalized = pX * 2.0; 
                    delayTime = 1200 + (normalized * 78800);
                } else {
                    // Spread
                    delayTime = 20000; 
                    spreadAmt = (pX - 0.5) * 2.0; // 0..1
                }
            } else {
                // CV1 Connected: X is attenuverter.
                // Logic handled in Trigger logic
                delayTime = 20000;
                spreadAmt = 0;
            }

            // --- 3. Trigger Logic ---
            let trig = false;
            // Pulse 1 rising edge
            if (inP1[i] > 0.5 && this.lastP1 <= 0.5) trig = true;
            this.lastP1 = inP1[i];

            // Auto-trigger if needed
            if (!connP1) {
                // Check if we need to auto-trigger (no active grains?)
                if (this.cachedActiveCount === 0) {
                     // Check Gate P2
                     if (connP2) {
                         if (inP2[i] > 0.5) trig = true;
                     } else {
                         trig = true;
                     }
                }
            } else {
               // Ext trigger
               // Check Gate P2 if connected
               if (connP2 && inP2[i] < 0.5) trig = false;
            }

            // Mode Switching Logic
            if (pSw === 0) { // Frozen
               // Trig normally
            } else if (pSw === 2) { // Loop Mode
                if (!this.loopMode) {
                    this.loopMode = true;
                    this.enterLoopMode(pMain, connCV2, inCV2[i]);
                }
            } else { // Normal (1)
                if (this.loopMode) {
                    this.loopMode = false;
                    this.exitLoopMode();
                }
            }

            if (trig) {
                this.triggerGrain(pMain, pX, pY, delayTime, spreadAmt, connCV1, inCV1[i], pSw);
            }

            // --- 4. Render Output ---
            let mixL = 0; 
            let mixR = 0;
            let totalWeight = 0;

            this.updateGrains(pMain, pY, connCV2, inCV2[i], connP1);

            for (let g=0; g<this.MAX_GRAINS; g++) {
                const gr = this.grains[g];
                if (gr.active) {
                    const weight = this.getGrainWeight(gr);
                    const s = this.readBufferInterpolated(gr.readPos);
                    mixL += s.l * weight; 
                    mixR += s.r * weight; 
                    totalWeight += weight;
                }
            }
            
            // Normalize
            let finalL = 0;
            let finalR = 0;
            if (totalWeight > 0.001) {
                finalL = mixL / totalWeight;
                finalR = mixR / totalWeight;
            }

            // Outputs
            if (outL) outL[i] = finalL;
            if (outR) outR[i] = finalR;

            this.lastOutL = finalL;
            this.lastOutR = finalR;

            // --- 5. CV/Pulse Outputs ---
            // CV1: Noise val
            if (outCV1) outCV1[i] = this.cv1Noise; 
            
            // CV2: Phase (Writehead) 0..1
            this.cv2Phase = this.writeHead / this.BUFFER_LENGTH;
            if (outCV2) outCV2[i] = this.cv2Phase;

            // Pulse Outputs
            this.updatePulseOutputs(pX, pY);
            if (outP1) outP1[i] = this.pulse1Counter > 0 ? 1 : 0;
            if (outP2) outP2[i] = this.pulse2Counter > 0 ? 1 : 0;
        }

        // --- LED Feedback ---
        this.ledFrame++;
        if (this.ledFrame > 64) {
            this.ledFrame = 0;
            this.port.postMessage({
                L: Math.abs(this.lastOutL),
                R: Math.abs(this.lastOutR),
                cv1: (this.cv1Noise + 1) * 0.5,
                cv2: this.cv2Phase,
                p1: this.pulse1Counter > 0 ? 1 : 0,
                p2: this.pulse2Counter > 0 ? 1 : 0
            });
        }

        return true;
    }

    readBufferInterpolated(pos) {
        let p = pos;
        while (p < 0) p += this.BUFFER_LENGTH;
        while (p >= this.BUFFER_LENGTH) p -= this.BUFFER_LENGTH;
        
        const idxA = Math.floor(p);
        const frac = p - idxA;
        
        const safeIdxA = idxA % this.BUFFER_LENGTH;
        const safeIdxB = (idxA + 1) % this.BUFFER_LENGTH;

        const lA = this.bufferL[safeIdxA];
        const rA = this.bufferR[safeIdxA];
        const lB = this.bufferL[safeIdxB];
        const rB = this.bufferR[safeIdxB];

        return {
            l: lA + (lB - lA) * frac,
            r: rA + (rB - rA) * frac
        };
    }

    triggerGrain(pMain, pX, pY, delayTime, spreadAmt, connCV1, cv1Val, pSw) {
        // Find free grain
        let g = null;
        let activeCount = 0;
        for(let i=0; i<this.MAX_GRAINS; i++) {
             if (this.grains[i].active) activeCount++;
             else if (!g) g = this.grains[i];
        }
        this.cachedActiveCount = activeCount;

        if (!g) return; // Full

        g.active = true;
        this.cachedActiveCount++;
        
        // Grain Size from Y
        const minS = 240; // 5ms
        const maxS = 48000; // 1s
        g.size = minS + (pY * (maxS - minS));
        
        // Base Pos
        let basePos = this.writeHead - delayTime;
        if (basePos < 0) basePos += this.BUFFER_LENGTH;
        
        // Target Pos logic
        let targetPos = basePos;
        if (connCV1) {
             // CV1 Position with X Attenuverter
             const atten = (pX - 0.5) * 2.0; 
             const offset = cv1Val * atten;
             const halfBuf = this.BUFFER_LENGTH / 2;
             targetPos = (this.BUFFER_LENGTH * 0.5) + (offset * halfBuf);
        } else if (spreadAmt > 0) {
             // Spread
             const rnd = (Math.random() - 0.5) * 2.0; // -1..1
             const maxSpread = this.BUFFER_LENGTH * 0.125; 
             targetPos = basePos + (rnd * maxSpread * spreadAmt);
        }
        
        // Wrap
        while (targetPos < 0) targetPos += this.BUFFER_LENGTH;
        while (targetPos >= this.BUFFER_LENGTH) targetPos -= this.BUFFER_LENGTH;
        
        // Write Head Safety (only if not frozen)
        if (pSw !== 0) {
            const margin = this.SAFETY_MARGIN;
            let dist = this.writeHead - targetPos;
            if (dist < 0) dist += this.BUFFER_LENGTH;
            if (dist < margin) {
                targetPos = this.writeHead - margin;
            }
        }

        g.readPos = targetPos;
        g.startPos = targetPos;
        g.sampleCount = 0;
        g.pulseTriggered = false;
        
        // Initial Speed
        g.speed = this.calcSpeed(pMain, false, 0); 
        
        // New Noise Value for CV1
        this.cv1Noise = (Math.random() - 0.5) * 2;
    }

    calcSpeed(pMain, connCV2, cv2Val) {
         let val = pMain;
         
         if (!connCV2) {
             // Virtual Detents
             if (Math.abs(val - 0.5) < 0.05) val = 0.5; // Stop
             if (Math.abs(val - 0.75) < 0.05) val = 0.75; // 1x
             if (Math.abs(val - 0.25) < 0.05) val = 0.25; // -1x
         }
         
         // Map 0..1 to -2..2
         let speed = (val - 0.5) * 4.0;
         
         if (connCV2) {
             // CV2 Speed Mod
             const gain = (pMain - 0.5) * 2;
             speed = 1.0 + (cv2Val * gain);
         }
         return speed;
    }

    updateGrains(pMain, pY, connCV2, cv2Val, connP1) {
        const globalSpeed = this.calcSpeed(pMain, connCV2, cv2Val);

        for (let i=0; i<this.MAX_GRAINS; i++) {
            let g = this.grains[i];
            if (!g.active) continue;
            
            let spd = globalSpeed; 
            // In loop mode, use global speed? C++ says yes but with baseline offset.
            // keeping it simple: always use current knob/cv speed
            
            g.readPos += spd;
            g.sampleCount++;

            // Loop / End logic
            if (g.looping) {
                 if (g.sampleCount >= g.size) {
                      g.readPos = g.startPos;
                      g.sampleCount = 0;
                      g.pulseTriggered = false;
                 }
            } else {
                 if (g.sampleCount >= g.size) {
                      g.active = false; 
                      this.cachedActiveCount--;
                 }
            }

            // Pulse Trigger (90%)
            if (g.active && !g.pulseTriggered) {
                 const thresh = connP1 ? 0.9 : (0.9 - (pY * 0.8)); // 90% -> 10%
                 if (g.sampleCount > (g.size * thresh)) {
                      g.pulseTriggered = true;
                      this.pulse1Counter = 100;
                 }
            }
        }
    }
    
    getGrainWeight(g) {
        if (g.looping) return 1.0; 
        if (g.sampleCount >= g.size) return 0.0;
        
        // Hann Window
        const x = g.sampleCount / g.size; 
        return 0.5 * (1.0 - Math.cos(2.0 * Math.PI * x));
    }

    enterLoopMode(pMain, connCV2, cv2Val) {
        this.cachedActiveCount = 0;
        let any = false;
        for(let g of this.grains) {
            if (g.active) {
                g.looping = true;
                any = true;
                this.cachedActiveCount++;
            }
        }
        if (!any) {
             this.triggerGrain(pMain, 0.5, 0.5, 0, 0, false, 0, 2); 
             for(let g of this.grains) { if(g.active) { g.looping=true; break; } }
        }
    }

    exitLoopMode() {
        for(let g of this.grains) {
            g.looping = false;
        }
    }

    updatePulseOutputs(pX, pY) {
         if (this.pulse1Counter > 0) this.pulse1Counter--;
         if (this.pulse2Counter > 0) this.pulse2Counter--;
         
         // Stochastic Clock
         const period = 240 + ((1.0 - pY) * 48000 * 0.5); 
         
         this.stochasticCounter++;
         if (this.stochasticCounter > period) {
             this.stochasticCounter = 0;
             const rnd = Math.random();
             if (rnd < pX && this.pulse2Counter <= 0) {
                 this.pulse2Counter = 100;
             }
         }
    }
}
registerProcessor('sheep-processor', SheepProcessor);
`;





// --- STEP SEQUENCER WORKLET ---
const sequencerWorkletCode = `
class StepSequencerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        const params = [];
        for (let i = 0; i < 8; i++) {
            params.push({ name: 'step' + i, defaultValue: 0, minValue: 0, maxValue: 1 });
        }
        params.push({ name: 'rate', defaultValue: 0, minValue: 0, maxValue: 50 });
        params.push({ name: 'quantize', defaultValue: 0, minValue: 0, maxValue: 5 });
        params.push({ name: 'useExternal', defaultValue: 0, minValue: 0, maxValue: 1 });
        return params;
    }

    constructor() {
        super();
        this.currentStep = 0;
        this.lastClock = 0;
        this.gateTimer = 0;
        this.phase = 0;
        this.triggerSamples = 480; // 10ms at 48k
        
        // Scales (Intervals from Root)
        this.scales = [
            null, // 0: Raw
            [0,1,2,3,4,5,6,7,8,9,10,11], // 1: Chromatic
            [0,2,4,5,7,9,11], // 2: Major
            [0,2,3,5,7,8,10], // 3: Minor
            [0,2,4,7,9], // 4: Major Pentatonic
            [0,3,5,7,10] // 5: Minor Pentatonic
        ];
    }

    getQuantized(value, mode) {
        if (mode < 0.5) return value; // Off

        // Assume 0.0 - 1.0 covers 5 Octaves (60 semitones)
        // 1.0 value = 5V? Let's standardise on 1.0 = 5 Octaves for now
        const TOTAL_SEMITONES = 60;
        
        // Round to nearest EXACT semitone first to avoid float precision jitter
        let semitoneGlobal = Math.round(value * TOTAL_SEMITONES);
        
        let octave = Math.floor(semitoneGlobal / 12);
        let semitoneInOct = semitoneGlobal % 12;
        if (semitoneInOct < 0) semitoneInOct += 12; // Handle negative modulation safely
        
        let scaleIdx = Math.round(mode);
        if (scaleIdx < 1) scaleIdx = 1;
        if (scaleIdx >= this.scales.length) scaleIdx = this.scales.length - 1;
        
        const scale = this.scales[scaleIdx];
        
        // Snap to nearest in scale
        let best = scale[0];
        let minDist = 100;
        
        for (let note of scale) {
            let dist = Math.abs(note - semitoneInOct);
            if (dist < minDist) {
                minDist = dist;
                best = note;
            }
        }
        
        let finalSemitone = (octave * 12) + best;
        return finalSemitone / TOTAL_SEMITONES;
    }

    process(inputs, outputs, parameters) {
        const clockIn = inputs[0][0];
        const cvOut = outputs[0][0];
        const gateOut = outputs[1][0];
        const quantOut = outputs[2] ? outputs[2][0] : null;

        const rateParam = parameters.rate;
        const useExtParam = parameters.useExternal;
        const quantParam = parameters.quantize;
        
        const blockSize = cvOut ? cvOut.length : 128;
        const sampleRate = 48000;

        for (let i = 0; i < blockSize; i++) {
            let trigger = false;
            
            // 1. Clock Logic
            const useExternal = (useExtParam.length > 1 ? useExtParam[i] : useExtParam[0]) > 0.5;
            
            if (useExternal) {
                // External Clock
                let clk = (clockIn && clockIn.length > i) ? clockIn[i] : 0;
                
                // Lower threshold to 0.1 for square waves / unipolar / weak signals
                if (clk > 0.1 && this.lastClock <= 0.1) {
                    trigger = true;
                }
                this.lastClock = clk;
            } else {
                // Internal Clock
                const rate = rateParam.length > 1 ? rateParam[i] : rateParam[0];
                if (rate > 0.1) {
                    this.phase += rate / sampleRate;
                    if (this.phase >= 1.0) {
                        this.phase -= 1.0;
                        trigger = true;
                    }
                }
            }

            if (trigger) {
                this.currentStep = (this.currentStep + 1) % 8;
                this.gateTimer = this.triggerSamples;
            }

            // 2. Output Handling
            const stepName = 'step' + this.currentStep;
            const stepParam = parameters[stepName];
            const rawVal = (stepParam.length > 1) ? stepParam[i] : (stepParam[0] || 0);

            if (cvOut) cvOut[i] = rawVal;
            
            // Quantizer
            if (quantOut) {
                const mode = quantParam.length > 1 ? quantParam[i] : quantParam[0];
                quantOut[i] = this.getQuantized(rawVal, mode);
            }

            // Gate
            if (gateOut) {
                gateOut[i] = (this.gateTimer > 0) ? 1.0 : 0.0;
            }
            
            if (this.gateTimer > 0) this.gateTimer--;
        }

        return true;
    }
}
registerProcessor('sequencer-processor', StepSequencerProcessor);
`;

const TWISTS_WORKLET_CODE = `
class TwistsProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{ name: 'pitch_freq', defaultValue: 440, minValue: 10, maxValue: 20000 }];
    }

    constructor() {
        super();
        this.phase = 0;
        this.envelope = 0;
        this.gate = false;
        this.pulse = false; // <-- ADDED: State for the Pulse 1 trigger
        
        // Envelope State Machine: 0:Idle, 1:Attack, 2:Hold, 3:Release
        this.envState = 0; 
        
        this.p1 = 0; 
        this.p2 = 0; 
        this.shape = 'CSAW';
        this.lpState = 0;

        this.port.onmessage = (e) => {
            // Destructure the new 'pulse' property
            const { shape, gate, p1, p2, pulse } = e.data; 
            if (shape) this.shape = shape;
            if (gate !== undefined) this.gate = gate;
            if (p1 !== undefined) this.p1 = p1;
            if (p2 !== undefined) this.p2 = p2;
            if (pulse !== undefined) this.pulse = pulse; // <-- ADDED: Capture the incoming pulse trigger
        };
    }
    
    // --- DSP ALGORITHMS (Simplified Braids) ---

    renderCSaw(p1, p2) {
        const mix = this.p1 / 32767.0;
        const pw = 0.5 + (this.p2 / 65536.0); 
        const saw = (2.0 * this.phase) - 1.0;
        const sqr = this.phase < pw ? 1.0 : -1.0;
        return (saw * (1.0 - mix)) + (sqr * mix);
    }

    renderFold(p1, p2) {
        let tri = 0;
        if (this.phase > 0.75) tri = (this.phase - 1.0) * 4.0;
        else if (this.phase > 0.25) tri = 2.0 - (this.phase * 4.0);
        else tri = this.phase * 4.0;
        
        const gain = 1.0 + (this.p1 / 2000.0);
        let x = tri * gain;

        while (Math.abs(x) > 1.0) {
            if (x > 1.0) x = 2.0 - x;
            else if (x < -1.0) x = -2.0 - x;
        }
        const sat = 1.0 + (this.p2 / 10000);
        return Math.tanh(x * sat);
    }

    renderSuperSaw(p1, p2) {
        const detuneAmt = (this.p1 / 32767.0) * 0.05;
        const mix = this.p2 / 32767.0;
        
        const s1 = (2.0 * this.phase) - 1.0;
        const s2 = (2.0 * ((this.phase + detuneAmt) % 1.0)) - 1.0;
        const s3 = (2.0 * ((this.phase - detuneAmt) % 1.0)) - 1.0;
        
        return (s1 * 0.5) + ((s2 + s3) * 0.25 * mix);
    }
    
    renderDigitalFilter(p1, p2) {
        let noise = Math.random() * 2 - 1;
        const center = this.phaseInc * (1 + this.p1 / 32767.0);
        const cutoff = Math.min(center * 50, 0.9);
        this.lpState += (noise - this.lpState) * cutoff;
        return this.lpState;
    }

    renderVowel(p1, p2) {
        const f1 = 200 + (this.p1 * 4000 / 32767);
        const f2 = 1000 + (this.p2 * 6000 / 32767);
        const carrier = Math.sin(this.phase * 2 * Math.PI);
        const p_f1 = (this.phase * f1 / 2000.0) % 1.0;
        const p_f2 = (this.phase * f2 / 2000.0) % 1.0;

        let sample = 0;
        sample += Math.sin(p_f1 * 2 * Math.PI) * 0.5;
        sample += Math.sin(p_f2 * 2 * Math.PI) * 0.3;
        
        return sample * carrier * 1.5;
    }
    
    renderHarmonics(p1, p2) {
        let sample = 0;
        const numHarmonics = 8;
        const peak = (this.p1 / 32767.0) * numHarmonics;
        const width = 1.0 + (this.p2 / 32767.0);

        for (let h = 1; h <= numHarmonics; h++) {
            const dist = Math.abs(h - peak) / numHarmonics;
            let amp = Math.exp(-dist * dist * 10 * width); 
            sample += Math.sin(this.phase * 2 * Math.PI * h) * amp;
        }
        return sample * 0.5;
    }


    process(inputs, outputs, parameters) {
        const output = outputs[0][0];
        const freq_param = parameters.pitch_freq;
        const sampleRate = 48000;

        for (let i = 0; i < output.length; i++) {
            
            // --- AHR ENVELOPE LOGIC ---
            if (this.gate) {
                if (this.envState === 0 || this.envState === 3) {
                    this.envState = 1; 
                }
            } else {
                if (this.envState === 1 || this.envState === 2) {
                    this.envState = 3; 
                }
            }

            if (this.envState === 1) { 
                this.envelope += 0.005;
                if (this.envelope >= 1.0) { 
                    this.envelope = 1.0; 
                    this.envState = 2;
                } 
            } 
            else if (this.envState === 2) { 
                this.envelope = 1.0; 
            }
            else if (this.envState === 3) { 
                this.envelope *= 0.9995;
                if (this.envelope < 0.001) { 
                    this.envelope = 0; 
                    this.envState = 0;
                } 
            }
            
            // --- PULSE 1 (SYNC) LOGIC ---
            if (this.pulse) {
                this.phase = 0; // <-- The Fix: Reset phase on Pulse 1 trigger
                this.pulse = false; // Consume the trigger
            }

            const current_freq = freq_param.length > 1 ? freq_param[i] : freq_param[0];
            this.phaseInc = current_freq / sampleRate;
            
            this.phase += this.phaseInc;
            if (this.phase >= 1.0) this.phase -= 1.0;
            
            let sample = 0;
            switch (this.shape) {
                case 'CSAW': sample = this.renderCSaw(); break;
                case 'FOLD': sample = this.renderFold(); break;
                case 'SAWx3': sample = this.renderSuperSaw(); break;
                case 'ZLPF': sample = this.renderDigitalFilter(); break;
                case 'VOWL': sample = this.renderVowel(); break;
                case 'HARM': sample = this.renderHarmonics(); break;
                default: sample = 0;
            }

            output[i] = sample * this.envelope * 0.5;
        }
        
        this.port.postMessage({ envelope: this.envelope });
        return true;
    }
}
registerProcessor('twists-processor', TwistsProcessor);
`;


/* =========================================================================
/* =========================================================================
   CORE AUDIO ENGINE & CONTEXT MANAGEMENT
   ========================================================================= */

// --- GLOBALS PROVIDED BY GLOBALS.JS ---
// audioCtx, audioNodes, isScopeRunning, midiAccess, etc.

function toggleAudio() {
    const btn = document.getElementById('audioToggle');

    // 1. If context does NOT exist, create it, build the graph, and RETURN.
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        buildAudioGraph();

        // Unconditionally update UI and exit to prevent the double-toggle bug.
        btn.classList.add('audio-is-running');
        btn.title = "Stop Audio Engine";

        // Auto-start Scope
        if (typeof initScope === 'function') initScope();
        if (typeof resetScopeBuffers === 'function') resetScopeBuffers();
        isScopeRunning = true;
        if (typeof drawScope === 'function') requestAnimationFrame(drawScope);

        return;
    }

    // 2. Handle state transitions for existing context
    if (audioCtx.state === 'running') {
        // Turn OFF
        audioCtx.suspend().then(() => {
            btn.classList.remove('audio-is-running');
            btn.title = "Start Audio Engine";
            isScopeRunning = false;
        });
    } else if (audioCtx.state === 'suspended') {
        // Turn ON
        audioCtx.resume().then(() => {
            btn.classList.add('audio-is-running');
            btn.title = "Stop Audio Engine";

            // Auto-restart Scope
            isScopeRunning = true;
            if (typeof drawScope === 'function') requestAnimationFrame(drawScope);
        });
    }
}

async function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Configure for multi-channel output if available
        const maxCh = audioCtx.destination.maxChannelCount;
        console.log(`[Audio Output] Max Channels Available: ${maxCh}`);

        if (maxCh >= 6) {
            audioCtx.destination.channelCount = 6;
        } else {
            audioCtx.destination.channelCount = maxCh;
        }

        audioCtx.destination.channelCountMode = 'explicit';
        audioCtx.destination.channelInterpretation = 'discrete'; // Critical for forcing separate channels

        console.log(`[Audio Output] Configured for ${audioCtx.destination.channelCount} channels (Discrete).`);

        buildAudioGraph();
        await listAudioDevices(); // Populate devices
        showMessage("Audio Engine Initialized", "success");
    }
}


function updateAudioGraph() {
    if (audioCtx) buildAudioGraph();
}

/* =========================================================================
   INPUT HANDLING (MICROPHONE & MIDI)
   ========================================================================= */

let currentMicStream = null;

async function initMic(deviceId = 'default') {
    if (!audioCtx) await initAudio();

    try {
        // If restarting, close old stream
        if (currentMicStream) {
            currentMicStream.getTracks().forEach(track => track.stop());
            currentMicStream = null;
        }

        // 1. Request Audio with specific device if provided
        // Suggest 6 channels for the new USB audio card features

        // First, try with exact:6 to force 6-channel mode
        let constraints = {
            audio: {
                deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
                highpassFilter: false,
                channelCount: { exact: 6 }
            }
        };

        let stream = null;

        // Try exact 6 channels first
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('[Audio Input] Successfully acquired with exact:6 channels');
        } catch (err) {
            console.warn('[Audio Input] Could not get exact 6 channels, trying ideal:', err.message);

            // Fallback to ideal:6, min:1
            // Keep deviceId exact if specified!
            constraints.audio.channelCount = { ideal: 6, min: 1 };
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('[Audio Input] Acquired with ideal:6 fallback');
            } catch (err2) {
                throw err2; // Let the outer catch handle it
            }
        }

        currentMicStream = stream;

        const mediaStreamSource = audioCtx.createMediaStreamSource(stream);
        const tracks = stream.getAudioTracks();

        console.log(`[Audio Input] Active tracks: ${tracks.length}`);

        if (tracks.length > 0) {
            tracks.forEach((track, idx) => {
                console.log(`[Audio Input] Track ${idx}: ${track.label}`);
                const settings = track.getSettings();
                console.log(`  Settings:`, settings);
                const caps = track.getCapabilities();
                console.log(`  Capabilities:`, caps);
                if (caps.channelCount) {
                    console.log(`  Channel Count Range:`, JSON.stringify(caps.channelCount));
                }
            });

            // Check actual channel count
            const settings = tracks[0].getSettings();
            const actualChannels = settings.channelCount || 2;
            console.log(`[Audio Input] Actual channel count: ${actualChannels}`);

            if (actualChannels < 6) {
                console.warn(`[Audio Input] WARNING: Only got ${actualChannels} channels, but 6 were requested. Your browser or device may not support 6-channel input.`);
            }
        }

        // 2. Create Splitter to access individual channels
        if (!audioNodes['Mic_Splitter']) {
            // We ask for 6 channels.
            const splitter = audioCtx.createChannelSplitter(6);
            audioNodes['Mic_Splitter'] = splitter;
        }

        // Connect Source -> Splitter
        // Note: if source has fewer channels than splitter's inputs, it upmixes or maps according to standard rules.
        mediaStreamSource.connect(audioNodes['Mic_Splitter']);

        // NOTIFY ACTIVE CARD
        // If the card was mounted before Mic was ready, or if we just swapped inputs,
        // we need to tell it to reconnect its inputs.
        if (typeof activeComputerCard !== 'undefined' && activeComputerCard && typeof activeComputerCard.onMicChange === 'function') {
            try {
                activeComputerCard.onMicChange();
                console.log('[Audio Input] Notified active card of input change.');
            } catch (e) {
                console.warn('[Audio Input] Failed to notify active card:', e);
            }
        }


        // 3. Connect Mic Ch1/2 to "Stereo_Line_In" Hub (Backwards Compatibility / Default Routing)
        // We need a merger to reconstruct stereo for the default line in, 
        // because Stereo_Line_In expects a stereo signal.
        if (audioNodes['Stereo_Line_In']) {
            if (audioNodes['Mic_Source_Node']) {
                audioNodes['Mic_Source_Node'].disconnect();
            }

            // Re-use or create merger for stereo in
            if (!audioNodes['Mic_Merger_Stereo']) {
                audioNodes['Mic_Merger_Stereo'] = audioCtx.createChannelMerger(2);
                audioNodes['Mic_Merger_Stereo'].connect(audioNodes['Stereo_Line_In']);
            }

            // Connect Splitter 0 -> Merger 0
            audioNodes['Mic_Splitter'].connect(audioNodes['Mic_Merger_Stereo'], 0, 0);
            // Connect Splitter 1 -> Merger 1
            audioNodes['Mic_Splitter'].connect(audioNodes['Mic_Merger_Stereo'], 1, 1);

            // Keep reference to source to disconnect later
            audioNodes['Mic_Source_Node'] = mediaStreamSource;
        }

        // 4. Create Nodes for Channel 3 & 4 (CV Inputs) if they don't exist
        // These will be picked up by CardUSBAudio
        if (!audioNodes['Input_Ch3']) {
            const gain = audioCtx.createGain();
            gain.gain.value = 1.0;
            audioNodes['Input_Ch3'] = gain;
        }
        if (!audioNodes['Input_Ch4']) {
            const gain = audioCtx.createGain();
            gain.gain.value = 1.0;
            audioNodes['Input_Ch4'] = gain;
        }

        // Connect Splitter 2 -> Input_Ch3
        audioNodes['Mic_Splitter'].connect(audioNodes['Input_Ch3'], 2, 0);
        // Connect Splitter 3 -> Input_Ch4
        audioNodes['Mic_Splitter'].connect(audioNodes['Input_Ch4'], 3, 0);


        // 5. Update Routing immediately
        updateTapeRouting();

        document.getElementById('micToggle').classList.add('mic-is-active');
        // Show Settings Button
        document.getElementById('audioSettingsBtn')?.classList.remove('hidden');

        showMessage("Microphone Active (4ch Requested)", "success");
        micEnabled = true;

    } catch (err) {
        console.warn("Audio Input Error:", err);
        showMessage("Microphone Access Denied", "error");
        micEnabled = false;
    }
}

// --- DEVICE ENUMERATION ---
let audioDevices = { inputs: [], outputs: [] };

async function listAudioDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        audioDevices.inputs = devices.filter(d => d.kind === 'audioinput');
        audioDevices.outputs = devices.filter(d => d.kind === 'audiooutput');

        // Refresh UI if it exists
        if (typeof refreshAudioSettingsMenu === 'function') refreshAudioSettingsMenu();

        if (audioDevices.inputs.length > 0 || audioDevices.outputs.length > 0) {
            document.getElementById('audioSettingsBtn')?.classList.remove('hidden');
        }

    } catch (e) {
        console.warn("Could not enumerate devices:", e);
    }
}

async function setAudioOutput(deviceId) {
    if (!audioCtx || typeof audioCtx.setSinkId !== 'function') {
        showMessage("Output selection not supported by browser", "warning");
        return;
    }

    try {
        await audioCtx.setSinkId(deviceId);
        showMessage("Audio Output Changed", "success");
    } catch (e) {
        console.error(e);
        showMessage("Failed to set Output", "error");
    }
}


function initMidi() {
    if (midiAccess) {
        onMIDISuccess(midiAccess);
        return;
    }

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: true })
            .then(onMIDISuccess, onMIDIFailure);
    } else {
        showMessage("WebMIDI is not supported by your browser.", "error");
    }
}

function onMIDISuccess(access) {
    midiAccess = access;
    const midiBtn = document.getElementById('midiToggle');
    const vk = document.getElementById('virtualKeyboard');

    // --- INPUTS ---
    inputCount = 0;
    midiInputs = [];
    const inputs = midiAccess.inputs.values();
    for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
        input.value.onmidimessage = onMIDIMessage;
        midiInputs.push(input.value);
        inputCount++;
    }

    // --- OUTPUTS ---
    midiOutputs = [];
    const outputs = midiAccess.outputs.values();
    for (let output = outputs.next(); output && !output.done; output = outputs.next()) {
        midiOutputs.push(output.value);
    }

    // Refresh UI
    if (typeof refreshMidiSettingsMenu === 'function') refreshMidiSettingsMenu();


    if (inputCount === 0) {
        vk.classList.add('is-visible');
        if (vk.innerHTML === '') initVirtualKeyboard();
        showMessage("No MIDI Device found. Virtual Keyboard Active.", "info");
    } else {
        vk.classList.add('is-visible');
        if (vk.innerHTML === '') initVirtualKeyboard();
        showMessage(`MIDI Connected (${inputCount} devices)`, "success");
    }

    midiAccess.onstatechange = (e) => {
        if (e.port.type === 'input') onMIDISuccess(midiAccess);
        if (e.port.type === 'output') onMIDISuccess(midiAccess);
    };

    midiBtn.classList.add('btn-active'); // Yellow active state
    midiEnabled = true;

    // Show Learn Button
    const learnBtn = document.getElementById('midiLearnBtn');
    if (learnBtn) learnBtn.classList.remove('hidden');
}

function onMIDIFailure(e) {
    const midiBtn = document.getElementById('midiToggle');
    const vk = document.getElementById('virtualKeyboard');

    // Show Virtual Keyboard as fallback
    vk.classList.add('is-visible');
    if (vk.innerHTML === '') initVirtualKeyboard();

    midiBtn.classList.add('btn-active');
    midiBtn.classList.replace('text-gray-400', 'text-white');
    midiEnabled = true;

    // Show Learn Button (allow learning from virtual keyboard)
    const learnBtn = document.getElementById('midiLearnBtn');
    if (learnBtn) learnBtn.classList.remove('hidden');

    showMessage("WebMIDI blocked. Using Virtual Keyboard only.", "warning");
}

// Fallback declaration if globals.js didn't load it
if (typeof midiInChannel === 'undefined') {
    var midiInChannel = 'all';
}

function onMIDIMessage(event) {
    // 1. Filter by Input Device
    if (midiInDeviceId !== 'all') {
        if (event.target && event.target.id !== midiInDeviceId) return;
    }

    // 2. Filter by Input Channel
    const status = event.data[0];
    if (status >= 0x80 && status <= 0xEF) { // Voice Messages
        if (midiInChannel !== 'all') {
            const ch = (status & 0x0F) + 1;
            if (ch !== parseInt(midiInChannel)) return;
        }
    }

    handleMidiMessage(event);
}

function setMidiInChannel(ch) {
    midiInChannel = ch;
    // showMessage(`MIDI Input Ch: ${ch === 'all' ? 'All' : ch}`, "info");
}

function handleMidiMessage(event, isInternal = false) {
    if (!isInternal && !midiEnabled) return;

    // Safety check for critical nodes
    if (!audioNodes['Midi_Pitch']) return;

    // CARD HOOK: Allow active card to snoop MIDI
    if (activeComputerCard && typeof activeComputerCard.onMidiMessage === 'function') {
        activeComputerCard.onMidiMessage(event.data);
    }

    // Use event.data (renamed param from message to event above)
    const [status, data1, data2] = event.data;
    const command = status & 0xF0;
    const channel = status & 0x0F;

    // --- 1. MIDI CLOCK (Realtime) ---
    if (status === 0xF8) { // Timing Clock (24 ppqn)
        midiClockCount++;
        // Divide by 6 for 16th notes (24 / 4 = 6)
        if (midiClockCount % 6 === 0) {
            triggerMidiClockPulse();
        }
        return;
    }
    if (status === 0xFA || status === 0xFB) { // Start / Continue
        midiClockCount = 0;
        midiHeldNotes.clear(); // Reset held notes
        return;
    }
    if (status === 0xFC) { // Stop
        midiClockCount = 0;
        midiHeldNotes.clear(); // Reset held notes
        safeParam(audioNodes['Midi_Gate'].offset, 0.0, audioCtx.currentTime); // Ensure gate off
        return;
    }

    // --- 2. NOTE ON / OFF ---
    // --- 2. NOTE ON / OFF ---
    // --- 2. NOTE ON / OFF ---
    if (command === 144 && data2 > 0) { // Note On
        const note = data1;
        const velocity = data2;
        const cv = (note - 60) / 60.0;

        midiHeldNotes.add(note);

        safeParam(audioNodes['Midi_Pitch'].offset, cv, audioCtx.currentTime);
        safeParam(audioNodes['Midi_Gate'].offset, 1.0, audioCtx.currentTime);

        // Velocity (0-1)
        const velNorm = velocity / 127.0;
        safeParam(audioNodes['Midi_Velocity'].offset, velNorm, audioCtx.currentTime);

        // Virtual Keyboard Feedback
        const key = document.querySelector(`.vk-key-white[data-note="${note}"], .vk-key-black[data-note="${note}"]`);
        if (key) key.classList.add('active');
    }

    else if (command === 128 || (command === 144 && data2 === 0)) { // Note Off
        const note = data1;
        midiHeldNotes.delete(note);

        // Only turn off gate if NO notes are held (Legato)
        if (midiHeldNotes.size === 0) {
            safeParam(audioNodes['Midi_Gate'].offset, 0.0, audioCtx.currentTime);
        }

        // Virtual Keyboard Feedback
        const key = document.querySelector(`.vk-key-white[data-note="${note}"], .vk-key-black[data-note="${note}"]`);
        if (key) key.classList.remove('active');
    }

    // --- 3. CONTROL CHANGE (CC) & LEARN ---
    else if (command === 176) {
        const cc = data1;
        const val = data2;
        console.log(`MIDI CC: Ch${channel} Num${cc} Val${val}. LearnMode: ${midiLearnMode}, Target: ${pendingLearnTarget}`);
        const mapKey = `${channel}_${cc}`;

        // A. Handle LEARN Mode
        if (midiLearnMode && pendingLearnTarget) {
            midiCcMap[mapKey] = pendingLearnTarget;

            showMessage(`Mapped CC ${cc} (Ch ${channel + 1}) to ${pendingLearnTarget}`, "success");

            // Visual feedback cleanup would go here or be handled by UI
            const el = document.getElementById(pendingLearnTarget);
            if (el) el.classList.remove('learn-active');


            pendingLearnTarget = null;
            disableMidiLearnMode(); // Auto-exit learn mode after one mapping? Or keep open? 
            // Let's keep it simple: Auto-exit for now to prevent accidental overwrites
            return;
        }

        // B. Handle MAPPED Controls
        if (midiCcMap[mapKey]) {
            const targetId = midiCcMap[mapKey];
            const normVal = val / 127.0;

            // Check if target is a Custom Module Output Jack (CV control)
            // Jacks usually have IDs like "moduleID_out_Index"
            // We need to find if there's an audio node associated with this jack.
            // The globalJackMap (in initAudio) maps jack IDs to AudioNodes!
            if (globalJackMap && globalJackMap[targetId]) {
                const node = globalJackMap[targetId];
                // If it's a ConstantSource/AudioParam, we can control it.
                // Usually outputs are Gains or ConstantSources. 
                // For our 'midi' module, they are ConstantSources.
                if (node instanceof AudioParam) {
                    safeParam(node, normVal, audioCtx.currentTime);
                } else if (node.offset instanceof AudioParam) {
                    safeParam(node.offset, normVal, audioCtx.currentTime);
                }
            }

            // Dispatch to UI handler (for visual knobs)
            if (typeof updateKnobFromMidi === 'function') {
                updateKnobFromMidi(targetId, normVal);
            }
        }
    }
}

function triggerMidiClockPulse() {
    if (!audioNodes['Midi_Clock']) return;
    // Simple 5ms trigger pulse
    const now = audioCtx.currentTime;
    const p = audioNodes['Midi_Clock'].offset;
    p.cancelScheduledValues(now);
    p.setValueAtTime(1.0, now);
    p.setValueAtTime(0.0, now + 0.005);
}

function enableMidiLearnMode() {
    midiLearnMode = true;
    document.body.classList.add('midi-learn-active'); // For cursor changes

    const btn = document.getElementById('midiLearnBtn');
    if (btn) btn.classList.add('btn-active');

    showMessage("MIDI LEARN: Click a knob/switch to select it.", "info");
}

function disableMidiLearnMode() {
    midiLearnMode = false;
    pendingLearnTarget = null;
    document.body.classList.remove('midi-learn-active');

    // Clear any active highlights
    document.querySelectorAll('.learn-active').forEach(el => el.classList.remove('learn-active'));

    // Update button state if it exists
    const btn = document.getElementById('midiLearnBtn');
    if (btn) btn.classList.remove('btn-active');
}

function toggleMidiLearn() {
    if (midiLearnMode) disableMidiLearnMode();
    else enableMidiLearnMode();
}

function initVirtualKeyboard() {
    const container = document.getElementById('virtualKeyboard');
    if (!container) return;

    container.innerHTML = '';

    const startNote = 48; // C2
    const octaves = 3;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.gap = '2px';
    container.appendChild(wrapper);

    for (let o = 0; o < octaves; o++) {
        const octaveDiv = document.createElement('div');
        octaveDiv.className = 'vk-octave';

        // White Keys
        ['C', 'D', 'E', 'F', 'G', 'A', 'B'].forEach((note, i) => {
            const wk = document.createElement('div');
            wk.className = 'vk-key-white';
            const noteOffset = [0, 2, 4, 5, 7, 9, 11][i];
            const midiNote = startNote + (o * 12) + noteOffset;
            wk.dataset.note = midiNote; // Store MIDI note
            setupKeyEvents(wk, midiNote);
            octaveDiv.appendChild(wk);
        });

        // Black Keys
        const blacks = [
            { cls: 'vk-b-cs', offset: 1 },
            { cls: 'vk-b-ds', offset: 3 },
            { cls: 'vk-b-fs', offset: 6 },
            { cls: 'vk-b-gs', offset: 8 },
            { cls: 'vk-b-as', offset: 10 }
        ];

        blacks.forEach(b => {
            const bk = document.createElement('div');
            bk.className = `vk-key-black ${b.cls}`;
            const midiNote = startNote + (o * 12) + b.offset;
            bk.dataset.note = midiNote; // Store MIDI note
            setupKeyEvents(bk, midiNote);
            octaveDiv.appendChild(bk);
        });

        wrapper.appendChild(octaveDiv);
    }
}


function setupKeyEvents(el, note) {
    const triggerOn = (e) => {
        e.preventDefault();
        // FIX: Pass 'true' to indicate this is an internal UI event
        handleMidiMessage({ data: [144, note, 127] }, true);

        // SEND TO EXTERNAL MIDI OUT
        if (typeof sendMidiNoteOn === 'function') sendMidiNoteOn(note, 127);

        el.classList.add('active');
    };

    const triggerOff = (e) => {
        e.preventDefault();
        // FIX: Pass 'true' here as well
        handleMidiMessage({ data: [128, note, 0] }, true);

        // SEND TO EXTERNAL MIDI OUT
        if (typeof sendMidiNoteOff === 'function') sendMidiNoteOff(note);

        el.classList.remove('active');
    };

    el.addEventListener('mousedown', triggerOn);
    el.addEventListener('mouseup', triggerOff);
    el.addEventListener('mouseleave', triggerOff);

    el.addEventListener('touchstart', triggerOn, { passive: false });
    el.addEventListener('touchend', triggerOff);
}

/* =========================================================================
   MODULE & NODE FACTORIES
   ========================================================================= */

function createLimiter(ctx) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.knee.value = 0.0;
    limiter.ratio.value = 20.0;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.1;
    return limiter;
}

function createComputerIO(ctx) {
    return {
        // --- INPUTS (The 6 Jacks on Left) ---
        inputL: ctx.createGain(),
        inputR: ctx.createGain(),
        cv1In: ctx.createGain(),
        cv2In: ctx.createGain(),
        pulse1In: ctx.createGain(),
        pulse2In: ctx.createGain(),

        // --- OUTPUTS (The 6 Jacks on Right) ---
        outputL: ctx.createGain(),
        outputR: ctx.createGain(),
        cv1Out: ctx.createGain(),
        cv2Out: ctx.createGain(),
        pulse1Out: ctx.createGain(),
        pulse2Out: ctx.createGain()
    };
}

function createVCO(id) { // Added ID param to identify self-patching later
    const node = new AudioWorkletNode(audioCtx, 'vco-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 2, // 0: Square, 1: Sine
        outputChannelCount: [1, 1]
    });

    // Output Buffers (for signal distribution)
    const sqrBuff = audioCtx.createGain(); sqrBuff.gain.value = 1.0;
    const sinBuff = audioCtx.createGain(); sinBuff.gain.value = 1.0;

    // Split Worklet Outputs
    node.connect(sqrBuff, 0);
    node.connect(sinBuff, 1);

    // FM Input Helper
    // The Worklet Input 0 is for "Linear Through-Zero" or direct signal FM.
    // But our system uses Exponential FM mapped to Detune.
    // So we connect the FM Gain to the DETUNE PARAMETER, not the audio input.
    const fmGain = audioCtx.createGain();
    fmGain.connect(node.parameters.get('detune'));

    // Pitch Sum (Coarse + Fine + V/Oct)
    const pitchSum = audioCtx.createGain();
    pitchSum.gain.value = 1.0;
    // Note: V/Oct inputs (like Volt1) are -1..1.
    // 1.0 unit = 5 Octaves = 6000 cents.
    const vOctScaler = audioCtx.createGain();
    vOctScaler.gain.value = 6000;
    pitchSum.connect(vOctScaler);
    vOctScaler.connect(node.parameters.get('detune'));

    // --- FIREFOX FIX ---
    // Some browsers sleep the worklet if it has inputs but they are disconnected.
    // We connect a dummy silent source to Keep-Alive.
    try {
        const dummy = audioCtx.createConstantSource();
        dummy.offset.value = 0;
        dummy.connect(node); // Connect to Input 0
        dummy.start();
    } catch (e) { console.warn("VCO KeepAlive failed", e); }

    return {
        osc: node, // Keeps compatibility with generic update logic
        output: sqrBuff, // Default Square out
        sinOutput: sinBuff, // Sine out
        fmGain,
        pitchSum
    };
}

function createVCF() {
    const node = new AudioWorkletNode(audioCtx, 'humpback-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 2, // 0: LP, 1: Switched (HP/BP/Notch)
        outputChannelCount: [1, 1]
    });

    const input = audioCtx.createGain();
    input.connect(node);

    // Outputs
    const lpOut = audioCtx.createGain();
    const hpBpOut = audioCtx.createGain();

    node.connect(lpOut, 0);   // Fixed LP output
    node.connect(hpBpOut, 1); // Switchable output

    // FM Logic
    const fmGain = audioCtx.createGain();
    fmGain.connect(node.parameters.get('cutoff'));

    return {
        input,
        processor: node,
        filter: lpOut,
        hpBpOut,
        fmGain
    };
}

function createSlopes(isExponential = false) {
    const node = new AudioWorkletNode(audioCtx, 'slopes-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { isExponential: isExponential }
    });

    const inputGain = audioCtx.createGain();
    const cvGain = audioCtx.createGain();
    const merger = audioCtx.createChannelMerger(2);

    inputGain.connect(merger, 0, 0);
    cvGain.connect(merger, 0, 1);
    merger.connect(node);

    // Store the brightness values (0.0 - 1.0)
    node.ledValues = { rise: 0, fall: 0 };

    node.port.onmessage = (e) => {
        if (e.data.rise !== undefined) {
            node.ledValues = {
                rise: e.data.rise,
                fall: e.data.fall
            };
        }
    };

    // KEEP ALIVE: Prevents browser from stopping Worklet when output is not pulled (e.g. CV in attenuated to 0)
    const keepAlive = audioCtx.createGain();
    keepAlive.gain.value = 0.00001; // Tiny non-zero value
    node.connect(keepAlive);
    keepAlive.connect(audioCtx.destination);

    return {
        input: inputGain,
        cvInput: cvGain,
        output: node,
        processor: node
    };
}

function createAmp() {
    // Upgraded: full Mikrophonie+BJT preamp AudioWorklet
    // Mode 0 = Mikrophonie op-amp, Mode 1 = BJT differential pair (Mini Drive)
    const node   = new AudioWorkletNode(audioCtx, 'amp-processor', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1]
    });
    const input  = audioCtx.createGain();
    const output = audioCtx.createGain();
    input.connect(node);
    node.connect(output);
    // Stub properties kept for any code still referencing .drive / .shaper
    const drive  = audioCtx.createGain();
    const shaper = { curve: null };
    return { input, output, workletNode: node, drive, shaper };
}

function createRingMod() {
    // Upgraded: Schottky diode ring multiplier with double-tanh saturation
    const node  = new AudioWorkletNode(audioCtx, 'ringmod-processor', {
        numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1]
    });
    const inputA = audioCtx.createGain();
    const inputB = audioCtx.createGain();
    const output = audioCtx.createGain();
    inputA.connect(node, 0, 0); // Carrier  → worklet input 0
    inputB.connect(node, 0, 1); // Modulator → worklet input 1
    node.connect(output, 0);
    return { inputA, inputB, output };
}

function createStomp() {
    // Upgraded: resistor-network blend, bilinear HPF, stability LPF, 1-sample feedback delay
    // 2 inputs (dry, return) and 2 outputs (send, final) allow pedalboard wiring externally
    const node     = new AudioWorkletNode(audioCtx, 'stomp-processor', {
        numberOfInputs: 2, numberOfOutputs: 2, outputChannelCount: [1, 1]
    });
    const input    = audioCtx.createGain(); // jack-stompIn
    const returnIn = audioCtx.createGain(); // jack-stompReturn
    const sendOut  = audioCtx.createGain(); // jack-stompSend
    const output   = audioCtx.createGain(); // jack-stompOut
    input.connect(node, 0, 0);    // dry signal → worklet input 0
    returnIn.connect(node, 0, 1); // return signal → worklet input 1
    node.connect(sendOut, 0);     // worklet output 0 → send to pedalboard
    node.connect(output, 1);      // worklet output 1 → final output
    // Stub nodes kept for any code that still references these properties
    const dryGain      = audioCtx.createGain();
    const wetGain      = audioCtx.createGain();
    const feedbackGain = audioCtx.createGain();
    return { input, sendOut, returnIn, output, dryGain, wetGain, feedbackGain,
             workletNode: node, internalOutput: output };
}


function createPedalboard(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();

    // --- 1. DISTORTION ---
    const distIn = ctx.createGain(); const distOut = ctx.createGain();
    const shaper = ctx.createWaveShaper(); shaper.curve = createDistortionCurve(0);
    const distFilter = ctx.createBiquadFilter(); distFilter.type = 'lowpass'; distFilter.frequency.value = 5000;
    distIn.connect(shaper); shaper.connect(distFilter); distFilter.connect(distOut);

    // --- 2. PHASER ---
    const phaserIn = ctx.createGain(); const phaserOut = ctx.createGain();
    const phaserDry = ctx.createGain(); const phaserWet = ctx.createGain();
    const ap1 = ctx.createBiquadFilter(); ap1.type = 'allpass'; ap1.frequency.value = 1000;
    const ap2 = ctx.createBiquadFilter(); ap2.type = 'allpass'; ap2.frequency.value = 1000;
    const ap3 = ctx.createBiquadFilter(); ap3.type = 'allpass'; ap3.frequency.value = 1000;
    const phaserLFO = ctx.createOscillator(); phaserLFO.type = 'sine'; phaserLFO.frequency.value = 0.5; phaserLFO.start();
    const phaserDepth = ctx.createGain(); phaserDepth.gain.value = 500;
    phaserIn.connect(phaserDry); phaserDry.connect(phaserOut);
    phaserIn.connect(ap1); ap1.connect(ap2); ap2.connect(ap3); ap3.connect(phaserWet); phaserWet.connect(phaserOut);
    phaserLFO.connect(phaserDepth); phaserDepth.connect(ap1.frequency); phaserDepth.connect(ap2.frequency); phaserDepth.connect(ap3.frequency);

    // --- 3. CHORUS ---
    const chorusIn = ctx.createGain(); const chorusOut = ctx.createGain();
    const chorusSplit = ctx.createGain(); const chorusDelay = ctx.createDelay(); chorusDelay.delayTime.value = 0.03;
    const chorusLFO = ctx.createOscillator(); chorusLFO.type = 'sine'; chorusLFO.frequency.value = 1.5; chorusLFO.start();
    const chorusDepth = ctx.createGain(); chorusDepth.gain.value = 0.002;
    const chorusMix = ctx.createGain();
    chorusIn.connect(chorusSplit); chorusIn.connect(chorusDelay);
    chorusLFO.connect(chorusDepth); chorusDepth.connect(chorusDelay.delayTime);
    chorusSplit.connect(chorusOut); chorusDelay.connect(chorusMix); chorusMix.connect(chorusOut);

    // --- 4. DELAY ---
    const delayIn = ctx.createGain(); const delayOut = ctx.createGain();
    const dDelay = ctx.createDelay(); dDelay.delayTime.value = 0.4;
    const dFeedback = ctx.createGain(); dFeedback.gain.value = 0.4;
    const dFilter = ctx.createBiquadFilter(); dFilter.frequency.value = 2000;
    const dMix = ctx.createGain();
    delayIn.connect(delayOut); delayIn.connect(dDelay);
    dDelay.connect(dFilter); dFilter.connect(dFeedback); dFeedback.connect(dDelay); dFilter.connect(dMix); dMix.connect(delayOut);

    // --- 5. REVERB ---
    const revIn = ctx.createGain(); const revOut = ctx.createGain();
    const revConv = ctx.createConvolver();
    const rate = ctx.sampleRate; const len = rate * 2.0; const buff = ctx.createBuffer(2, len, rate);
    for (let i = 0; i < len; i++) {
        const dec = Math.pow(1 - i / len, 3);
        buff.getChannelData(0)[i] = (Math.random() * 2 - 1) * dec;
        buff.getChannelData(1)[i] = (Math.random() * 2 - 1) * dec;
    }
    revConv.buffer = buff;
    const revMix = ctx.createGain();
    revIn.connect(revOut); revIn.connect(revConv); revConv.connect(revMix); revMix.connect(revOut);

    // Store nodes
    const nodes = {
        dist: { in: distIn, out: distOut, effect: shaper, tone: distFilter },
        phaser: { in: phaserIn, out: phaserOut, wet: phaserWet, lfo: phaserLFO, depth: phaserDepth },
        chorus: { in: chorusIn, out: chorusOut, lfo: chorusLFO, depth: chorusDepth, mix: chorusMix },
        delay: { in: delayIn, out: delayOut, time: dDelay, feed: dFeedback, mix: dMix },
        reverb: { in: revIn, out: revOut, mix: revMix }
    };

    // Note: Connections are handled by connectPedalChain()
    return { input, output, nodes };
}

function createCustomModuleNode(module) {
    const type = module.config.type;
    // Default fallback if no type (legacy custom modules)
    if (!type) return null;

    if (type === 'mult') {
        const node = audioCtx.createGain();
        node.gain.value = 1.0;
        return {
            type: 'mult',
            input: node,
            outputs: [node, node, node] // Shared output node
        };
    }
    else if (type === 'attenuator') {
        const node = audioCtx.createGain();
        return {
            type: 'attenuator',
            input: node,
            output: node,
            gainParam: node.gain
        };
    }
    else if (type === 'vca') {
        const vca = audioCtx.createGain();
        vca.gain.value = 0; // Default to 0, controlled by Knob + CV

        const cvInput = audioCtx.createGain();
        cvInput.connect(vca.gain);

        return {
            type: 'vca',
            input: vca,
            output: vca,
            cvInput: cvInput,
            gainParam: vca.gain, // Direct bias
            cvAmtParam: cvInput.gain
        };
    }
    else if (type === 'midi') {
        // --- INPUTS (CV to MIDI) ---
        // 0: Pitch, 1: Gate, 2: CC A, 3: CC B
        const inPitch = audioCtx.createGain();
        const inGate = audioCtx.createGain();
        const inCCA = audioCtx.createGain();
        const inCCB = audioCtx.createGain();

        // Analysers
        const anPitch = audioCtx.createAnalyser(); anPitch.fftSize = 32;
        const anGate = audioCtx.createAnalyser(); anGate.fftSize = 32;
        const anCCA = audioCtx.createAnalyser(); anCCA.fftSize = 32;
        const anCCB = audioCtx.createAnalyser(); anCCB.fftSize = 32;

        inPitch.connect(anPitch);
        inGate.connect(anGate);
        inCCA.connect(anCCA);
        inCCB.connect(anCCB);

        // --- OUTPUTS (MIDI to CV) ---
        // Access global MIDI nodes if valid
        const outputs = [
            audioNodes['Midi_Pitch'] || null, // Pitch Node (ConstantSource)
            audioNodes['Midi_Gate'] || null,   // Gate Node (ConstantSource)
            audioNodes['Midi_Velocity'] || null, // Velocity
            audioNodes['Midi_Clock'] || null  // Clock
        ];

        return {
            type: 'midi',
            inputs: [inPitch, inGate, inCCA, inCCB],
            outputs: outputs,
            analysers: {
                pitch: anPitch,
                gate: anGate,
                ccA: anCCA,
                ccB: anCCB
            },
            data: {
                pitch: new Float32Array(32),
                gate: new Float32Array(32),
                ccA: new Float32Array(32),
                ccB: new Float32Array(32),
                lastGate: 0,
                lastNote: -1,
                lastCCA: -1,
                lastCCB: -1
            }
        };
    } // Close midi block

    else if (type === 'mixer') {
        const out = audioCtx.createGain();
        const in1 = audioCtx.createGain();
        const in2 = audioCtx.createGain();
        const in3 = audioCtx.createGain();

        in1.connect(out);
        in2.connect(out);
        in3.connect(out);

        return {
            type: 'mixer',
            inputs: [in1, in2, in3],
            input: in1, // Default for generic catch, but we use 'inputs' array
            output: out,
            gains: [in1.gain, in2.gain, in3.gain]
        };
    }
    else if (type === 'noise') {
        const master = audioCtx.createGain();

        // White Noise
        const white = audioCtx.createBufferSource();
        const bSize = audioCtx.sampleRate * 5; // 5 seconds
        const bWhite = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
        const dWhite = bWhite.getChannelData(0);
        for (let i = 0; i < bSize; i++) dWhite[i] = (Math.random() * 2 - 1);
        white.buffer = bWhite;
        white.loop = true;
        white.start();

        // Pink Noise (Approximation)
        const pink = audioCtx.createBufferSource();
        const bPink = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
        const dPink = bPink.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bSize; i++) {
            const whiteVal = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + whiteVal * 0.0555179;
            b1 = 0.99332 * b1 + whiteVal * 0.0750759;
            b2 = 0.96900 * b2 + whiteVal * 0.1538520;
            b3 = 0.86650 * b3 + whiteVal * 0.3104856;
            b4 = 0.55000 * b4 + whiteVal * 0.5329522;
            b5 = -0.7616 * b5 - whiteVal * 0.0168980;
            dPink[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + whiteVal * 0.5362;
            dPink[i] *= 0.11; // Compensation
            b6 = whiteVal * 0.115926;
        }
        pink.buffer = bPink;
        pink.loop = true;
        pink.start();

        const whiteGain = audioCtx.createGain();
        whiteGain.gain.value = 0.1; // Reduce base level significantly
        const pinkGain = audioCtx.createGain();
        pinkGain.gain.value = 0.1;

        white.connect(whiteGain);
        pink.connect(pinkGain);

        whiteGain.connect(master);
        pinkGain.connect(master);

        return {
            type: 'noise',
            output: master,
            whiteNode: white,
            pinkNode: pink,
            masterGain: master.gain,
            gains: [whiteGain, pinkGain] // 0: White, 1: Pink
        };
    }
    else if (type === 'scope') {
        const s1 = audioCtx.createGain(); s1.gain.value = 1.0;
        const s2 = audioCtx.createGain(); s2.gain.value = 1.0;

        // Connect to Global Scope Analysers if they exist
        // (Defined in scope.js/globals.js)
        if (typeof scopeAnalyser1 !== 'undefined' && scopeAnalyser1) s1.connect(scopeAnalyser1);
        if (typeof scopeAnalyser2 !== 'undefined' && scopeAnalyser2) s2.connect(scopeAnalyser2);

        return {
            type: 'scope',
            inputs: [s1, s2],
            outputs: [] // No outputs for scope
        };
    }
    else if (type === 'sequencer') {
        const node = new AudioWorkletNode(audioCtx, 'sequencer-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 3,
            outputChannelCount: [1, 1, 1], // Mono CV, Mono Gate, Mono Quantized
            parameterData: {
                step0: 0, step1: 0, step2: 0, step3: 0,
                step4: 0, step5: 0, step6: 0, step7: 0
            }
        });

        // Proxy Gains for distinct access
        const cvGain = audioCtx.createGain();
        const gateGain = audioCtx.createGain();
        const quantGain = audioCtx.createGain();

        // Worklet Output 0 -> CV
        node.connect(cvGain, 0);

        // Worklet Output 1 -> Gate
        node.connect(gateGain, 1);

        // Worklet Output 2 -> Quantized
        node.connect(quantGain, 2);

        return {
            type: 'sequencer',
            input: node, // Clock In
            outputs: [cvGain, gateGain, quantGain],
            processor: node // Explicit ref for parameter access
        };
    }

    return null;
}

const wasmComputerWorkletCode = `
if (typeof globalThis.performance === 'undefined') {
    globalThis.performance = {
        now: () => Date.now()
    };
}

class WasmComputerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.wasmInstance = null;
        this.wasmExports = null;
        
        this.activeCardIndex = -1;
        this.knobMain = 0.0;
        this.knobX = 0.0;
        this.knobY = 0.0;
        this.switchZ = 0;

        // Jack connection state [audioL, audioR, cv1, cv2, pulse1, pulse2]
        // Matches ComputerCard.h g_input_connected[6] ordering.
        // Without setting these, AudioIn/CVIn/PulseIn all return 0!
        this.inputConnected = [false, false, false, false, false, false];
        
        this.ledValues = new Float32Array(6);
        this.ledTickCounter = 0;

        // Static WASM Heap buffer pointers
        this.midiReadBufferPtr = 0;
        this.serialReadBufferPtr = 0;
        this.serialWriteBufferPtr = 0;

        this.pendingFlashWrites = [];

        // Pointers for block-level processing (float indices)
        this.inLPtr = 0;
        this.inRPtr = 0;
        this.cv1InPtr = 0;
        this.cv2InPtr = 0;
        this.pulse1InPtr = 0;
        this.pulse2InPtr = 0;

        this.outLPtr = 0;
        this.outRPtr = 0;
        this.cv1OutPtr = 0;
        this.cv2OutPtr = 0;
        this.pulse1OutPtr = 0;
        this.pulse2OutPtr = 0;

        this.port.onmessage = (e) => {
            const data = e.data;
            if (data.type === 'init') {
                const moduleConfig = {
                    wasmBinary: data.wasmBinary,
                    print: (text) => console.log("[Wasm AudioWorklet stdout] " + text),
                    printErr: (text) => console.error("[Wasm AudioWorklet stderr] " + text),
                    locateFile: (path) => path
                };
                if (typeof Module !== 'undefined') {
                    Module(moduleConfig).then((instance) => {
                        this.wasmInstance = instance;
                        this.wasmExports = instance;
                        console.log("[WasmComputerProcessor] WASM Module initialized successfully!");
                        
                        // Allocate persistent heap buffers for MIDI & Serial
                        this.midiReadBufferPtr = this.wasmExports._malloc(256);
                        this.serialReadBufferPtr = this.wasmExports._malloc(1024);
                        this.serialWriteBufferPtr = this.wasmExports._malloc(1024);

                        // Fetch pointers for block buffers
                        this.inLPtr = this.wasmExports._get_in_L_ptr() >> 2;
                        this.inRPtr = this.wasmExports._get_in_R_ptr() >> 2;
                        this.cv1InPtr = this.wasmExports._get_cv_in1_ptr() >> 2;
                        this.cv2InPtr = this.wasmExports._get_cv_in2_ptr() >> 2;
                        this.pulse1InPtr = this.wasmExports._get_pulse_in1_ptr() >> 2;
                        this.pulse2InPtr = this.wasmExports._get_pulse_in2_ptr() >> 2;

                        this.outLPtr = this.wasmExports._get_out_L_ptr() >> 2;
                        this.outRPtr = this.wasmExports._get_out_R_ptr() >> 2;
                        this.cv1OutPtr = this.wasmExports._get_cv_out1_ptr() >> 2;
                        this.cv2OutPtr = this.wasmExports._get_cv_out2_ptr() >> 2;
                        this.pulse1OutPtr = this.wasmExports._get_pulse_out1_ptr() >> 2;
                        this.pulse2OutPtr = this.wasmExports._get_pulse_out2_ptr() >> 2;

                        this.applyPendingFlashWrites();
                        if (this.wasmExports._set_host_sample_rate) {
                            this.wasmExports._set_host_sample_rate(sampleRate);
                        }
                        if (this.activeCardIndex !== -1) {
                            console.log("[WasmComputerProcessor] Late-initializing card index:", this.activeCardIndex);
                            this.wasmExports._init_card(this.activeCardIndex);
                            if (this.wasmExports._set_input_connected) {
                                this.wasmExports._set_input_connected(
                                    this.inputConnected[0], this.inputConnected[1],
                                    this.inputConnected[2], this.inputConnected[3],
                                    this.inputConnected[4], this.inputConnected[5]
                                );
                            }
                        }
                        this.port.postMessage({ type: 'ready' });
                    }).catch((err) => {
                        console.error("[WasmComputerProcessor] WASM Init Error:", err);
                    });
                } else {
                    console.error("[WasmComputerProcessor] Modularized 'Module' glue code function is not defined!");
                }
            } else if (data.type === 'load_card') {
                this.activeCardIndex = data.cardIndex;
                if (this.wasmExports) {
                    console.log("[WasmComputerProcessor] Loading C++ card index:", this.activeCardIndex);
                    
                    // Clear and restore flash if functions exist
                    if (this.wasmExports._get_flash_ptr && this.wasmExports._get_flash_size) {
                        const flashPtr = this.wasmExports._get_flash_ptr();
                        const flashSize = this.wasmExports._get_flash_size();
                        if (flashPtr && flashSize > 0) {
                            // Fill flash with 0xFF (erased state)
                            this.wasmExports.HEAPU8.fill(0xFF, flashPtr, flashPtr + flashSize);
                            
                            // If we have saved flash sectors, restore them
                            if (data.flashSectors) {
                                const heap = this.wasmExports.HEAPU8;
                                for (const [sStr, bytes] of Object.entries(data.flashSectors)) {
                                    const s = parseInt(sStr);
                                    const sectorStart = flashPtr + (s * 4096);
                                    if (sectorStart + bytes.length <= flashPtr + flashSize) {
                                        for (let i = 0; i < bytes.length; i++) {
                                            heap[sectorStart + i] = bytes[i];
                                        }
                                    }
                                }
                                console.log("[WasmComputerProcessor] Restored saved flash sectors");
                            }
                        }
                    }

                    this.wasmExports._init_card(this.activeCardIndex);
                    if (this.wasmExports._set_input_connected) {
                        this.wasmExports._set_input_connected(
                            this.inputConnected[0], this.inputConnected[1],
                            this.inputConnected[2], this.inputConnected[3],
                            this.inputConnected[4], this.inputConnected[5]
                        );
                    }
                }
            } else if (data.type === 'unload_card') {
                this.activeCardIndex = -1;
                if (this.wasmExports) {
                    this.wasmExports._init_card(-1);
                }
            } else if (data.type === 'controls') {
                this.knobMain = data.knobMain;
                this.knobX = data.knobX;
                this.knobY = data.knobY;
                this.switchZ = data.switchZ;
            } else if (data.type === 'connected') {
                // [audioL, audioR, cv1, cv2, pulse1, pulse2]
                this.inputConnected = data.connected;
                if (this.wasmExports && this.wasmExports._set_input_connected) {
                    this.wasmExports._set_input_connected(
                        data.connected[0], data.connected[1],
                        data.connected[2], data.connected[3],
                        data.connected[4], data.connected[5]
                    );
                }
            } else if (data.type === 'write_flash_bytes') {
                this.pendingFlashWrites.push({ offset: data.offset, bytes: data.bytes });
                this.applyPendingFlashWrites();
                if (this.wasmExports && this.activeCardIndex !== -1) {
                    this.wasmExports._init_card(this.activeCardIndex);
                }
            } else if (data.type === 'midi_to_card') {
                if (this.wasmExports && this.wasmExports._send_midi_to_card) {
                    const bytes = data.data;
                    const sendPacketFn = (b0, b1, b2, b3) => {
                        this.wasmExports._send_midi_to_card(b0, b1, b2, b3);
                    };
                    if (bytes[0] === 0xF0) {
                        // SysEx
                        let idx = 0;
                        while (idx < bytes.length) {
                            let rem = bytes.length - idx;
                            let packet = [0, 0, 0, 0];
                            if (rem >= 3) {
                                if (bytes[idx + 2] === 0xF7) {
                                    packet[0] = 0x07; // SysEx ends with 3 bytes
                                    packet[1] = bytes[idx];
                                    packet[2] = bytes[idx + 1];
                                    packet[3] = bytes[idx + 2];
                                    idx += 3;
                                } else {
                                    packet[0] = 0x04; // SysEx starts or continues with 3 bytes
                                    packet[1] = bytes[idx];
                                    packet[2] = bytes[idx + 1];
                                    packet[3] = bytes[idx + 2];
                                    idx += 3;
                                }
                            } else if (rem === 2) {
                                packet[0] = 0x06; // SysEx ends with 2 bytes
                                packet[1] = bytes[idx];
                                packet[2] = bytes[idx + 1];
                                idx += 2;
                            } else if (rem === 1) {
                                packet[0] = 0x05; // SysEx ends with 1 byte
                                packet[1] = bytes[idx];
                                idx += 1;
                            }
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        }
                    } else {
                        // Non-SysEx
                        let status = bytes[0];
                        let type = status & 0xF0;
                        let packet = [0, 0, 0, 0];
                        if (status >= 0xF8) {
                            packet[0] = 0x0F;
                            packet[1] = status;
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        } else if (type === 0x80 || type === 0x90 || type === 0xA0 || type === 0xB0 || type === 0xE0) {
                            packet[0] = type >> 4;
                            packet[1] = status;
                            packet[2] = bytes[1] ?? 0;
                            packet[3] = bytes[2] ?? 0;
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        } else if (type === 0xC0 || type === 0xD0) {
                            packet[0] = type >> 4;
                            packet[1] = status;
                            packet[2] = bytes[1] ?? 0;
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        } else if (status === 0xF2) {
                            packet[0] = 0x03;
                            packet[1] = status;
                            packet[2] = bytes[1] ?? 0;
                            packet[3] = bytes[2] ?? 0;
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        } else if (status === 0xF1 || status === 0xF3) {
                            packet[0] = 0x02;
                            packet[1] = status;
                            packet[2] = bytes[1] ?? 0;
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        } else if (status === 0xF6) {
                            packet[0] = 0x05;
                            packet[1] = status;
                            sendPacketFn(packet[0], packet[1], packet[2], packet[3]);
                        }
                    }
                }
            } else if (data.type === 'serial_to_card') {
                if (this.wasmExports && this.wasmExports._send_serial_to_card && this.serialWriteBufferPtr) {
                    const bytes = data.data;
                    const len = Math.min(bytes.length, 1024);
                    const heap = new Uint8Array(this.wasmExports.HEAPU8.buffer, this.serialWriteBufferPtr, len);
                    for (let i = 0; i < len; i++) {
                        heap[i] = bytes[i];
                    }
                    this.wasmExports._send_serial_to_card(this.serialWriteBufferPtr, len);
                }
            }
        };
    }

    applyPendingFlashWrites() {
        if (this.wasmExports && this.pendingFlashWrites.length > 0) {
            const flashPtr = this.wasmExports._get_flash_ptr();
            const heap = this.wasmExports.HEAPU8;
            for (const write of this.pendingFlashWrites) {
                for (let i = 0; i < write.bytes.length; i++) {
                    heap[flashPtr + write.offset + i] = write.bytes[i];
                }
            }
            this.pendingFlashWrites = [];
        }
    }

    process(inputs, outputs, parameters) {
        if (!this.wasmExports || this.activeCardIndex === -1) {
            for (let i = 0; i < 6; i++) {
                const output = outputs[i];
                if (output && output[0]) {
                    output[0].fill(0);
                }
            }
            return true;
        }

        const length = 128;
        const heap = this.wasmExports.HEAPF32;

        // 1. Copy inputs into WASM block buffers
        if (inputs[0] && inputs[0][0]) {
            heap.set(inputs[0][0], this.inLPtr);
        } else {
            heap.fill(0, this.inLPtr, this.inLPtr + length);
        }

        if (inputs[1] && inputs[1][0]) {
            heap.set(inputs[1][0], this.inRPtr);
        } else {
            heap.fill(0, this.inRPtr, this.inRPtr + length);
        }

        if (inputs[2] && inputs[2][0]) {
            heap.set(inputs[2][0], this.cv1InPtr);
        } else {
            heap.fill(0, this.cv1InPtr, this.cv1InPtr + length);
        }

        if (inputs[3] && inputs[3][0]) {
            heap.set(inputs[3][0], this.cv2InPtr);
        } else {
            heap.fill(0, this.cv2InPtr, this.cv2InPtr + length);
        }

        if (inputs[4] && inputs[4][0]) {
            heap.set(inputs[4][0], this.pulse1InPtr);
        } else {
            heap.fill(0, this.pulse1InPtr, this.pulse1InPtr + length);
        }

        if (inputs[5] && inputs[5][0]) {
            heap.set(inputs[5][0], this.pulse2InPtr);
        } else {
            heap.fill(0, this.pulse2InPtr, this.pulse2InPtr + length);
        }

        // 2. Call WASM block processing function
        this.wasmExports._process_block(
            length,
            this.knobMain,
            this.knobX,
            this.knobY,
            this.switchZ
        );

        // 3. Copy outputs from WASM block buffers back to JS
        if (outputs[0] && outputs[0][0]) {
            outputs[0][0].set(heap.subarray(this.outLPtr, this.outLPtr + length));
        }
        if (outputs[1] && outputs[1][0]) {
            outputs[1][0].set(heap.subarray(this.outRPtr, this.outRPtr + length));
        }
        if (outputs[2] && outputs[2][0]) {
            outputs[2][0].set(heap.subarray(this.cv1OutPtr, this.cv1OutPtr + length));
        }
        if (outputs[3] && outputs[3][0]) {
            outputs[3][0].set(heap.subarray(this.cv2OutPtr, this.cv2OutPtr + length));
        }
        if (outputs[4] && outputs[4][0]) {
            outputs[4][0].set(heap.subarray(this.pulse1OutPtr, this.pulse1OutPtr + length));
        }
        if (outputs[5] && outputs[5][0]) {
            outputs[5][0].set(heap.subarray(this.pulse2OutPtr, this.pulse2OutPtr + length));
        }

        // 4. Update LEDs and MIDI/Serial
        let changed = false;
        for (let j = 0; j < 6; j++) {
            const rawVal = this.wasmExports ? this.wasmExports._get_led_brightness(j) : 0.0;
            let smoothVal = this.ledValues[j];
            if (rawVal > smoothVal) {
                smoothVal = rawVal;
            } else {
                smoothVal = smoothVal * 0.85 + rawVal * 0.15;
            }
            if (Math.abs(this.ledValues[j] - smoothVal) > 0.002) {
                this.ledValues[j] = smoothVal;
                changed = true;
            }
        }
        if (changed) {
            this.port.postMessage({
                type: 'leds',
                leds: Array.from(this.ledValues)
            });
        }

        // Read MIDI from card
        if (this.wasmExports._read_midi_from_card && this.midiReadBufferPtr) {
            const count = this.wasmExports._read_midi_from_card(this.midiReadBufferPtr, 256);
            if (count > 0) {
                const bytes = new Uint8Array(this.wasmExports.HEAPU8.buffer, this.midiReadBufferPtr, count);
                this.port.postMessage({
                    type: 'midi_from_card',
                    data: Array.from(bytes)
                });
            }
        }

        // Read Serial from card
        if (this.wasmExports._read_serial_from_card && this.serialReadBufferPtr) {
            const count = this.wasmExports._read_serial_from_card(this.serialReadBufferPtr, 1024);
            if (count > 0) {
                const bytes = new Uint8Array(this.wasmExports.HEAPU8.buffer, this.serialReadBufferPtr, count);
                this.port.postMessage({
                    type: 'serial_from_card',
                    data: Array.from(bytes)
                });
            }
        }

        // Read and persist emulated flash if dirty
        if (this.wasmExports._is_flash_dirty && this.wasmExports._is_flash_dirty() && this.wasmExports._clear_flash_dirty) {
            this.wasmExports._clear_flash_dirty();
            const flashPtr = this.wasmExports._get_flash_ptr ? this.wasmExports._get_flash_ptr() : 0;
            const flashSize = this.wasmExports._get_flash_size ? this.wasmExports._get_flash_size() : 0;
            if (flashPtr && flashSize) {
                const heap = this.wasmExports.HEAPU8;
                const activeSectors = {};
                const numSectors = flashSize / 4096;
                for (let s = 0; s < numSectors; s++) {
                    const sectorStart = flashPtr + (s * 4096);
                    let isSectorDirty = false;
                    for (let i = 0; i < 4096; i++) {
                        if (heap[sectorStart + i] !== 0xFF) {
                            isSectorDirty = true;
                            break;
                        }
                    }
                    if (isSectorDirty) {
                        const sectorBytes = new Uint8Array(heap.buffer, sectorStart, 4096);
                        activeSectors[s] = Array.from(sectorBytes);
                    }
                }
                this.port.postMessage({
                    type: "flash_persisted",
                    cardId: this.activeCardIndex,
                    sectors: activeSectors
                });
            }
        }

        return true;
    }
}
registerProcessor('wasm-computer-processor', WasmComputerProcessor);
`;



/* =========================================================================
   AUDIO GRAPH BUILDING & ROUTING
   ========================================================================= */

function buildAudioGraph() {
    if (!audioCtx) return;
    if (isBuildingAudioGraph) return;
    isBuildingAudioGraph = true;

    // Load Worklet Logic
    if (!audioNodes['workletLoaded']) {
        // 1. Slopes Worklet
        const blobSlopes = new Blob([slopesWorkletCode], { type: 'application/javascript' });
        const urlSlopes = URL.createObjectURL(blobSlopes);

        // 2. Recorder Worklet
        const blobRec = new Blob([recorderWorkletCode], { type: 'application/javascript' });
        const urlRec = URL.createObjectURL(blobRec);

        // 3. Twists Worklet Blob/URL definition
        const blobTwists = new Blob([TWISTS_WORKLET_CODE], { type: 'application/javascript' });
        const urlTwists = URL.createObjectURL(blobTwists);

        // 4. VCO Worklet (NEW)
        const blobVco = new Blob([vcoWorkletCode], { type: 'application/javascript' });
        const urlVco = URL.createObjectURL(blobVco);

        // 5. Humpback Filter Worklet
        const blobHump = new Blob([humpbackWorkletCode], { type: 'application/javascript' });
        const urlHump = URL.createObjectURL(blobHump);

        // 6. Step Sequencer
        const blobSeq = new Blob([sequencerWorkletCode], { type: 'application/javascript' });
        const urlSeq = URL.createObjectURL(blobSeq);

        // 7. Benjolin
        const blobBenj = new Blob([benjolinWorkletCode], { type: 'application/javascript' });
        const urlBenj = URL.createObjectURL(blobBenj);

        // 8. Toolbox (NEW)
        const blobTool = new Blob([toolboxWorkletCode], { type: 'application/javascript' });
        const urlTool = URL.createObjectURL(blobTool);

        // 9. Sheep (NEW)
        const blobSheep = new Blob([sheepWorkletCode], { type: 'application/javascript' });
        const urlSheep = URL.createObjectURL(blobSheep);

        // 10. CV Mod (NEW)
        const blobCVMod = new Blob([cvmodWorkletCode], { type: 'application/javascript' });
        const urlCVMod = URL.createObjectURL(blobCVMod);

        // 11. Amp (Mikrophonie + BJT Preamp)
        const blobAmp = new Blob([ampWorkletCode], { type: 'application/javascript' });
        const urlAmp = URL.createObjectURL(blobAmp);

        // 12. Ring Modulator (Schottky Model)
        const blobRingMod = new Blob([ringModWorkletCode], { type: 'application/javascript' });
        const urlRingMod = URL.createObjectURL(blobRingMod);

        // 13. Stomp (Analog Send/Return)
        const blobStomp = new Blob([stompWorkletCode], { type: 'application/javascript' });
        const urlStomp = URL.createObjectURL(blobStomp);

        // Fetch JS glue for WASM computer processor
        fetch('js/cards/wasm/patchnotes_cards.js?v=' + Date.now())
            .then(res => res.text())
            .then(glueText => {
                const polyfill = `
// Polyfill to trick Emscripten's environment detection inside AudioWorkletGlobalScope
globalThis.self = globalThis;
globalThis.WorkerGlobalScope = true;
globalThis.location = { href: 'http://localhost/' };
`;
                const fullWasmWorkletCode = polyfill + "\n" + glueText + "\n" + wasmComputerWorkletCode;
                const blobWasm = new Blob([fullWasmWorkletCode], { type: 'application/javascript' });
                const urlWasm = URL.createObjectURL(blobWasm);

                Promise.all([
                    audioCtx.audioWorklet.addModule(urlSlopes),
                    audioCtx.audioWorklet.addModule(urlRec),
                    audioCtx.audioWorklet.addModule(urlTwists),
                    audioCtx.audioWorklet.addModule(urlVco),
                    audioCtx.audioWorklet.addModule(urlHump),
                    audioCtx.audioWorklet.addModule(urlSeq),
                    audioCtx.audioWorklet.addModule(urlBenj),
                    audioCtx.audioWorklet.addModule(urlTool),
                    audioCtx.audioWorklet.addModule(urlSheep),
                    audioCtx.audioWorklet.addModule(urlCVMod),
                    audioCtx.audioWorklet.addModule(urlAmp),
                    audioCtx.audioWorklet.addModule(urlRingMod),
                    audioCtx.audioWorklet.addModule(urlStomp),
                    audioCtx.audioWorklet.addModule(urlWasm)
                ]).then(() => {
                    audioNodes['workletLoaded'] = true;
                    finishBuild();
                    initPiezoContactMic();
                }).catch(err => {
                    console.error("Worklet Load Failed", err);
                });
            }).catch(err => {
                console.error("WASM Glue Fetch Failed, falling back to non-WASM worklets", err);
                Promise.all([
                    audioCtx.audioWorklet.addModule(urlSlopes),
                    audioCtx.audioWorklet.addModule(urlRec),
                    audioCtx.audioWorklet.addModule(urlTwists),
                    audioCtx.audioWorklet.addModule(urlVco),
                    audioCtx.audioWorklet.addModule(urlHump),
                    audioCtx.audioWorklet.addModule(urlSeq),
                    audioCtx.audioWorklet.addModule(urlBenj),
                    audioCtx.audioWorklet.addModule(urlTool),
                    audioCtx.audioWorklet.addModule(urlSheep),
                    audioCtx.audioWorklet.addModule(urlCVMod),
                    audioCtx.audioWorklet.addModule(urlAmp),
                    audioCtx.audioWorklet.addModule(urlRingMod),
                    audioCtx.audioWorklet.addModule(urlStomp)
                ]).then(() => {
                    audioNodes['workletLoaded'] = true;
                    finishBuild();
                    initPiezoContactMic();
                }).catch(err => {
                    console.error("Worklet Load Failed", err);
                });
            });

        return;
    } else {
        finishBuild();
    }
}

function finishBuild() {
    // 1. INITIALIZATION
    if (!audioNodes['Computer_IO']) {

        // --- GENERATE CUSTOM WAVES ---
        if (!slopesWaves.log) {
            slopesWaves.log = createWaveFromFunction(audioCtx, (t) => Math.pow(t, 4));
            slopesWaves.exp = createWaveFromFunction(audioCtx, (t) => Math.pow(1 - t, 4));
            slopesWaves.bentTri = createWaveFromFunction(audioCtx, (t) => {
                if (t < 0.5) return Math.pow(t * 2, 2);
                else return Math.pow((1 - t) * 2, 2);
            });
        }

        const compIO = createComputerIO(audioCtx);
        audioNodes['Computer_IO'] = compIO;
        audioNodes['Comp_L_Out'] = compIO.outputL;
        audioNodes['Comp_R_Out'] = compIO.outputR;
        audioNodes['Comp_CV1_Out'] = compIO.cv1Out;
        audioNodes['Comp_CV2_Out'] = compIO.cv2Out;
        audioNodes['Comp_P1_Out'] = compIO.pulse1Out;

        // --- WASM COMPUTER WORKLET NODE ---
        let hasWasmWorklet = false;
        if (audioNodes['WasmComputerKeepAlive']) {
            try {
                audioNodes['WasmComputerKeepAlive'].disconnect();
            } catch (e) {
                console.warn("WASM Computer KeepAlive disconnect failed:", e);
            }
            delete audioNodes['WasmComputerKeepAlive'];
        }
        if (audioNodes['WasmComputerNode']) {
            hasWasmWorklet = true;
            try {
                audioNodes['WasmComputerNode'].disconnect();
            } catch (e) {
                console.warn("WASM Computer Node disconnect failed:", e);
            }
        } else {
            try {
                const wasmComputerNode = new AudioWorkletNode(audioCtx, 'wasm-computer-processor', {
                    numberOfInputs: 6,
                    numberOfOutputs: 6,
                    outputChannelCount: [1, 1, 1, 1, 1, 1]
                });
                audioNodes['WasmComputerNode'] = wasmComputerNode;
                hasWasmWorklet = true;

                // Fetch compiled WASM binary and send to worklet node
                fetch('js/cards/wasm/patchnotes_cards.wasm?v=' + Date.now())
                    .then(res => res.arrayBuffer())
                    .then(wasmBinary => {
                        audioNodes['WasmComputerNode'].port.postMessage({
                            type: 'init',
                            wasmBinary: wasmBinary
                        });
                    }).catch(err => {
                        console.error("WASM Binary Fetch Failed", err);
                    });
            } catch (e) {
                console.warn("WASM Computer Processor worklet not available", e);
            }
        }

        if (hasWasmWorklet) {
            // Keep-alive connection to prevent Web Audio from sleeping the worklet
            try {
                const keepAlive = audioCtx.createGain();
                keepAlive.gain.value = 0.0;
                audioNodes['WasmComputerNode'].connect(keepAlive);
                keepAlive.connect(audioCtx.destination);
                audioNodes['WasmComputerKeepAlive'] = keepAlive;
            } catch (e) {
                console.warn("WASM KeepAlive connection failed:", e);
            }
        }

        if (hasWasmWorklet) {
            // Direct connections without Merger or Splitter
            compIO.inputL.connect(audioNodes['WasmComputerNode'], 0, 0);
            compIO.inputR.connect(audioNodes['WasmComputerNode'], 0, 1);
            compIO.cv1In.connect(audioNodes['WasmComputerNode'], 0, 2);
            compIO.cv2In.connect(audioNodes['WasmComputerNode'], 0, 3);
            compIO.pulse1In.connect(audioNodes['WasmComputerNode'], 0, 4);
            compIO.pulse2In.connect(audioNodes['WasmComputerNode'], 0, 5);

            // Worklet Node outputs directly to IO Outputs
            audioNodes['WasmComputerNode'].connect(compIO.outputL, 0, 0);
            audioNodes['WasmComputerNode'].connect(compIO.outputR, 1, 0);
            audioNodes['WasmComputerNode'].connect(compIO.cv1Out, 2, 0);
            audioNodes['WasmComputerNode'].connect(compIO.cv2Out, 3, 0);
            audioNodes['WasmComputerNode'].connect(compIO.pulse1Out, 4, 0);
            audioNodes['WasmComputerNode'].connect(compIO.pulse2Out, 5, 0);
        }

        if (!audioNodes['Midi_Pitch']) {
            audioNodes['Midi_Pitch'] = audioCtx.createConstantSource();
            audioNodes['Midi_Pitch'].offset.value = 0.0; // <--- Set Default to C3 (0V)
            audioNodes['Midi_Pitch'].start();

            audioNodes['Midi_Gate'] = audioCtx.createConstantSource();
            audioNodes['Midi_Gate'].offset.value = 0.0; // <--- Set Default to Gate Off
            audioNodes['Midi_Gate'].start();

            audioNodes['Midi_Velocity'] = audioCtx.createConstantSource();
            audioNodes['Midi_Velocity'].offset.value = 0.0;
            audioNodes['Midi_Velocity'].start();

            // Clock Trigger (Short pulses)
            audioNodes['Midi_Clock'] = audioCtx.createConstantSource();
            audioNodes['Midi_Clock'].offset.value = 0.0;
            audioNodes['Midi_Clock'].start();
        }
        if (!audioNodes['Global_Noise']) {
            const bSize = audioCtx.sampleRate * 2;
            const b = audioCtx.createBuffer(1, bSize, audioCtx.sampleRate);
            const d = b.getChannelData(0);
            for (let i = 0; i < bSize; i++) d[i] = Math.random() * 2 - 1;
            const gn = audioCtx.createBufferSource(); gn.buffer = b; gn.loop = true; gn.start();
            audioNodes['Global_Noise'] = gn;
        }

        let targetCardId = 'turing_machine';
        const labelEl = document.getElementById('activeCardLabel');
        if (labelEl && labelEl.textContent) {
            const def = AVAILABLE_CARDS.find(c => c.name === labelEl.textContent);
            if (def) targetCardId = def.id;
        }

        // Preserve State during Audio Context transition
        let preservedState = null;
        if (activeComputerCard && typeof activeComputerCard.getState === 'function') {
            preservedState = activeComputerCard.getState();
        }

        activeComputerCard = null;
        swapComputerCard(targetCardId);

        // Restore State
        if (activeComputerCard && preservedState && typeof activeComputerCard.setState === 'function') {
            activeComputerCard.setState(preservedState);
        }

        // --- Standard Synth Modules ---
        audioNodes['VCO1'] = createVCO('VCO1');
        audioNodes['VCO1_Sin'] = { output: audioNodes['VCO1'].sinOutput, fmGain: audioNodes['VCO1'].fmGain, pitchSum: audioNodes['VCO1'].pitchSum };
        audioNodes['VCO2'] = createVCO('VCO2');
        audioNodes['VCO2_Sin'] = { output: audioNodes['VCO2'].sinOutput, fmGain: audioNodes['VCO2'].fmGain, pitchSum: audioNodes['VCO2'].pitchSum };

        audioNodes['VCF1'] = createVCF(); audioNodes['VCF2'] = createVCF();
        audioNodes['Slopes1'] = createSlopes(false); audioNodes['Slopes2'] = createSlopes(true);
        audioNodes['RingMod'] = createRingMod(); audioNodes['Stomp'] = createStomp();
        audioNodes['Pedalboard'] = createPedalboard(audioCtx);
        audioNodes['Amp'] = createAmp();

        // --- Chassis & Mixer ---
        audioNodes['Chassis_Filter'] = audioCtx.createBiquadFilter();
        audioNodes['Chassis_Filter'].type = 'lowpass'; audioNodes['Chassis_Filter'].frequency.value = 200; audioNodes['Chassis_Filter'].Q.value = 2;
        audioNodes['Chassis_Gain'] = audioCtx.createGain(); audioNodes['Chassis_Gain'].gain.value = 0;

        audioNodes['Scratch_Filter'] = audioCtx.createBiquadFilter();
        audioNodes['Scratch_Filter'].type = 'bandpass'; audioNodes['Scratch_Filter'].frequency.value = 5000; audioNodes['Scratch_Filter'].Q.value = 0.0;
        audioNodes['Scratch_Gain'] = audioCtx.createGain(); audioNodes['Scratch_Gain'].gain.value = 0;

        const gNoise = audioNodes['Global_Noise'];
        if (gNoise) {
            if (audioNodes['Chassis_Filter']) gNoise.connect(audioNodes['Chassis_Filter']);
            if (audioNodes['Scratch_Filter']) gNoise.connect(audioNodes['Scratch_Filter']);
        }
        audioNodes['Chassis_Filter'].connect(audioNodes['Chassis_Gain']);

        audioNodes['Scratch_Filter'].connect(audioNodes['Scratch_Gain']);




        // --- Mixer Output ---
        audioNodes['Mixer_Ch1'] = audioCtx.createGain(); audioNodes['Mixer_Ch2'] = audioCtx.createGain();
        audioNodes['Mixer_Ch3'] = audioCtx.createGain(); audioNodes['Mixer_Ch4'] = audioCtx.createGain();
        audioNodes['Mixer_Pan1'] = audioCtx.createStereoPanner(); audioNodes['Mixer_Pan2'] = audioCtx.createStereoPanner();
        audioNodes['Mixer_Sum'] = audioCtx.createGain();
        audioNodes['Master_Vol'] = audioCtx.createGain();
        audioNodes['Limiter'] = createLimiter(audioCtx);

        // Connections
        audioNodes['Mixer_Ch1'].connect(audioNodes['Mixer_Pan1']); audioNodes['Mixer_Ch2'].connect(audioNodes['Mixer_Pan2']);
        audioNodes['Mixer_Pan1'].connect(audioNodes['Mixer_Sum']); audioNodes['Mixer_Pan2'].connect(audioNodes['Mixer_Sum']);
        audioNodes['Mixer_Ch3'].connect(audioNodes['Mixer_Sum']); audioNodes['Mixer_Ch4'].connect(audioNodes['Mixer_Sum']);
        audioNodes['Mixer_Sum'].connect(audioNodes['Master_Vol']);
        audioNodes['Master_Vol'].connect(audioNodes['Limiter']);
        audioNodes['Limiter'].connect(audioCtx.destination); // To Speakers

        // Mixer Patchable Outputs (Split L/R)
        audioNodes['Main_Splitter'] = audioCtx.createChannelSplitter(2);
        audioNodes['Mix_Out_L'] = audioCtx.createGain();
        audioNodes['Mix_Out_R'] = audioCtx.createGain();

        audioNodes['Limiter'].connect(audioNodes['Main_Splitter']);
        audioNodes['Main_Splitter'].connect(audioNodes['Mix_Out_L'], 0);
        audioNodes['Main_Splitter'].connect(audioNodes['Mix_Out_R'], 1);

        audioNodes['Volt1'] = audioCtx.createConstantSource(); audioNodes['Volt1'].start();
        audioNodes['Volt2'] = audioCtx.createConstantSource(); audioNodes['Volt2'].start();
        audioNodes['Volt3'] = audioCtx.createConstantSource(); audioNodes['Volt3'].start();
        audioNodes['Volt4'] = audioCtx.createConstantSource(); audioNodes['Volt4'].start();
        audioNodes['Silence'] = audioCtx.createConstantSource(); audioNodes['Silence'].offset.value = 0; audioNodes['Silence'].start();

        audioNodes['Stereo_Line_In'] = audioCtx.createGain(); audioNodes['Stereo_Line_In'].gain.value = 10.0;
        audioNodes['Stereo_L_Pre'] = audioCtx.createGain(); audioNodes['Stereo_R_Pre'] = audioCtx.createGain();

        if (!audioNodes['Amp_Analyser']) {
            audioNodes['Amp_Analyser'] = audioCtx.createAnalyser();
            audioNodes['Amp_Analyser'].fftSize = 32;
            audioNodes['Amp_Meter_Data'] = new Uint8Array(audioNodes['Amp_Analyser'].frequencyBinCount);
        }
    }

    // --- Ensure Custom Modules Exist (Dynamic Add) ---
    // Always recreate custom modules to ensure fresh state and correct internal routing
    // --- Ensure Custom Modules Exist (Dynamic Add) ---
    // CLEANUP OLD MODULES FIRST to prevent accumulation/leaks
    if (typeof CUSTOM_MODULES !== 'undefined') {
        CUSTOM_MODULES.forEach(mod => {
            const oldNode = audioNodes[mod.id];
            if (oldNode) {
                // Disconnect standard IO
                if (oldNode.input) { try { oldNode.input.disconnect(); } catch (e) { } }
                if (oldNode.gains) oldNode.gains.forEach(g => { try { g.disconnect(); } catch (e) { } });
                if (oldNode.output) { try { oldNode.output.disconnect(); } catch (e) { } }

                // STOP Sources (Critical for Noise/Buffers)
                if (oldNode.whiteNode) { try { oldNode.whiteNode.stop(); } catch (e) { } }
                if (oldNode.pinkNode) { try { oldNode.pinkNode.stop(); } catch (e) { } }

                // Generic Output cleanup if array
                if (oldNode.outputs) oldNode.outputs.forEach(o => { try { if (o) o.disconnect(); } catch (e) { } });
            }

            // Always create new to ensure fresh state and correct internal routing
            const node = createCustomModuleNode(mod);
            if (node) {
                audioNodes[mod.id] = node;
            }
        });
    }

    // 2. DISCONNECT
    const disconnectNode = (n) => { try { if (n) n.disconnect(); } catch (e) { } };

    // Note: We do NOT disconnect custom modules here because we just recreated them.
    // Disconnecting them would break their internal wiring (e.g. CV Input connected to Gain Param).

    disconnectNode(audioNodes['Stereo_L_Pre']);
    disconnectNode(audioNodes['Stereo_R_Pre']);
    // if (audioNodes['Mic_Splitter']) disconnectNode(audioNodes['Mic_Splitter']); // Don't disconnect! It breaks Card connections.

    if (audioNodes['VCO1']) {
        disconnectNode(audioNodes['VCO1'].output);
        disconnectNode(audioNodes['VCO1_Sin'].output);
    }
    if (audioNodes['VCO2']) {
        disconnectNode(audioNodes['VCO2'].output);
        disconnectNode(audioNodes['VCO2_Sin'].output);
    }
    // Update Filter Disconnects
    if (audioNodes['VCF1']) {
        disconnectNode(audioNodes['VCF1'].filter);
        disconnectNode(audioNodes['VCF1'].hpBpOut);
    }
    if (audioNodes['VCF2']) {
        disconnectNode(audioNodes['VCF2'].filter);
        disconnectNode(audioNodes['VCF2'].hpBpOut);
    }
    if (audioNodes['Slopes1']) disconnectNode(audioNodes['Slopes1'].output);
    if (audioNodes['Slopes2']) disconnectNode(audioNodes['Slopes2'].output);
    if (audioNodes['RingMod']) disconnectNode(audioNodes['RingMod'].output);
    if (audioNodes['Stomp']) { disconnectNode(audioNodes['Stomp'].internalOutput); disconnectNode(audioNodes['Stomp'].sendOut); }
    if (audioNodes['Amp']) disconnectNode(audioNodes['Amp'].output);

    if (audioNodes['Computer_IO']) {
        const cio = audioNodes['Computer_IO'];
        disconnectNode(cio.outputL); disconnectNode(cio.outputR); disconnectNode(cio.cv1Out); disconnectNode(cio.cv2Out); disconnectNode(cio.pulse1Out); disconnectNode(cio.pulse2Out);
    }
    disconnectNode(audioNodes['Volt1']); disconnectNode(audioNodes['Volt2']); disconnectNode(audioNodes['Volt3']); disconnectNode(audioNodes['Volt4']);
    disconnectNode(audioNodes['Silence']); disconnectNode(audioNodes['Chassis_Gain']); disconnectNode(audioNodes['Scratch_Gain']);

    // 3. MAP JACKS
    const jackMap = {
        'jack-audio1ou': audioNodes['Computer_IO'].outputL,
        'jack-audio1out': audioNodes['Computer_IO'].outputL,
        'jack-audio2out': audioNodes['Computer_IO'].outputR,
        'jack-cv1out': audioNodes['Computer_IO'].cv1Out,
        'jack-cv2out': audioNodes['Computer_IO'].cv2Out,
        'jack-pulse1out': audioNodes['Computer_IO'].pulse1Out,
        'jack-pulse2out': audioNodes['Computer_IO'].pulse2Out,

        'jack-audio1in': audioNodes['Computer_IO'].inputL,
        'jack-audio2in': audioNodes['Computer_IO'].inputR,
        'jack-cv1in': audioNodes['Computer_IO'].cv1In,
        'jack-cv2in': audioNodes['Computer_IO'].cv2In,
        'jack-pulse1in': audioNodes['Computer_IO'].pulse1In,
        'jack-pulse2in': audioNodes['Computer_IO'].pulse2In,

        'jack-osc1sqrOut': audioNodes['VCO1'].output,
        'jack-osc1sinOut': audioNodes['VCO1'].sinOutput, // Use the new Sine buffer
        // Pitch/FM inputs are shared since it's one module now
        'jack-osc1pitchIn': audioNodes['VCO1'].pitchSum,
        'jack-osc1fmIn': audioNodes['VCO1'].fmGain,

        'jack-osc2sqrOut': audioNodes['VCO2'].output,
        'jack-osc2sinOut': audioNodes['VCO2'].sinOutput,
        'jack-osc2pitchIn': audioNodes['VCO2'].pitchSum,
        'jack-osc2fmIn': audioNodes['VCO2'].fmGain,

        'jack-osc2pitchIn': [audioNodes['VCO2'].pitchSum, audioNodes['VCO2_Sin'].pitchSum],
        'jack-osc2fmIn': [audioNodes['VCO2'].fmGain, audioNodes['VCO2_Sin'].fmGain],
        'jack-filter1In': audioNodes['VCF1'].input,
        'jack-filter1lpOut': audioNodes['VCF1'].filter,
        'jack-filter1hpOut': audioNodes['VCF1'].hpBpOut,
        'jack-filter1fmIn': audioNodes['VCF1'].fmGain,
        'jack-filter2In': audioNodes['VCF2'].input,
        'jack-filter2lpOut': audioNodes['VCF2'].filter,
        'jack-filter2hpOut': audioNodes['VCF2'].hpBpOut,
        'jack-filter2fmIn': audioNodes['VCF2'].fmGain,

        'jack-slopes1in': audioNodes['Slopes1'].input, 'jack-slopes1out': audioNodes['Slopes1'].output, 'jack-slopes1cvIn': audioNodes['Slopes1'].cvInput,
        'jack-slopes2in': audioNodes['Slopes2'].input, 'jack-slopes2out': audioNodes['Slopes2'].output, 'jack-slopes2cvIn': audioNodes['Slopes2'].cvInput,
        'jack-ring1in': audioNodes['RingMod'].inputA, 'jack-ring2in': audioNodes['RingMod'].inputB, 'jack-ringOut': audioNodes['RingMod'].output,
        'jack-stompIn': audioNodes['Stomp'].input, 'jack-stomnpSend': audioNodes['Stomp'].sendOut, 'jack-stompReturn': audioNodes['Stomp'].returnIn, 'jack-stompOut': audioNodes['Stomp'].output,
        'jack-ampIn': audioNodes['Amp'].input, 'jack-ampOut': audioNodes['Amp'].output,
        'jack-mixer1in': audioNodes['Mixer_Ch1'], 'jack-mixer2in': audioNodes['Mixer_Ch2'], 'jack-mixer3in': audioNodes['Mixer_Ch3'], 'jack-mixer4in': audioNodes['Mixer_Ch4'],
        'jack-volt1Out': audioNodes['Volt1'], 'jack-volt2Out': audioNodes['Volt2'], 'jack-volt3Out': audioNodes['Volt3'], 'jack-volt4Out': audioNodes['Volt4'],
        'jack-stereoIn': audioNodes['Stereo_Line_In'],
        'jack-stereoIn1Out': audioNodes['Stereo_L_Pre'],
        'jack-stereoIn2Out': audioNodes['Stereo_R_Pre'],
        'jack-mixerLout': audioNodes['Mix_Out_L'],
        'jack-mixerRout': audioNodes['Mix_Out_R'],

    };

    // --- Dynamic Jack Mapping for Custom Modules ---
    if (typeof CUSTOM_MODULES !== 'undefined') {
        CUSTOM_MODULES.forEach(mod => {
            const node = audioNodes[mod.id];
            if (!node) return;

            if (node.type === 'mult') {
                jackMap[`${mod.id}_in_0`] = node.input;
                jackMap[`${mod.id}_out_0`] = node.outputs[0];
                jackMap[`${mod.id}_out_1`] = node.outputs[1];
                jackMap[`${mod.id}_out_2`] = node.outputs[2];
            }
            else if (node.type === 'attenuator') {
                jackMap[`${mod.id}_in_0`] = node.input;
                jackMap[`${mod.id}_out_0`] = node.output;
            }
            else if (node.type === 'vca') {
                jackMap[`${mod.id}_in_0`] = node.input;    // Signal
                jackMap[`${mod.id}_in_1`] = node.cvInput;  // CV
                jackMap[`${mod.id}_out_0`] = node.output;
            }
            else if (node.type === 'midi') {
                if (node.inputs) {
                    jackMap[`${mod.id}_in_0`] = node.inputs[0];
                    jackMap[`${mod.id}_in_1`] = node.inputs[1];
                    jackMap[`${mod.id}_in_2`] = node.inputs[2];
                    jackMap[`${mod.id}_in_3`] = node.inputs[3];
                }
                if (node.outputs) {
                    jackMap[`${mod.id}_out_0`] = node.outputs[0];
                    jackMap[`${mod.id}_out_1`] = node.outputs[1];
                    jackMap[`${mod.id}_out_2`] = node.outputs[2];
                    jackMap[`${mod.id}_out_3`] = node.outputs[3];
                }
            }
            else if (node.type === 'mixer') {
                if (node.inputs) {
                    jackMap[`${mod.id}_in_0`] = node.inputs[0];
                    jackMap[`${mod.id}_in_1`] = node.inputs[1];
                    jackMap[`${mod.id}_in_2`] = node.inputs[2];
                }
                jackMap[`${mod.id}_out_0`] = node.output;
            }
            else if (node.type === 'noise') {
                if (node.gains) {
                    jackMap[`${mod.id}_out_0`] = node.gains[0]; // White
                    jackMap[`${mod.id}_out_1`] = node.gains[1]; // Pink
                }
            }
            else if (node.type === 'scope') {
                // Map inputs for the docked scope
                if (node.inputs) {
                    jackMap[`${mod.id}_in_0`] = node.inputs[0]; // Ch1
                    jackMap[`${mod.id}_in_1`] = node.inputs[1]; // Ch2
                }
            }
            else if (node.type === 'sequencer') {
                if (node.input) jackMap[`${mod.id}_in_0`] = node.input; // Clock In
                if (node.outputs && node.outputs.length >= 2) {
                    jackMap[`${mod.id}_out_0`] = node.outputs[0]; // CV
                    jackMap[`${mod.id}_out_1`] = node.outputs[1]; // Gate
                }
                if (node.outputs && node.outputs.length >= 3) {
                    jackMap[`${mod.id}_out_2`] = node.outputs[2]; // Quantized CV
                }
            }
        });
    }

    connectPedalChain();

    cableData.forEach(cable => {
        // These connections are handled internally by the Worklet (via 'feedbackAmt')
        // to achieve zero-latency feedback. Connecting them here would double the signal.
        const isVco1Self = (cable.start === 'jack-osc1sinOut' && cable.end === 'jack-osc1fmIn') ||
            (cable.start === 'jack-osc1fmIn' && cable.end === 'jack-osc1sinOut');

        const isVco2Self = (cable.start === 'jack-osc2sinOut' && cable.end === 'jack-osc2fmIn') ||
            (cable.start === 'jack-osc2fmIn' && cable.end === 'jack-osc2sinOut');

        if (isVco1Self || isVco2Self) return;
        // --- FIX END ---

        const sMap = jackMap[cable.start]; const eMap = jackMap[cable.end];
        const isOutput = (id) => /out|volt|send/i.test(id); const isInput = (id) => /in|fm|return/i.test(id);

        let source = null, dest = null;
        if (isOutput(cable.start) && isInput(cable.end)) { source = sMap; dest = eMap; }
        else if (isOutput(cable.end) && isInput(cable.start)) { source = eMap; dest = sMap; }

        if (source && dest) {
            const sources = Array.isArray(source) ? source : [source]; const dests = Array.isArray(dest) ? dest : [dest];
            sources.forEach(src => { dests.forEach(dst => { try { if (dst instanceof AudioParam) src.connect(dst); else src.connect(dst); } catch (e) { } }); });
        }
    });

    const isConnected = (jackId) => cableData.some(c => c.start === jackId || c.end === jackId);

    if (!isConnected('jack-ring1in')) audioNodes['VCO1_Sin'].output.connect(audioNodes['RingMod'].inputA);
    if (!isConnected('jack-ring2in')) audioNodes['VCO2_Sin'].output.connect(audioNodes['RingMod'].inputB);
    if (!isConnected('jack-osc1fmIn')) audioNodes['VCO2_Sin'].output.connect(audioNodes['VCO1'].fmGain);
    if (!isConnected('jack-osc1fmIn')) audioNodes['VCO2_Sin'].output.connect(audioNodes['VCO1_Sin'].fmGain);
    if (!isConnected('jack-osc2fmIn')) audioNodes['VCO1_Sin'].output.connect(audioNodes['VCO2'].fmGain);
    if (!isConnected('jack-osc2fmIn')) audioNodes['VCO1_Sin'].output.connect(audioNodes['VCO2_Sin'].fmGain);
    if (!isConnected('jack-slopes1in')) audioNodes['Silence'].connect(audioNodes['Slopes1'].input);
    if (!isConnected('jack-slopes2in')) audioNodes['Silence'].connect(audioNodes['Slopes2'].input);

    if (isConnected('jack-stereoIn')) {
        audioNodes['Stereo_Line_In'].connect(audioNodes['Stereo_L_Pre']);
        audioNodes['Stereo_Line_In'].connect(audioNodes['Stereo_R_Pre']);
    } else {
        if (audioNodes['Mic_Splitter'] && micEnabled) {
            audioNodes['Mic_Splitter'].connect(audioNodes['Stereo_L_Pre'], 0);
            audioNodes['Mic_Splitter'].connect(audioNodes['Stereo_R_Pre'], 1);
        }
    }

    if (!isConnected('jack-ampIn')) {
        if (audioNodes['Chassis_Gain']) audioNodes['Chassis_Gain'].connect(audioNodes['Amp'].input);
        if (audioNodes['Scratch_Gain']) audioNodes['Scratch_Gain'].connect(audioNodes['Amp'].input);
        // Reconnect PiezoContactMic output each time graph is rebuilt (if samples are loaded)
        if (piezoMic && piezoMic.loaded) {
            try { piezoMic.output.connect(audioNodes['Amp'].input); } catch(e) {}
        }
    }

    // Humpback Filter Normalization
    if (!isConnected('jack-filter2In')) {
        audioNodes['VCF1'].filter.connect(audioNodes['VCF2'].input);
    }

    const stomp = audioNodes['Stomp'];
    const pedals = audioNodes['Pedalboard'];
    try { stomp.sendOut.connect(pedals.input); } catch (e) { }
    if (!isConnected('jack-stompReturn')) {
        pedals.output.connect(stomp.returnIn);
    } else {
        try { pedals.output.disconnect(stomp.returnIn); } catch (e) { }
    }
    audioNodes['Amp'].output.connect(audioNodes['Amp_Analyser']);

    updateAudioParams();

    // Scope Logic
    globalJackMap = {
        // Computer / Main
        'jack-audio1out': audioNodes['Computer_IO'].outputL,
        'jack-audio2out': audioNodes['Computer_IO'].outputR,
        'jack-cv1out': audioNodes['Computer_IO'].cv1Out,
        'jack-cv2out': audioNodes['Computer_IO'].cv2Out,
        'jack-pulse1out': audioNodes['Computer_IO'].pulse1Out,
        'jack-pulse2out': audioNodes['Computer_IO'].pulse2Out,

        // Oscillators
        'jack-osc1sqrOut': audioNodes['VCO1']?.output,
        'jack-osc1sinOut': audioNodes['VCO1_Sin']?.output,
        'jack-osc2sqrOut': audioNodes['VCO2']?.output,
        'jack-osc2sinOut': audioNodes['VCO2_Sin']?.output,
        // Processors
        'jack-slopes1out': audioNodes['Slopes1'].output,
        'jack-slopes2out': audioNodes['Slopes2'].output,
        'jack-ampOut': audioNodes['Amp'].output,
        'jack-ringOut': audioNodes['RingMod'].output,

        // Filters
        'jack-filter1hpOut': audioNodes['VCF1'].hpBpOut,
        'jack-filter1lpOut': audioNodes['VCF1'].filter,
        'jack-filter2hpOut': audioNodes['VCF2'].hpBpOut,
        'jack-filter2lpOut': audioNodes['VCF2'].filter,

        // Mixer & Stereo
        'jack-mixerLout': audioNodes['Mix_Out_L'],
        'jack-mixerRout': audioNodes['Mix_Out_R'],
        'jack-stereoIn1Out': audioNodes['Stereo_L_Pre'],
        'jack-stereoIn2Out': audioNodes['Stereo_R_Pre'],

        // Voltages
        'jack-volt1Out': audioNodes['Volt1'],
        'jack-volt2Out': audioNodes['Volt2'],
        'jack-volt3Out': audioNodes['Volt3'],
        'jack-volt4Out': audioNodes['Volt4']
    };
    initScope();
    updateScopeConnection();
    isBuildingAudioGraph = false;
}

function connectPedalChain() {
    if (!audioNodes['Pedalboard']) return;

    const pb = audioNodes['Pedalboard'];
    const nodes = pb.nodes;

    // 1. Disconnect everything first
    try { pb.input.disconnect(); } catch (e) { }
    Object.values(nodes).forEach(n => {
        try { n.out.disconnect(); } catch (e) { }
    });

    // 2. Build the chain based on activePedalChain array
    const signalChain = [...activePedalChain].reverse();

    let currentSource = pb.input;

    signalChain.forEach(pedalId => {
        const pedalNode = nodes[pedalId];
        if (pedalNode) {
            currentSource.connect(pedalNode.in);
            currentSource = pedalNode.out;
        }
    });

    // 3. Connect final pedal to Output
    currentSource.connect(pb.output);
}

/* =========================================================================
   RUNTIME PARAMETERS & UTILITIES
   ========================================================================= */

function getKnobValue(id, min, max, type = 'linear') {
    const state = componentStates[id];
    let deg = state ? parseFloat(state.value) : (SYSTEM_CONFIG[id]?.defValue || 0);

    // Normalize degrees (-150 to 150) to 0.0 to 1.0
    let norm = (deg + 150) / 300;
    if (norm < 0) norm = 0; if (norm > 1) norm = 1;

    if (type === 'exp') {
        if (min === 0 || Math.abs(min) < 0.001) {
            return max * Math.pow(norm, 2);
        }
        return min * Math.pow(max / min, norm);
    }
    return min + (max - min) * norm;
}

const updateSlopes = (id, knobId, shapeSwId, loopSwId, ledTopId, ledBotId) => {
    const mod = audioNodes[id];
    if (!mod || !mod.processor) return;
    const node = mod.processor;

    // 1. Sync Controls
    const kVal = componentStates[knobId] ? parseFloat(componentStates[knobId].value) : 0;
    const normKnob = (kVal + 150) / 300;

    const loopVal = componentStates[loopSwId]?.value;
    const mode = (loopVal === undefined) ? 1 : parseInt(loopVal);

    const rawShape = componentStates[shapeSwId]?.value;
    const shape = (rawShape === undefined) ? 1 : parseInt(rawShape);

    node.port.postMessage({ mode: mode, shape: shape, knobRate: normKnob });

    // 2. LED PWM Visualization
    const topLed = document.getElementById(ledTopId);
    const botLed = document.getElementById(ledBotId);

    if (topLed && botLed && node.ledValues) {
        topLed.classList.remove('active');
        botLed.classList.remove('active');

        const redColor = '239, 68, 68';

        if (node.ledValues.rise > 0.01) {
            topLed.classList.add('active');
            topLed.style.backgroundColor = `rgba(${redColor}, ${node.ledValues.rise})`;
            topLed.style.boxShadow = `0 0 ${8 * node.ledValues.rise}px rgba(${redColor}, ${node.ledValues.rise})`;
        } else {
            topLed.style.backgroundColor = '';
            topLed.style.boxShadow = '';
        }

        if (node.ledValues.fall > 0.01) {
            botLed.classList.add('active');
            botLed.style.backgroundColor = `rgba(${redColor}, ${node.ledValues.fall})`;
            botLed.style.boxShadow = `0 0 ${8 * node.ledValues.fall}px rgba(${redColor}, ${node.ledValues.fall})`;
        } else {
            botLed.style.backgroundColor = '';
            botLed.style.boxShadow = '';
        }
    }
};

function triggerHandlingNoise(eventType = 'tap', velocity = null, targetId = null, coords = null) {
    if (!audioCtx || !audioNodes['Chassis_Gain'] || !audioNodes['Scratch_Gain']) return;

    const now = audioCtx.currentTime;
    const thump   = audioNodes['Chassis_Gain'].gain;
    const scratch = audioNodes['Scratch_Gain'].gain;
    const scratchFilter = audioNodes['Scratch_Filter'];

    let type = eventType;
    if (type === true) type = 'drag';
    if (type === false || !type) type = 'tap';

    // 50/50 latch switch randomization to match VCV behavior
    if (type === 'latch_switch') {
        type = Math.random() < 0.5 ? 'latch_switch' : 'mom_switch_snap';
    }

    const knobId = 'knob-medium-amp';
    const savedState = componentStates[knobId];
    const currentAngle = savedState ? parseFloat(savedState.value) : -100;

    let gainFactor = (currentAngle + 150) / 300;
    if (gainFactor < 0) gainFactor = 0;
    if (gainFactor > 1) gainFactor = 1;

    if (gainFactor < 0.01) {
        thump.cancelScheduledValues(now);
        scratch.cancelScheduledValues(now);
        thump.setValueAtTime(0, now);
        scratch.setValueAtTime(0, now);
        return;
    }

    // Calculate proximity scaling for knobs to match VCV Rack's getKnobProximity()
    let proximity = 1.0;
    if (targetId && targetId.startsWith('knob-') && typeof SYSTEM_CONFIG !== 'undefined' && SYSTEM_CONFIG[targetId]) {
        const config = SYSTEM_CONFIG[targetId];
        if (config && config.x && config.y) {
            // Preamp contact mic is at Amp Gain knob position {51.35%, 16.75%}
            const ax = 51.35;
            const ay = 16.75;
            const px = parseFloat(config.x);
            const py = parseFloat(config.y);
            if (!isNaN(px) && !isNaN(py)) {
                const dist = Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
                proximity = Math.exp(-dist / 30.0);
            }
        }
        if (proximity < 0.01) return; // Bypassed if too far to be audible
    }

    thump.cancelScheduledValues(now);
    scratch.cancelScheduledValues(now);

    // === Primary: real piezo samples ===
    if (piezoMic && piezoMic.loaded) {
        const groups = piezoMic.groups;
        
        if (type === 'drag') {
            let loopGrp = 'scratch_near_loop';
            let volScale = 1.2;
            let cutoff = 2500;

            if (coords) {
                if (coords.x < 200) {
                    loopGrp = 'scratch_mid_loop';
                    volScale = 0.4;
                    cutoff = 1200; // Lowpass filter in VCV
                } else if (coords.x < 400) {
                    loopGrp = 'scratch_mid_loop';
                    volScale = 0.7;
                    cutoff = 2200;
                } else if (coords.y < 250) {
                    loopGrp = 'scratch_near_loop';
                    volScale = 1.2;
                    cutoff = 2500;
                } else {
                    loopGrp = 'scratch_grating_loop';
                    volScale = 1.2;
                    cutoff = 2500;
                }
            } else {
                loopGrp = gainFactor > 0.6 ? 'scratch_near_loop' : 'scratch_mid_loop';
                volScale = 0.6;
            }

            if (!piezoMic._activeLoop || piezoMic._activeLoop !== loopGrp) {
                if (piezoMic._activeLoop) piezoMic.stopLoop();
                piezoMic.startLoop(loopGrp, proximity * volScale);
            }
            scratchFilter.frequency.setValueAtTime(cutoff, now);

        } else if (type === 'rotate_knob_loop') {
            const loopGrp = 'rotate_knob_loop';
            if (!piezoMic._activeLoop) {
                piezoMic.startLoop(loopGrp, proximity * 0.4);
            }
        } else {
            let chosen = null;
            let volScale = 1.0;

            if (groups.includes(type)) {
                chosen = type;
            } else if (type === 'tap' && coords) {
                if (coords.x < 200) {
                    chosen = 'tap_far';
                    volScale = 0.5;
                } else if (coords.x < 400) {
                    chosen = 'tap_mid';
                    volScale = 0.8;
                } else if (coords.y < 250) {
                    chosen = 'tap_near';
                    volScale = 1.0;
                } else {
                    chosen = 'bump_chassis';
                    volScale = 1.0;
                }
            } else {
                const nearGrp = groups.find(g => g === 'tap_near');
                const midGrp  = groups.find(g => g === 'tap_mid');
                const farGrp  = groups.find(g => g === 'tap_far');
                const bumpGrp = groups.find(g => g === 'bump_chassis');
                chosen = gainFactor > 0.65 ? (nearGrp || bumpGrp || midGrp || groups[0])
                       : gainFactor > 0.3  ? (midGrp  || nearGrp || farGrp || groups[0])
                       :                     (farGrp  || midGrp  || nearGrp || groups[0]);
            }
            
            if (chosen) {
                const vel = velocity !== null ? velocity : (proximity * volScale * (0.5 + Math.random() * 0.5));
                piezoMic.trigger(chosen, {
                    velocity: vel,
                    pitch: 1 + (Math.random() - 0.5) * 0.06
                });
            }
        }

        const bgLevel = 0.005 * gainFactor;
        const bDur = (type === 'drag' || type === 'rotate_knob_loop') ? 0.04 : 0.12;
        const baseFreq = (type === 'drag' || type === 'rotate_knob_loop') ? (2500 + Math.random() * 3000) : 2500;
        if (type !== 'drag') {
            scratchFilter.frequency.setValueAtTime(baseFreq, now);
        }
        thump.setValueAtTime(0, now);
        thump.linearRampToValueAtTime(bgLevel * 0.5, now + 0.005);
        thump.exponentialRampToValueAtTime(0.0001, now + bDur);
        scratch.setValueAtTime(0, now);
        scratch.linearRampToValueAtTime(bgLevel * 0.1, now + 0.001);
        scratch.exponentialRampToValueAtTime(0.0001, now + bDur / 2);
        return;
    }

    // === Fallback: noise simulation ===
    const isDrag = (type === 'drag' || type === 'rotate_knob_loop');
    const thumpVol  = 1.5 * (isDrag ? 0.5 : 3.0) * gainFactor * proximity;
    const scratchVol = 0.0005 * (isDrag ? (1.5 + Math.random()) : 2.0) * gainFactor * proximity;
    const duration  = 10 * (isDrag ? 0.04 : 0.15);

    thump.setValueAtTime(0, now);
    thump.linearRampToValueAtTime(thumpVol, now + 0.005);
    thump.exponentialRampToValueAtTime(0.001, now + duration);

    const baseFreq = isDrag ? (2500 + Math.random() * 3000) : 2500;
    scratchFilter.frequency.setValueAtTime(baseFreq, now);

    scratch.setValueAtTime(0, now);
    scratch.linearRampToValueAtTime(0.01 * scratchVol, now + 0.001);
    scratch.exponentialRampToValueAtTime(0.001, now + (duration / 2));
}

function updateAmpMeter() {
    if (!audioCtx || audioCtx.state !== 'running' || !audioNodes['Amp_Analyser']) return;

    const ana = audioNodes['Amp_Analyser'];
    const data = audioNodes['Amp_Meter_Data'];

    ana.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        const amplitude = (data[i] - 128) / 128.0;
        sum += amplitude * amplitude;
    }
    const rms = Math.sqrt(sum / data.length);
    const db = 20 * Math.log10(Math.max(0.001, rms));

    // HOOK: Process External MIDI Modules
    processExternalMidiModules();

    let targetLevel = (db + 40) / 38;
    if (targetLevel < 0) targetLevel = 0;
    if (targetLevel > 1) targetLevel = 1;

    if (targetLevel > smoothAmpLevel) {
        smoothAmpLevel += (targetLevel - smoothAmpLevel) * 0.6;
    } else {
        smoothAmpLevel += (targetLevel - smoothAmpLevel) * 0.05;
    }

    const displayLevel = smoothAmpLevel * 4.5;



    for (let i = 1; i <= 4; i++) {
        const led = document.getElementById(`led-amp-${i}`);
        if (led) {
            if (i <= displayLevel) {
                led.classList.add('active');
                led.style.backgroundColor = '#ef4444';
                led.style.boxShadow = '0 0 8px #ef4444, inset 0 0 2px rgba(255,255,255,0.5)';
            } else {
                led.classList.remove('active');
                led.style.backgroundColor = '';
                led.style.boxShadow = '';
            }
        }
    }
}

function updateAudioParams() {
    if (!audioCtx || Object.keys(audioNodes).length === 0) return;
    const now = audioCtx.currentTime;

    if (activeComputerCard) {
        const getNorm = (id) => {
            const val = componentStates[id] ? parseFloat(componentStates[id].value) : 0;
            return (val + 150) / 300;
        };

        const params = {
            x: getNorm('knob-small-x'),
            y: getNorm('knob-small-y'),
            main: getNorm('knob-large-computer'),
            switch: componentStates['switch-3way-computer']?.value || 0
        };

        activeComputerCard.update(params, now);
    }

    // Oscillators
    const getOscFreq = (knobId) => {
        const kVal = componentStates[knobId] ? parseFloat(componentStates[knobId].value) : 0;
        const center = 130.81; // C3 at 12 o'clock

        // Split Curve Logic:
        // Ensures we hit exactly 0.5Hz at Min and 26.5kHz at Max

        if (kVal >= 0) {
            // Upper Half (0 to +150): 130.81Hz -> 26500Hz
            return center * Math.pow(26500 / center, kVal / 150);
        } else {
            // Lower Half (0 to -150): 130.81Hz -> 0.5Hz
            return center * Math.pow(0.5 / center, Math.abs(kVal) / 150);
        }
    };

    // Fine Tune: 1.38 ratio range
    // Total Range = 1200 * log2(1.38) ~= 558 cents
    // Knob (+/- 150) maps to +/- 279 cents
    const getFineTune = (knobId) => {
        const kVal = componentStates[knobId] ? parseFloat(componentStates[knobId].value) : 0;
        const totalCents = 1200 * Math.log2(1.38);
        return (kVal / 150) * (totalCents / 2);
    };

    // --- OSC 1 ---
    const vco1 = audioNodes['VCO1'];
    const osc1Freq = getOscFreq('knob-large-osc1');
    const fine1 = getFineTune('knob-small-osc1fine');

    safeParam(vco1.osc.parameters.get('frequency'), osc1Freq, now);
    safeParam(vco1.osc.parameters.get('detune'), fine1, now);

    // FM AC Depth (Exponential curve for timbre)
    const fm1Val = getKnobValue('knob-small-osc1fm', 0, 14750, 'exp');
    safeParam(vco1.fmGain.gain, fm1Val, now);

    // Self-Patch Logic
    const isSelfPatched1 = cableData.some(c =>
        (c.start === 'jack-osc1sinOut' && c.end === 'jack-osc1fmIn') ||
        (c.start === 'jack-osc1fmIn' && c.end === 'jack-osc1sinOut')
    );

    if (isSelfPatched1) {
        // Calculate Normalized Knob Position (0.0 to 1.0)
        // Knob raw: -150 to +150.
        const kRaw = componentStates['knob-small-osc1fm'] ? parseFloat(componentStates['knob-small-osc1fm'].value) : -150;
        const kNorm = (kRaw + 150) / 300;

        safeParam(vco1.osc.parameters.get('feedbackAmt'), kNorm, now);
        safeParam(vco1.osc.parameters.get('fmGain'), fm1Val, now);
    } else {
        safeParam(vco1.osc.parameters.get('feedbackAmt'), 0, now);
    }

    // --- OSC 2 ---
    const vco2 = audioNodes['VCO2'];
    const osc2Freq = getOscFreq('knob-large-osc2');
    const fine2 = getFineTune('knob-small-osc2fine');

    safeParam(vco2.osc.parameters.get('frequency'), osc2Freq, now);
    safeParam(vco2.osc.parameters.get('detune'), fine2, now);

    const fm2Val = getKnobValue('knob-small-osc2fm', 0, 14750, 'exp');
    safeParam(vco2.fmGain.gain, fm2Val, now);

    const isSelfPatched2 = cableData.some(c =>
        (c.start === 'jack-osc2sinOut' && c.end === 'jack-osc2fmIn') ||
        (c.start === 'jack-osc2fmIn' && c.end === 'jack-osc2sinOut')
    );

    if (isSelfPatched2) {
        const kRaw = componentStates['knob-small-osc2fm'] ? parseFloat(componentStates['knob-small-osc2fm'].value) : -150;
        const kNorm = (kRaw + 150) / 300;

        safeParam(vco2.osc.parameters.get('feedbackAmt'), kNorm, now);
        safeParam(vco2.osc.parameters.get('fmGain'), fm2Val, now);
    } else {
        safeParam(vco2.osc.parameters.get('feedbackAmt'), 0, now);
    }

    const updateFilter = (mod, kCutoff, kRes, kFm, swId) => {
        const node = mod.processor;
        if (!node) return;

        // 1. Calculate Cutoff (Exponential)
        const cutVal = componentStates[kCutoff] ? parseFloat(componentStates[kCutoff].value) : -150;
        // Map -150..150 to 20Hz..20kHz
        const cutoffHz = 20 * Math.pow(1000, (cutVal + 150) / 300);

        safeParam(node.parameters.get('cutoff'), cutoffHz, now);

        // 2. FM Amount (Linear FM)
        const fmDepth = getKnobValue(kFm, 0, 10000, 'exp');
        safeParam(mod.fmGain.gain, fmDepth, now);

        // 3. Resonance
        const rRaw = getKnobValue(kRes, 0, 1, 'linear');
        const resVal = Math.pow(rRaw, 0.5) * 2.0; // Full 0..1.0 w-range for VCV gainRes formula, self-resonance at 3pm (rRaw=0.8 -> w~0.9)
        safeParam(node.parameters.get('resonance'), resVal, now);

        // 4. Update Mode Switch
        const sw = componentStates[swId]?.value || 0;
        safeParam(node.parameters.get('mode'), 1 - sw, now);
    };

    // --- Correct Calls (Pass IDs, not values) ---
    updateFilter(
        audioNodes['VCF1'],
        'knob-large-filter1',
        'knob-small-filter1res',
        'knob-small-filter1fm',
        'switch-2way-filter1hp'
    );

    updateFilter(
        audioNodes['VCF2'],
        'knob-large-filter2',
        'knob-small-filter2res',
        'knob-small-filter2fm',
        'switch-2way-filter2hp'
    );

    updateSlopes('Slopes1', 'knob-medium-slopes1', 'switch-3way-slopes1shape', 'switch-3way-slopes1loop', 'led-slopes1-rise', 'led-slopes1-fall');
    updateSlopes('Slopes2', 'knob-medium-slopes2', 'switch-3way-slopes2shape', 'switch-3way-slopes2loop', 'led-slopes2-rise', 'led-slopes2-fall');

    // Amp & Mixer — mode is inverted vs VCV (sw=0 = LoFi, sw=1 = Mic in patchnotes UI)
    const ampGain = getKnobValue('knob-medium-amp', 0, 1, 'linear'); // 0..1 knob → worklet gain param
    const ampMode = componentStates['switch-2way-amp']?.value || 0;
    if (audioNodes['Amp']?.workletNode) {
        safeParam(audioNodes['Amp'].workletNode.parameters.get('gain'), ampGain, now);
        safeParam(audioNodes['Amp'].workletNode.parameters.get('mode'), 1 - ampMode, now); // invert: sw0=LoFi, sw1=Mic
    }

    safeParam(audioNodes['Mixer_Ch1'].gain, getKnobValue('knob-small-mix1', 0, 1), now);
    safeParam(audioNodes['Mixer_Ch2'].gain, getKnobValue('knob-small-mix2', 0, 1), now);
    safeParam(audioNodes['Mixer_Ch3'].gain, getKnobValue('knob-small-mix3', 0, 1), now);
    safeParam(audioNodes['Mixer_Ch4'].gain, getKnobValue('knob-small-mix4', 0, 1), now);
    safeParam(audioNodes['Mixer_Pan1'].pan, getKnobValue('knob-small-mix1pan', -1, 1), now);
    safeParam(audioNodes['Mixer_Pan2'].pan, getKnobValue('knob-small-mix2pan', -1, 1), now);
    safeParam(audioNodes['Master_Vol'].gain, getKnobValue('knob-large-volumeMain', 0, 2), now);

    // Voltage Outputs
    const b1 = componentStates['button-1']?.value || 0;
    const b2 = componentStates['button-2']?.value || 0;
    const b3 = componentStates['button-3']?.value || 0;
    const b4 = componentStates['button-4']?.value || 0;
    const btnIndex = b1 | (b2 << 1) | (b3 << 2) | (b4 << 3);
    const voltKnobAngle = componentStates['knob-small-voltagesBlend'] ? parseFloat(componentStates['knob-small-voltagesBlend'].value) : 0;

    safeParam(audioNodes['Volt1'].offset, getInterpolatedVoltage(voltKnobAngle, btnIndex, 0), now);
    safeParam(audioNodes['Volt2'].offset, getInterpolatedVoltage(voltKnobAngle, btnIndex, 1), now);
    safeParam(audioNodes['Volt3'].offset, getInterpolatedVoltage(voltKnobAngle, btnIndex, 2), now);
    safeParam(audioNodes['Volt4'].offset, getInterpolatedVoltage(voltKnobAngle, btnIndex, 3), now);

    // Stompbox — parameters now routed directly to worklet AudioParams
    const stomp = audioNodes['Stomp'];
    if (stomp?.workletNode) {
        const stompBlend  = getKnobValue('knob-small-stompBlend', 0, 1);
        safeParam(stomp.workletNode.parameters.get('blend'), stompBlend, now);

        const fbKnob  = componentStates['knob-small-stompFeedback'];
        const fbAngle = fbKnob ? parseFloat(fbKnob.value) : -150;
        const fbNorm  = Math.max(0, Math.min(1, (fbAngle + 150) / 300)); // −150..150 → 0..1
        safeParam(stomp.workletNode.parameters.get('fbKnob'), fbNorm, now);

        const isPb = cableData.some(c => c.start === 'jack-stompReturn' || c.end === 'jack-stompReturn') ? 0.0 : 1.0;
        safeParam(stomp.workletNode.parameters.get('pedalboardConnected'), isPb, now);
    }

    // Pedalboard
    const pb = audioNodes['Pedalboard'].nodes;

    // Distortion
    const distActive = componentStates['pedal_dist_active']?.value === 1;
    if (distActive) {
        const drive = getKnobValue('p_dist_drive', 0, 100);
        pb.dist.effect.curve = createDistortionCurve(drive);
        const tone = getKnobValue('p_dist_tone', 1000, 10000);
        safeParam(pb.dist.tone.frequency, tone, now);
    } else {
        pb.dist.effect.curve = createDistortionCurve(0);
    }

    // Phaser
    const phaserActive = componentStates['pedal_phaser_active']?.value === 1;
    const pMix = phaserActive ? getKnobValue('p_phaser_mix', 0, 1) : 0;
    safeParam(pb.phaser.wet.gain, pMix, now);
    const pRate = getKnobValue('p_phaser_rate', 0.1, 10);
    safeParam(pb.phaser.lfo.frequency, pRate, now);
    const pDepth = getKnobValue('p_phaser_depth', 0, 1000);
    safeParam(pb.phaser.depth.gain, pDepth, now);

    // Chorus
    const chorusActive = componentStates['pedal_chorus_active']?.value === 1;
    const cMix = chorusActive ? getKnobValue('p_chorus_mix', 0, 1) : 0;
    safeParam(pb.chorus.mix.gain, cMix, now);
    const cRate = getKnobValue('p_chorus_rate', 0.1, 5);
    safeParam(pb.chorus.lfo.frequency, cRate, now);
    const cDepth = getKnobValue('p_chorus_depth', 0, 0.005);
    safeParam(pb.chorus.depth.gain, cDepth, now);

    // Delay
    const delayActive = componentStates['pedal_delay_active']?.value === 1;
    const dMix = delayActive ? getKnobValue('p_delay_mix', 0, 1) : 0;
    safeParam(pb.delay.mix.gain, dMix, now);
    const dTime = getKnobValue('p_delay_time', 0.001, 1.0);
    safeParam(pb.delay.time.delayTime, dTime, now);
    const dFb = getKnobValue('p_delay_fb', 0, 0.9);
    safeParam(pb.delay.feed.gain, dFb, now);

    // Reverb
    const revActive = componentStates['pedal_reverb_active']?.value === 1;
    const rMix = revActive ? getKnobValue('p_rev_mix', 0, 1) : 0;
    safeParam(pb.reverb.mix.gain, rMix, now);

    // --- Custom Module Params ---
    if (typeof CUSTOM_MODULES !== 'undefined') {
        CUSTOM_MODULES.forEach(mod => {
            const node = audioNodes[mod.id];
            if (!node) return;

            if (node.type === 'attenuator') {
                const val = getKnobValue(`${mod.id}_knob_0`, 0, 1);
                safeParam(node.gainParam, val, now);
            }
            else if (node.type === 'vca') {
                // Knob 0: Main Bias (0 to 1)
                const bias = getKnobValue(`${mod.id}_knob_0`, 0, 1);
                // Knob 1: CV Amount (0 to 1) -> Allow boosting for weak signals? Let's stick to 0-1 for now.
                const cv = getKnobValue(`${mod.id}_knob_1`, 0, 1);

                // console.log(`VCA ${mod.id}: Bias ${bias.toFixed(2)}, CV Amt ${cv.toFixed(2)}`);

                safeParam(node.gainParam, bias, now);
                safeParam(node.cvAmtParam, cv, now);
            }
            else if (node.type === 'mixer') {
                // 3 Knobs for 3 Input Gains
                const vol1 = getKnobValue(`${mod.id}_knob_0`, 0, 1.5); // Boost allow
                const vol2 = getKnobValue(`${mod.id}_knob_1`, 0, 1.5);
                const vol3 = getKnobValue(`${mod.id}_knob_2`, 0, 1.5);

                safeParam(node.gains[0], vol1, now);
                safeParam(node.gains[1], vol2, now);
                safeParam(node.gains[2], vol3, now);
            }
            else if (node.type === 'noise') {
                // Knob 0: Master Level
                const lvl = getKnobValue(`${mod.id}_knob_0`, 0, 1.0);

                // Update both output gains
                safeParam(node.gains[0].gain, lvl, now);
                safeParam(node.gains[1].gain, lvl, now);
            }
            else if (node.type === 'sequencer') {
                // Knobs 0-7 map to Steps 0-7
                for (let i = 0; i < 8; i++) {
                    const val = getKnobValue(`${mod.id}_knob_${i}`, 0, 1);
                    const paramName = `step${i}`;
                    const param = node.processor.parameters.get(paramName);
                    if (param) safeParam(param, val, now);
                }

                // Knob 8: Rate (0 to 40 Hz)
                const rateVal = getKnobValue(`${mod.id}_knob_8`, 0, 40);
                safeParam(node.processor.parameters.get('rate'), rateVal, now);

                // Knob 9: Quantize Mode (0 to 5)
                const quantVal = getKnobValue(`${mod.id}_knob_9`, 0, 5.1);
                safeParam(node.processor.parameters.get('quantize'), quantVal, now);

                // Check Patching: If Clock Input (`_in_0`) has ANY cable connected to it
                const jackId = `${mod.id}_in_0`;
                const isClockPatched = cableData.some(c => c.end === jackId || c.start === jackId);
                const useExtVal = isClockPatched ? 1 : 0;
                safeParam(node.processor.parameters.get('useExternal'), useExtVal, now);
            }
        });
    }
}

/* =========================================================================
   COMPUTER QWERTY KEYBOARD MIDI INPUT
   ========================================================================= */

let keyboardOctaveOffset = 0; // +/- 12 semitones
const activeKeyboardMap = new Map(); // key -> midiNote
const qwertyToNoteMap = {
    'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6, 'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11,
    'k': 12, 'o': 13, 'l': 14, 'p': 15, ';': 16, "'": 17
};

window.addEventListener('keydown', (e) => {
    // 1. Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.repeat) return;

    const key = e.key.toLowerCase();

    // 2. Handle Octave Shifts
    if (key === 'z') {
        keyboardOctaveOffset = Math.max(-24, keyboardOctaveOffset - 12);
        if (typeof showMessage === 'function') showMessage(`Keyboard Octave: ${keyboardOctaveOffset / 12}`, "info");
        return;
    }
    if (key === 'x') {
        keyboardOctaveOffset = Math.min(24, keyboardOctaveOffset + 12);
        if (typeof showMessage === 'function') showMessage(`Keyboard Octave: +${keyboardOctaveOffset / 12}`, "info");
        return;
    }

    // 3. Trigger Notes
    if (qwertyToNoteMap[key] !== undefined) {
        const baseNote = 60; // Middle C
        const note = baseNote + qwertyToNoteMap[key] + keyboardOctaveOffset;

        activeKeyboardMap.set(key, note);
        handleMidiMessage({ data: [144, note, 127] }, true);

        // Visual Feedback
        const el = document.querySelector(`[data-note="${note}"]`);
        if (el) el.classList.add('active');
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (activeKeyboardMap.has(key)) {
        const note = activeKeyboardMap.get(key);
        activeKeyboardMap.delete(key);

        handleMidiMessage({ data: [128, note, 0] }, true);

        // Visual Feedback
        const el = document.querySelector(`[data-note="${note}"]`);
        if (el) el.classList.remove('active');
    }
});

// =========================================================================
// MIDI OUTPUT FUNCTIONS
// =========================================================================

function setMidiInputDevice(id) {
    midiInDeviceId = id;
    console.log("MIDI In Device Set:", id);
}

function getMidiInputs() {
    return midiInputs;
}

function setMidiOutputDevice(id) {
    midiOutDeviceId = id;
    console.log("MIDI Out Device Set:", id);
}

function setMidiOutChannel(ch) {
    midiOutChannel = ch; // 'all' or 1-16
    console.log("MIDI Out Channel Set:", ch);
}

function setMidiInChannel(ch) {
    midiInChannel = ch; // 'all' or 1-16
    console.log("MIDI In Channel Set:", ch);
}

function getMidiOutputs() {
    return midiOutputs;
}

function sendMidiMessage(status, data1, data2) {
    if (!midiAccess || midiOutputs.length === 0) return;

    let finalStatus = status;

    // If it's a channel message (0x80 to 0xEF)
    if (status >= 0x80 && status <= 0xEF) {
        if (midiOutChannel !== 'all') {
            const cmd = status & 0xF0;
            const ch = parseInt(midiOutChannel) - 1; // 0-15
            finalStatus = cmd | ch;
        }
    }

    const msg = [finalStatus, data1];
    if (data2 !== undefined) msg.push(data2);

    midiOutputs.forEach(output => {
        if (midiOutDeviceId === 'all' || output.id === midiOutDeviceId) {
            // console.log(`[MIDI DEBUG] Sending to ${output.name}:`, msg);
            output.send(msg);
        } else {
            // console.log(`[MIDI DEBUG] Skipping ${output.name} (Target: ${midiOutDeviceId})`);
        }
    });
}

function sendMidiNoteOn(note, velocity) {
    sendMidiMessage(0x90, note, velocity);
}

function sendMidiNoteOff(note) {
    sendMidiMessage(0x80, note, 0);
}

function sendMidiCC(cc, value) {
    sendMidiMessage(0xB0, cc, value);
}


// Ensure this exists
if (typeof midiOutJackCc === 'undefined') var midiOutJackCc = {};

function processExternalMidiModules() {
    if (typeof CUSTOM_MODULES === 'undefined' || !audioNodes) return;

    // Global Loop Check (e.g. 1% chance)
    const debug = true;
    // if (Math.random() < 0.001) console.log("MIDI Process Heartbeat");

    CUSTOM_MODULES.forEach(mod => {
        if (mod.config.type !== 'midi') return;

        const node = audioNodes[mod.id];
        if (!node || !node.analysers) {
            // console.warn("MIDI Module missing analysers:", mod.id); 
            return;
        }

        const d = node.data;

        // 1. Read Inputs
        node.analysers.pitch.getFloatTimeDomainData(d.pitch);
        node.analysers.gate.getFloatTimeDomainData(d.gate);
        node.analysers.ccA.getFloatTimeDomainData(d.ccA);
        node.analysers.ccB.getFloatTimeDomainData(d.ccB);

        const cvPitch = d.pitch[0];
        const cvGate = d.gate[0];

        // LOG INPUTS
        if (Math.random() < 0.05) {
            console.log(`[MIDI EXT DEBUG] ${mod.id}: P=${cvPitch.toFixed(2)} G=${cvGate.toFixed(2)}`);
        }

        // --- NOTE LOGIC (with Hysteresis) ---
        // Treat lastGate as the "State" (0 = Low, 1 = High)
        // Rising Threshold: 0.5
        // Falling Threshold: 0.4

        const currentState = d.lastGate > 0.5; // Derive boolean from stored state (assuming we store 0 or 1)
        let newState = currentState;

        // Valid Gate is usually 0V to 1V (after normalisation/clipping) or higher.
        // Input is likely raw audio.
        if (!currentState && cvGate > 0.5) {
            // RISING EDGE
            newState = true;
            const pitchNote = Math.max(0, Math.min(127, Math.round(60 + (cvPitch * 12 * 5))));
            const vel = 100;

            console.log(`[MIDI EXT] Note On: ${pitchNote}`);
            sendMidiNoteOn(pitchNote, vel);
            d.lastNote = pitchNote;

        } else if (currentState && cvGate < 0.4) {
            // FALLING EDGE
            newState = false;

            if (d.lastNote > -1) {
                console.log(`[MIDI EXT] Note Off: ${d.lastNote}`);
                sendMidiNoteOff(d.lastNote);
                d.lastNote = -1;
            }
        }

        // Store STATE (0.0 or 1.0) instead of raw CV to maintain hysteresis memory
        d.lastGate = newState ? 1.0 : 0.0;

        // --- CC LOGIC ---
        const processCC = (val, jackId, lastKey) => {
            const vSafe = Math.max(-1, Math.min(1, val));
            const uni = (vSafe + 1) * 0.5;
            const ccVal = Math.round(uni * 127);

            if (midiOutJackCc && midiOutJackCc[jackId] !== undefined) {
                const ccNum = midiOutJackCc[jackId];
                if (d[lastKey] !== ccVal) {
                    sendMidiCC(ccNum, ccVal);
                    d[lastKey] = ccVal;
                }
            }
        };

        processCC(d.ccA[0], `${mod.id}_in_2`, 'lastCcA');
        processCC(d.ccB[0], `${mod.id}_in_3`, 'lastCcB');
    });
}
