// =========================================================================
// METADATA LIBRARY FOR ALL WORKSHOP SYSTEM CARDS
// Auto-generated from Workshop_Computer/releases/*/info.yaml
// =========================================================================

const CARD_LIBRARY = [
    {
        id: 'midi',
        name: 'Simple MIDI',
        num: '00',
        desc: "Takes USB midi, sends it to pulse and CV outputs, also sends knob positions and CV inputs back to the computer as CC values.",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'CV CC Source 1',
            'jack-cv2in': 'CV CC Source 2',
            'jack-cv1out': 'MIDI Pitch CV 1',
            'jack-cv2out': 'MIDI Pitch CV 2',
            'jack-pulse1out': 'Gate 1',
            'jack-pulse2out': 'Gate 2'
        }
    },
    {
        id: 'turing',
        name: 'Turing Machine',
        num: '03',
        desc: "Turing Machine with tap tempo clock, 2 x pulse outputs, 4 x CV outputs",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-pulse1in': 'External Clock 1',
            'jack-pulse2in': 'External Clock 2',
            'jack-cv1in': 'Diviply CV',
            'jack-cv2in': 'Pitch Offset CV',
            'jack-audio1in': 'Reset',
            'jack-audio2in': 'Preset Select CV',
            'jack-pulse1out': 'Channel 1 Pulse',
            'jack-pulse2out': 'Channel 2 Pulse',
            'jack-cv1out': 'Channel 1 Quantized CV',
            'jack-cv2out': 'Channel 2 Quantized CV',
            'jack-audio1out': 'Channel 1 DAC CV',
            'jack-audio2out': 'Channel 2 DAC CV'
        }
    },
    {
        id: 'benjolin',
        name: 'BYO Benjolin',
        num: '04',
        desc: "Rungler, Chaotic VCO, Noise Source, Turing Machine, Quantizer",
        class: 'CardBenjolin',
        category: 'Voice',
        labels: {
            'jack-pulse1in': 'Forward Clock',
            'jack-pulse2in': 'Reverse Clock',
            'jack-audio1in': 'External Data Source',
            'jack-audio2in': 'Probability Modulation',
            'jack-cv1in': 'Offset Modulation',
            'jack-cv2in': 'VCA Modulation',
            'jack-audio1out': 'Rungler Audio A',
            'jack-audio2out': 'Rungler Audio B',
            'jack-cv1out': 'Quantized CV A',
            'jack-cv2out': 'Quantized CV B',
            'jack-pulse1out': 'Bit Pulse A',
            'jack-pulse2out': 'Bit Pulse B'
        }
    },
    {
        id: 'chord_blimey',
        name: 'Chord Blimey!',
        num: '05',
        desc: "Generates CV/Pulse arpeggios",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-pulse1in': 'Arpeggio Trigger',
            'jack-cv1in': 'Root Pitch CV',
            'jack-cv2in': 'Chord Select CV',
            'jack-cv1out': 'Arpeggio Note CV',
            'jack-cv2out': 'Root CV',
            'jack-pulse1out': 'Note Trigger',
            'jack-pulse2out': 'End-of-Cycle Trigger',
            'jack-audio1out': 'Random Modulation A',
            'jack-audio2out': 'Random Modulation B'
        }
    },
    {
        id: 'usb_audio',
        name: 'USB Audio & MIDI',
        num: '06',
        desc: "6-Channel USB Audio & MIDI firmware with CV/Gate support",
        class: 'CardUSBAudio',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Audio Input 1',
            'jack-audio2in': 'Audio Input 2',
            'jack-cv1in': 'CV Input 1',
            'jack-cv2in': 'CV Input 2',
            'jack-pulse1in': 'Pulse Input 1',
            'jack-pulse2in': 'Pulse Input 2',
            'jack-audio1out': 'Audio Output 1',
            'jack-audio2out': 'Audio Output 2',
            'jack-cv1out': 'CV Output 1',
            'jack-cv2out': 'CV Output 2',
            'jack-pulse1out': 'Pulse Output 1',
            'jack-pulse2out': 'Pulse Output 2'
        }
    },
    {
        id: 'bumpers',
        name: 'Bumpers',
        num: '07',
        desc: "Bouncing ball' style delay and trigger generators",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-pulse1in': 'Trigger Clock A',
            'jack-pulse2in': 'Trigger Clock B',
            'jack-audio1in': 'Delay Audio Input',
            'jack-audio2in': 'Delay Time Modulation',
            'jack-cv1in': 'Timing Modulation A',
            'jack-cv2in': 'Timing Modulation B',
            'jack-pulse1out': 'Bounce Pulse A',
            'jack-pulse2out': 'Bounce Pulse B',
            'jack-cv1out': 'Random Pitch CV',
            'jack-cv2out': 'Ramp CV',
            'jack-audio1out': 'Delay Output L',
            'jack-audio2out': 'Delay Output R'
        }
    },
    {
        id: 'bytebeat',
        name: 'Bytebeat',
        num: '08',
        desc: "Generates and mangles bytebeats",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Parameter 1 Modulation',
            'jack-audio2in': 'Parameter 2 Modulation',
            'jack-cv1in': 'Formula Select Modulation',
            'jack-cv2in': 'Sample Rate Modulation',
            'jack-pulse1in': 'Reset / Trigger',
            'jack-pulse2in': 'Reverse Toggle',
            'jack-audio1out': 'Bytebeat Output',
            'jack-audio2out': 'Next Bytebeat Output',
            'jack-cv1out': 'Slow Bytebeat CV',
            'jack-cv2out': 'Fast Bytebeat CV',
            'jack-pulse1out': '1-Bit Output',
            'jack-pulse2out': 'Time Division Clock'
        }
    },
    {
        id: 'divcom',
        name: 'DivCom',
        num: '09',
        desc: "Comparator and VC clock divider, inspired by Serge NCOM",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Comparator Signal',
            'jack-audio2in': 'Comparator Reference',
            'jack-cv1in': 'Divider Amount CV',
            'jack-cv2in': 'Count Direction Invert',
            'jack-pulse1in': 'Divider Clock',
            'jack-pulse2in': 'Divider Reset',
            'jack-audio1out': 'Comparator Gate',
            'jack-audio2out': 'Divider Gate',
            'jack-pulse1out': 'Divider Flip-Flop',
            'jack-pulse2out': 'Comparator XOR Divider',
            'jack-cv1out': 'Counter Pitch CV',
            'jack-cv2out': 'Divider Value CV'
        }
    },
    {
        id: 'twists',
        name: 'Twists',
        num: '10',
        desc: "A port of Mutable Instruments Braids with a web editor",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-cv1in': 'Pitch CV',
            'jack-pulse1in': 'Trigger',
            'jack-audio1in': 'Timbre Modulation',
            'jack-audio2in': 'Color Modulation',
            'jack-audio1out': 'Main Audio Output'
        }
    },
    {
        id: 'goldfish',
        name: 'Goldfish',
        num: '11',
        desc: "Weird delay/looper for audio and CV",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Audio Input',
            'jack-audio2in': 'Main Parameter Modulation',
            'jack-cv1in': 'X Modulation',
            'jack-cv2in': 'Y Modulation',
            'jack-pulse1in': 'Clock / Step Trigger',
            'jack-pulse2in': 'Reset Trigger',
            'jack-audio1out': 'Left Audio Output',
            'jack-audio2out': 'Right Audio Output',
            'jack-cv1out': 'CV Mix Output',
            'jack-cv2out': 'Quantized CV Output',
            'jack-pulse1out': 'Pulse A',
            'jack-pulse2out': 'Pulse B'
        }
    },
    {
        id: 'am_coupler',
        name: 'AM Coupler',
        num: '12',
        desc: "AM radio transmitter / coupler",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Modulator Audio 1',
            'jack-audio2in': 'Modulator Audio 2',
            'jack-cv1in': 'Fine Tune CV',
            'jack-pulse1in': 'RF Gate',
            'jack-audio1out': 'WAV Playback Monitor',
            'jack-audio2out': 'Modulation Signal Monitor'
        }
    },
    {
        id: 'noisebox',
        name: 'Noisebox',
        num: '13',
        desc: "13-algorithm noise synth with CV modulation, sample-and-hold, and crusher mode",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Main Offset Modulation',
            'jack-audio2in': 'VCA Control',
            'jack-cv1in': 'X Offset CV',
            'jack-cv2in': 'Y Offset CV',
            'jack-pulse1in': 'Sample-and-Hold Trigger',
            'jack-pulse2in': 'Crusher Gate',
            'jack-audio1out': 'Noise Output A',
            'jack-audio2out': 'Noise Output B',
            'jack-cv1out': 'Sample-and-Hold CV',
            'jack-cv2out': 'Slewed CV',
            'jack-pulse1out': 'S&H Comparator Gate',
            'jack-pulse2out': 'Realtime Comparator Gate'
        }
    },
    {
        id: 'cvmod',
        name: 'CVMod',
        num: '14',
        desc: "Quad CV delay inspired by Make Noise Multimod",
        class: 'CardCVMod',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Record CV Input',
            'jack-audio2in': 'Speed Modulation',
            'jack-cv1in': 'Loop Time Modulation',
            'jack-cv2in': 'Phase Modulation',
            'jack-pulse1in': 'Reset Trigger',
            'jack-audio1out': 'Read Head 1',
            'jack-audio2out': 'Read Head 2',
            'jack-cv1out': 'Read Head 3',
            'jack-cv2out': 'Read Head 4'
        }
    },
    {
        id: 'mlrws',
        name: 'MLRws',
        num: '15',
        desc: "A remix of monome's classic MLR sample cutting platform (grid controller encouraged but optional)",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Audio Input 1',
            'jack-audio2in': 'Audio Input 2',
            'jack-cv1in': 'X Modulation CV',
            'jack-cv2in': 'Y Modulation CV',
            'jack-pulse1in': 'Reset / Cut Trigger',
            'jack-pulse2in': 'Clock / Advance Trigger',
            'jack-audio1out': 'Stereo Left Mix',
            'jack-audio2out': 'Stereo Right Mix',
            'jack-cv1out': 'Cut/Turing Pitch CV',
            'jack-cv2out': 'Trigger Envelope CV',
            'jack-pulse1out': 'Cut/Wrap Trigger',
            'jack-pulse2out': 'Envelope-End Trigger'
        }
    },
    {
        id: 'chord_organ',
        name: 'Chord Organ-ish',
        num: '18',
        desc: "Chord Organ-ish - 16 chords, 8 voices, 1V/oct root. Inspired by Music Thing Chord Organ.",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Chord Selection CV',
            'jack-cv2in': 'Root Pitch CV',
            'jack-audio1in': 'VCA CV',
            'jack-pulse1in': 'Progression Trigger',
            'jack-pulse2in': 'Waveform Trigger',
            'jack-audio1out': 'Chord Audio Left',
            'jack-audio2out': 'Chord Audio Right',
            'jack-cv1out': 'Highest Chord Note',
            'jack-cv2out': 'Progression Root CV',
            'jack-pulse1out': 'Chord Change Trigger'
        }
    },
    {
        id: 'reverb',
        name: 'Reverb+',
        num: '20',
        desc: "Reverb effect, plus pulse/CV generators and MIDI-to-CV, configurable using web interface.",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Reverb Input Left',
            'jack-audio2in': 'Reverb Input Right (Inverted)',
            'jack-cv1in': 'Configurable CV Input 1',
            'jack-cv2in': 'Configurable CV Input 2',
            'jack-pulse1in': 'Configurable Pulse Input 1',
            'jack-pulse2in': 'Configurable Pulse Input 2',
            'jack-audio1out': 'Reverb Output Left',
            'jack-audio2out': 'Reverb Output Right',
            'jack-cv1out': 'Configurable CV Output 1',
            'jack-cv2out': 'Configurable CV Output 2',
            'jack-pulse1out': 'Configurable Pulse Output 1',
            'jack-pulse2out': 'Configurable Pulse Output 2'
        }
    },
    {
        id: 'resonator',
        name: 'Resonator',
        num: '21',
        desc: "Karplus-Strong based sympathetic resonator. Can be used for resonant droning as well as plucking sounds.",
        class: 'CardNoOp',
        category: 'Other',
        labels: {
            'jack-audio1in': 'Excitation Input Left',
            'jack-audio2in': 'Excitation Input Right',
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Damping CV',
            'jack-pulse1in': 'Pluck Trigger',
            'jack-pulse2in': 'Next Chord Trigger',
            'jack-audio1out': 'Resonator Output Mid',
            'jack-audio2out': 'Resonator Output Side'
        }
    },
    {
        id: 'sheep',
        name: 'Sheep',
        num: '22',
        desc: "A time-stretching and pitch-shifting granular processor and digital degradation playground with 2 fidelity options.",
        class: 'CardSheep',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Granular Input Left',
            'jack-audio2in': 'Granular Input Right',
            'jack-cv1in': 'Grain Position CV',
            'jack-cv2in': 'Grain Speed CV',
            'jack-pulse1in': 'Grain Trigger',
            'jack-pulse2in': 'Grain Gate',
            'jack-audio1out': 'Granular Output Left',
            'jack-audio2out': 'Granular Output Right',
            'jack-cv1out': 'Random CV',
            'jack-cv2out': 'Buffer Phase CV',
            'jack-pulse1out': 'Grain Completion Trigger',
            'jack-pulse2out': 'Stochastic Clock'
        }
    },
    {
        id: 'slowmod',
        name: 'SlowMod',
        num: '23',
        desc: "Chaotic quad-LFO with VCAs",
        class: 'CardNoOp',
        category: 'Modulation',
        labels: {
            'jack-audio1in': 'VCA Control A',
            'jack-audio2in': 'VCA Control B',
            'jack-cv1in': 'VCA Control C',
            'jack-cv2in': 'VCA Control D',
            'jack-pulse1in': 'Pause Trigger',
            'jack-pulse2in': 'Randomize Trigger',
            'jack-audio1out': 'Fast LFO',
            'jack-audio2out': 'Mid Fast LFO',
            'jack-cv1out': 'Mid Slow LFO',
            'jack-cv2out': 'Slow LFO'
        }
    },
    {
        id: 'crafted_volts',
        name: 'Crafted Volts',
        num: '24',
        desc: "Manually set control voltages (CV) with the input knobs and switch. It also attenuverts (attenuates and inverts) incoming voltages.",
        class: 'CardCraftedVolts',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Audio/CV Input A',
            'jack-audio2in': 'Audio/CV Input B',
            'jack-cv1in': 'CV Input X',
            'jack-cv2in': 'CV Input Y',
            'jack-audio1out': 'Main Voltage Output',
            'jack-audio2out': 'Inverted Main Voltage Output',
            'jack-cv1out': 'X Voltage Output',
            'jack-cv2out': 'Y Voltage Output',
            'jack-pulse1out': 'Z High Gate',
            'jack-pulse2out': 'Complement Gate'
        }
    },
    {
        id: 'utility_pair',
        name: 'Utility Pair',
        num: '25',
        desc: "25 small utilities, which can be combined in pairs",
        class: 'CardUtilityPair',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Left Utility Signal Input',
            'jack-cv1in': 'Left Utility CV Input',
            'jack-pulse1in': 'Left Utility Trigger Input',
            'jack-audio2in': 'Right Utility Signal Input',
            'jack-cv2in': 'Right Utility CV Input',
            'jack-pulse2in': 'Right Utility Trigger Input',
            'jack-audio1out': 'Left Utility Signal Output',
            'jack-cv1out': 'Left Utility CV Output',
            'jack-pulse1out': 'Left Utility Pulse Output',
            'jack-audio2out': 'Right Utility Signal Output',
            'jack-cv2out': 'Right Utility CV Output',
            'jack-pulse2out': 'Right Utility Pulse Output'
        }
    },
    {
        id: 'siren',
        name: 'Siren',
        num: '27',
        desc: "Multi-algorithm drone oscillator. Inspired by the Forge TME Vhikk X.",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Processor Input',
            'jack-audio2in': 'Span Modulation',
            'jack-cv1in': 'Pitch Modulation',
            'jack-cv2in': 'Warp Modulation',
            'jack-pulse1in': 'Gate',
            'jack-pulse2in': 'Seed / Bank Trigger',
            'jack-audio1out': 'Left Drone Output',
            'jack-audio2out': 'Right Drone Output',
            'jack-cv1out': 'Pitch CV Mirror',
            'jack-cv2out': 'Envelope CV',
            'jack-pulse1out': 'Sub-osc Clock',
            'jack-pulse2out': 'Divide-by-2 Clock'
        }
    },
    {
        id: 'eighties_bass',
        name: 'Eighties Bass',
        num: '28',
        desc: "Bass-oriented complete monosynth voice consisting of five detuned saw wave oscillators with mixable white noise and adjustable resonant filter.",
        class: 'CardEightiesBass',
        category: 'Voice',
        labels: {
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Cutoff Modulation',
            'jack-audio1in': 'Detune Modulation',
            'jack-audio2in': 'Noise Mix Modulation',
            'jack-audio1out': 'Audio Left',
            'jack-audio2out': 'Audio Right'
        }
    },
    {
        id: 'cirpy',
        name: 'Cirpy Wavetable',
        num: '30',
        desc: "Wavetable oscillator that using wavetables from Plaits, Braids, and Microwave,",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Wavetable Position Mod',
            'jack-pulse1out': 'PWM Audio Out A',
            'jack-pulse2out': 'PWM Audio Out B',
            'jack-cv1out': 'Wavetable Position CV',
            'jack-cv2out': 'LFO Modulation CV'
        }
    },
    {
        id: 'esp',
        name: 'ESP',
        num: '31',
        desc: "A MS-20-style External Signal Processor that includes a preamp, bandpass filter, envelope follower, gate, and 1v/oct pitch outs.",
        class: 'CardNoOp',
        category: 'Modulation',
        labels: {
            'jack-audio1in': 'Audio Input',
            'jack-audio1out': 'Post-Gain Monitor',
            'jack-audio2out': 'Bandpass Monitor',
            'jack-cv1out': 'Pitch CV (1V/Oct)',
            'jack-cv2out': 'Envelope CV',
            'jack-pulse1out': 'Gate Out',
            'jack-pulse2out': 'Trigger Out'
        }
    },
    {
        id: 'vink',
        name: 'Vink',
        num: '32',
        desc: "Dual delay loops with sigmoid saturation for Jaap Vink / Roland Kayn style feedback patching",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Audio Input 1',
            'jack-audio2in': 'Audio Input 2',
            'jack-cv1in': 'Tap 1 Time Mod',
            'jack-cv2in': 'Tap 2 Time Mod',
            'jack-audio1out': 'Delay Tap 1 / Mono Mix',
            'jack-audio2out': 'Delay Tap 2 / Mono Mix',
            'jack-cv1out': 'Chaos CV A',
            'jack-cv2out': 'Chaos CV B',
            'jack-pulse1out': 'Tap 1 Period Pulse',
            'jack-pulse2out': 'Tap 2 Period Pulse'
        }
    },
    {
        id: 'drumdrum',
        name: 'drumdrum',
        num: '33',
        desc: "DFAM-style 8-step sequencer",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Reset',
            'jack-cv1in': 'Velocity Mod',
            'jack-cv2in': 'Global Transpose',
            'jack-cv1out': 'VCO 1 Pitch CV',
            'jack-cv2out': 'Velocity CV',
            'jack-audio1out': 'White Noise',
            'jack-audio2out': 'VCO 2 Pitch CV',
            'jack-pulse1out': 'Step Trigger',
            'jack-pulse2out': 'End-of-Cycle Trigger'
        }
    },
    {
        id: 'dual_quant',
        name: 'DualQuant',
        num: '34',
        desc: "Dual quantised granular pitch shifter with calibrated 1V/oct CV outputs",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Audio Input',
            'jack-cv1in': 'Pitch Mod A',
            'jack-cv2in': 'Pitch Mod B',
            'jack-audio1out': 'Pitch Shift Out A',
            'jack-audio2out': 'Pitch Shift Out B',
            'jack-cv1out': 'Pitch CV Out A',
            'jack-cv2out': 'Pitch CV Out B'
        }
    },
    {
        id: 'freq_shift',
        name: 'FreqShift',
        num: '35',
        desc: "Dual Input Frequency Shifter for Feedback Experimentation",
        class: 'CardNoOp',
        category: 'Other',
    },
    {
        id: 'compulidean',
        name: 'Compulidean',
        num: '37',
        desc: "Generative Euclidean drum + sample player.",
        class: 'CardNoOp',
        category: 'Voice',
    },
    {
        id: 'od',
        name: 'Od',
        num: '38',
        desc: "Loopable chaotic Lorenz attractor trajectories and zero-crossings as CV and pulses, with sensitivity to initial conditions.",
        class: 'CardNoOp',
        category: 'Audio',
    },
    {
        id: 'knots',
        name: 'Knots',
        num: '39',
        desc: "Six-engine oscillator firmware for the Music Thing Workshop System",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'X Modulation Input',
            'jack-audio2in': 'Y Modulation Input',
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'VCA CV',
            'jack-pulse1in': 'Mode Gate',
            'jack-pulse2in': 'Engine Advance Clock',
            'jack-audio1out': 'Audio Output 1',
            'jack-audio2out': 'Audio Output 2',
            'jack-cv1out': 'MIDI Pitch CV',
            'jack-cv2out': 'MIDI CC74 CV',
            'jack-pulse1out': 'MIDI Gate',
            'jack-pulse2out': 'Clock Output'
        }
    },
    {
        id: 'blackbird',
        name: 'Blackbird',
        num: '41',
        desc: "A scriptable, live-codable, USB-serial-to-CV device implementing monome crow's protocol",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'input[1] / bb.connected.cv1',
            'jack-cv2in': 'input[2] / bb.connected.cv2',
            'jack-audio1in': 'bb.audioin[1]',
            'jack-audio2in': 'bb.audioin[2]',
            'jack-pulse1in': 'bb.pulsein[1]',
            'jack-pulse2in': 'bb.pulsein[2]',
            'jack-cv1out': 'output[1]',
            'jack-cv2out': 'output[2]',
            'jack-audio1out': 'output[3]',
            'jack-audio2out': 'output[4]',
            'jack-pulse1out': 'bb.pulseout[1]',
            'jack-pulse2out': 'bb.pulseout[2]'
        }
    },
    {
        id: 'rain',
        name: 'Backyard Rain',
        num: '42',
        desc: "Nature soundscape audio. A cozy rain ambience mix for background listening. You control the intensity. This card plays rain ambience which was recorded in my backyard.",
        class: 'CardNoOp',
        category: 'Audio',
    },
    {
        id: 'birds',
        name: 'Birds',
        num: '44',
        desc: "Two birds sing to each other controlled by a Turing-style shift register sequencer with clock in and CV/pulse out.",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-cv1in': 'Pitch CV Modulation',
            'jack-cv2in': 'Speed CV Modulation',
            'jack-pulse1in': 'External Clock',
            'jack-audio1out': 'Bird One Audio',
            'jack-audio2out': 'Bird Two Audio',
            'jack-cv1out': 'Bird One Pitch Trace',
            'jack-cv2out': 'Bird Two Pitch Trace',
            'jack-pulse1out': 'Bird One Onset Pulse',
            'jack-pulse2out': 'Bird Two Onset Pulse'
        }
    },
    {
        id: 'bends',
        name: 'Bends',
        num: '45',
        desc: "Stereo Multi-FX, Glitch, and Codec Demolisher Card",
        class: 'CardNoOp',
        category: 'Other',
    },
    {
        id: 'rompler',
        name: 'Rompler',
        num: '46',
        desc: "General MIDI SF2 Polyphonic Multisampler",
        class: 'CardNoOp',
        category: 'Voice',
    },
    {
        id: 'nzt',
        name: 'NZT',
        num: '47',
        desc: "Grain Noise and Noise Tools",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Density Modulation CV',
            'jack-cv2in': 'Seed Modulation CV',
            'jack-pulse1in': 'Seed Reset Trigger',
            'jack-pulse2in': 'Sample-and-Hold Clock',
            'jack-audio1in': 'Ring Mod Input',
            'jack-audio2in': 'External Noise Source',
            'jack-audio1out': 'Grain Noise Output A',
            'jack-audio2out': 'Grain Noise Output B',
            'jack-cv1out': 'Static Offset CV',
            'jack-cv2out': 'Sample-and-Hold CV',
            'jack-pulse2out': 'Periodic Pulse'
        }
    },
    {
        id: 'modes',
        name: 'Modes (Elements)',
        num: '49',
        desc: "Physical Modeling Voice (Mutable Instruments Elements port)",
        class: 'CardNoOp',
        category: 'Voice',
    },
    {
        id: 'flux',
        name: 'Flux',
        num: '50',
        desc: "Effects, Synthesizer and Utility",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Audio Input Left / Mono',
            'jack-audio2in': 'Audio Input Right',
            'jack-cv1in': 'CV Mod X',
            'jack-cv2in': 'CV Mod Y',
            'jack-pulse1in': 'Trigger / Gate',
            'jack-pulse2in': 'Utility Clock / Gate',
            'jack-audio1out': 'Stereo Out Left',
            'jack-audio2out': 'Stereo Out Right',
            'jack-cv1out': 'Assignable CV Out 1',
            'jack-cv2out': 'Assignable CV Out 2',
            'jack-pulse1out': 'Assignable Pulse Out 1',
            'jack-pulse2out': 'Assignable Pulse Out 2'
        }
    },
    {
        id: 'grains',
        name: 'Grains',
        num: '51',
        desc: "Granular Sampler and Effect",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Audio Input Left / Mono',
            'jack-audio2in': 'Audio Input Right',
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Position CV',
            'jack-pulse1in': 'Grain Trigger',
            'jack-pulse2in': 'Freeze / Reset',
            'jack-audio1out': 'Stereo Out Left',
            'jack-audio2out': 'Stereo Out Right',
            'jack-cv1out': 'Envelope / Playhead Ramp',
            'jack-cv2out': 'Random / Motion CV',
            'jack-pulse1out': 'Grain / End-of-Cycle Trigger',
            'jack-pulse2out': 'Freeze / Midpoint Trigger'
        }
    },
    {
        id: 'glitter',
        name: 'Glitter',
        num: '53',
        desc: "Granular Looping Sampler",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Audio Input Left',
            'jack-audio2in': 'Audio Input Right',
            'jack-cv1in': 'Grain Repeat Chance CV',
            'jack-cv2in': 'Grain Sleep Chance CV',
            'jack-pulse1in': 'Clock Input',
            'jack-audio1out': 'Audio Out Left',
            'jack-audio2out': 'Audio Out Right'
        }
    },
    {
        id: 'tapegrade',
        name: 'Tapegrade',
        num: '54',
        desc: "Mono-input stereo cassette warble processor with wow, flutter, hiss, crackle, and tape wear morphing.",
        class: 'CardNoOp',
        category: 'Modulation',
        labels: {
            'jack-audio1in': 'Mono Audio Input',
            'jack-audio2in': 'Tape Condition Mod Input',
            'jack-cv1in': 'Tape Depth Mod',
            'jack-cv2in': 'Instability Mod',
            'jack-pulse1in': 'Damage Burst Trigger',
            'jack-pulse2in': 'Crackle Gate',
            'jack-audio1out': 'Stereo Out Left',
            'jack-audio2out': 'Stereo Out Right',
            'jack-cv1out': 'CV1 Attenuated Out',
            'jack-cv2out': 'CV2 Attenuated Out'
        }
    },
    {
        id: 'fifths',
        name: 'Fifths',
        num: '55',
        desc: "A quantizer/sequencer that can create harmony and nimbly traverse the circle of fifths in attempts to make jazz",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-audio1in': 'CV/Audio Source',
            'jack-audio2in': 'VCA Control',
            'jack-cv1in': 'Transpose CV',
            'jack-cv2in': 'Key Select CV',
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Loop Toggle',
            'jack-audio1out': 'Key Monitor Output',
            'jack-audio2out': 'VCA Output',
            'jack-cv1out': 'Quantized Note',
            'jack-cv2out': 'Third Harmony',
            'jack-pulse1out': 'Internal Clock Pulse',
            'jack-pulse2out': 'Sequence Pulse'
        }
    },
    {
        id: 'krell',
        name: 'Krell',
        num: '56',
        desc: "Krell",
        class: 'CardNoOp',
        category: 'Other',
        labels: {
            'jack-cv1in': 'Left Pitch Sample Input',
            'jack-cv2in': 'Right Pitch Sample Input',
            'jack-audio1out': 'Left AD Envelope',
            'jack-audio2out': 'Right AD Envelope',
            'jack-cv1out': 'Left Pitch CV',
            'jack-cv2out': 'Right Pitch CV',
            'jack-pulse1out': 'Left End-of-Cycle Pulse',
            'jack-pulse2out': 'Right End-of-Cycle Pulse'
        }
    },
    {
        id: 'glitch',
        name: 'Glitch',
        num: '57',
        desc: "Clock-synced beat-repeater with ratcheting, reversal and audio degradation",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-audio1in': 'Main Audio Input',
            'jack-pulse1in': 'Clock Input',
            'jack-pulse2in': 'External Gate',
            'jack-cv1in': 'Freeze CV',
            'jack-cv2in': 'Mod CV',
            'jack-audio1out': 'Processed Output',
            'jack-audio2out': 'Dry Output',
            'jack-pulse1out': 'Slice Clock',
            'jack-pulse2out': 'Clock Mirror',
            'jack-cv1out': 'Activity Gate',
            'jack-cv2out': 'Descending Ramp'
        }
    },
    {
        id: 'lochovibes',
        name: 'LoCho Vibes',
        num: '58',
        desc: "Stereo chorus and vibrato effect featuring triangle, sine, and slow drift LFO modes, modulation-based delay movement, and tape-style saturation.",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-audio1in': 'Audio Input Left',
            'jack-audio2in': 'Audio Input Right',
            'jack-cv1in': 'Depth Modulation',
            'jack-cv2in': 'Character Modulation',
            'jack-pulse1in': 'External LFO Clock',
            'jack-audio1out': 'Audio Output Left',
            'jack-audio2out': 'Audio Output Right',
            'jack-cv1out': 'LFO CV',
            'jack-cv2out': 'Inverted LFO CV'
        }
    },
    {
        id: 'bitphase',
        name: 'BitPhase',
        num: '59',
        desc: "experimental phaser/tremolo with bit destruction",
        class: 'CardNoOp',
        category: 'Other',
    },
    {
        id: 'markov',
        name: 'Markov',
        num: '60',
        desc: "Dual generative Markov chain module — evolving melody (MarkoV) left side, rhythmic percussion patterns (MarkovPerc) right side, with internal synth voice",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-pulse1in': 'Master Clock',
            'jack-cv1in': 'Melody Post-Scale Transpose',
            'jack-cv2in': 'Internal Tempo CV',
            'jack-pulse1out': 'Melody Change Gate',
            'jack-cv1out': 'Melody Pitch CV',
            'jack-pulse2out': 'Percussion Trigger',
            'jack-cv2out': 'Percussion Accent CV',
            'jack-audio1out': 'Internal Synth Voice A',
            'jack-audio2out': 'Internal Output B / Dual Melody Voice B'
        }
    },
    {
        id: 'voices_of_sid',
        name: 'Voices of SID',
        num: '64',
        desc: "Dual MOS 6581 SID emulation (reSID engine) with CV/gate control, stereo output, waveform selection, and randomize",
        class: 'CardNoOp',
        category: 'Voice',
    },
    {
        id: 'stretchcore',
        name: 'Stretchcore',
        num: '66',
        desc: "A card for playing and manipulating samples with tempo control, timestretch with browser-based audio loading (infinitedigits.com/stretchcore/)",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Jump Trigger',
            'jack-cv1in': 'Timestretch Modulation',
            'jack-cv2in': 'Jump Position CV',
            'jack-audio1out': 'Audio Output Left',
            'jack-audio2out': 'Audio Output Right',
            'jack-cv1out': 'Random CV 1',
            'jack-cv2out': 'Random CV 2',
            'jack-pulse1out': 'Jump Gesture Trigger',
            'jack-pulse2out': 'Sample-Select Gesture Trigger'
        }
    },
    {
        id: 'trace',
        name: 'Trace',
        num: '69',
        desc: "Oscillograph stereo oscillator",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Modulation Input 1',
            'jack-audio2in': 'Modulation Input 2',
            'jack-cv1in': 'Pitch Modulation',
            'jack-pulse1in': 'Next Bank',
            'jack-pulse2in': 'Next Oscillator',
            'jack-audio1out': 'X Channel Audio',
            'jack-audio2out': 'Y Channel Audio',
            'jack-pulse1out': 'Switch Advance Trigger',
            'jack-pulse2out': 'Oscillator Advance Pulse'
        }
    },
    {
        id: 'degenerator',
        name: 'Degenerator',
        num: '71',
        desc: "Degenerator — Disintegrating Looper. Capture audio loops and apply irreversible degradation with 6 algorithms (Saturation, Filter Drift, Tape Hiss, Oxide Shedding, Bit Crush, Bit Rot) via preview/apply workflow. Inspired by William Basinski's The Disintegration Loops.",
        class: 'CardNoOp',
        category: 'Audio',
        labels: {
            'jack-audio1in': 'Primary Audio Input',
            'jack-audio2in': 'Secondary Audio Input',
            'jack-cv1in': 'Main Amount Modulation',
            'jack-cv2in': 'Y Effect Modulation',
            'jack-pulse1in': 'Record Trigger',
            'jack-pulse2in': 'Reset / Slot Select Trigger',
            'jack-audio1out': 'Loop Output',
            'jack-audio2out': 'Input Monitor',
            'jack-cv1out': 'Loop Position CV',
            'jack-cv2out': 'Output Envelope CV',
            'jack-pulse1out': 'Loop Boundary Pulse',
            'jack-pulse2out': 'Record Complete Pulse'
        }
    },
    {
        id: 'motorik',
        name: 'Motorik',
        num: '72',
        desc: "Motorik drum machine — kick/snare/hihat with bass and melody CV, classic Krautrock grooves",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Fill Trigger',
            'jack-audio1in': 'Energy Override Input',
            'jack-audio2in': 'Texture Override Input',
            'jack-cv1in': 'Bass Root Transpose CV',
            'jack-cv2in': 'Bass Pattern Shift CV',
            'jack-audio1out': 'Drum Mix Output A',
            'jack-audio2out': 'Drum Mix Output B',
            'jack-pulse1out': 'Bass Root Gate',
            'jack-pulse2out': 'Bass Mirror Gate',
            'jack-cv1out': 'Bass Root Pitch CV',
            'jack-cv2out': 'Bass Mirror Pitch CV'
        }
    },
    {
        id: 'wild_pebble',
        name: 'Wild Pebble',
        num: '74',
        desc: "Playable generative rhythm and melody organism inspired by Pet Rock",
        class: 'CardNoOp',
        category: 'Other',
        labels: {
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Freeze Gate',
            'jack-cv1in': 'Density Modulation',
            'jack-cv2in': 'Mutation Modulation',
            'jack-pulse1out': 'Primary Trigger Stream',
            'jack-pulse2out': 'Companion Trigger Stream',
            'jack-cv1out': 'Quantized Melody CV',
            'jack-cv2out': 'Energy/Tension CV',
            'jack-audio1out': 'Kick Voice',
            'jack-audio2out': 'Snare Voice'
        }
    },
    {
        id: 'placeholder',
        name: 'Placeholder',
        num: '77',
        desc: "Reserved for secret project",
        class: 'CardNoOp',
        category: 'Other',
    },
    {
        id: 'talker',
        name: 'Talker',
        num: '78',
        desc: "Proof of concept speech synthesizer, based on TalkiePCM, inspired by 1970s LPC speech synths.",
        class: 'CardNoOp',
        category: 'Voice',
        labels: {
            'jack-audio1in': 'Exciter Audio Replace',
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Speed CV',
            'jack-audio1out': 'Speech Output',
            'jack-audio2out': 'LPC Exciter Components',
            'jack-cv1out': 'Exciter Amplitude',
            'jack-cv2out': 'Exciter Pitch'
        }
    },
    {
        id: 'computer_grids',
        name: 'Computer Grids',
        num: '82',
        desc: "Grids-inspired trigger sequencer with Web MIDI SysEx configuration.",
        class: 'CardNoOp',
        category: 'Sequencer',
        labels: {
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Pattern Reset',
            'jack-cv1in': 'Map Modulation',
            'jack-cv2in': 'Fill Modulation',
            'jack-pulse1out': 'Trigger Lane 1',
            'jack-pulse2out': 'Trigger Lane 2',
            'jack-cv1out': 'Trigger Lane 3',
            'jack-cv2out': 'Aux Output'
        }
    },
    {
        id: 'tesserae',
        name: 'Tesserae',
        num: '86',
        desc: "Tesserae — Variable-voice (2-8) arpeggiated chord generator with 5 patterns, 10 scales, tap tempo, CV/audio transpose inputs, and dual CV + audio pitch outputs. Inspired by Laurie Spiegel's Music Mouse and Patchwork.",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Pitch Transpose',
            'jack-audio2in': 'Root Transpose',
            'jack-cv1in': 'Melody Position CV',
            'jack-cv2in': 'Chord Spacing CV',
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Reset',
            'jack-cv1out': 'Arpeggiated Note',
            'jack-cv2out': 'Root Note',
            'jack-audio1out': 'Arpeggiated Note Audio',
            'jack-audio2out': 'Previous Note Audio',
            'jack-pulse1out': 'Gate',
            'jack-pulse2out': 'Trigger'
        }
    },
    {
        id: 'blank',
        name: 'Blank',
        num: '88',
        desc: "Reserved for blank 88 cards",
        class: 'CardNoOp',
        category: 'Other',
    },
    {
        id: 'duo_midi',
        name: 'Duo MIDI',
        num: '98',
        desc: "A duophonic midi device/host interface",
        class: 'CardNoOp',
        category: 'Utility',
        labels: {
            'jack-pulse1in': 'Voice 1 Envelope Gate Input',
            'jack-pulse2in': 'Voice 2 Envelope Gate Input',
            'jack-cv1out': 'Voice 1 Pitch',
            'jack-cv2out': 'Voice 2 Pitch',
            'jack-audio1out': 'Voice 1 ASR Envelope',
            'jack-audio2out': 'Voice 2 ASR Envelope',
            'jack-pulse1out': 'Voice 1 Trigger/Gate',
            'jack-pulse2out': 'Voice 2 Trigger/Gate'
        }
    },
    {
        id: 'toolbox',
        name: 'Toolbox',
        num: '99',
        desc: "Mixer, VCA, noise, S&H, clock generator, etc.",
        class: 'CardToolbox',
        category: 'Utility',
    },
    {
        id: 'network',
        name: 'Tab Link',
        num: '111',
        desc: "WebRTC Audio Link. Connects audio between browser tabs.",
        class: 'CardNetwork',
        category: 'Utility',
        labels: {
            'knob-large-computer': 'Level',
            'jack-audio1in': 'In L',
            'jack-audio2in': 'In R',
            'jack-audio1out': 'Out L',
            'jack-audio2out': 'Out R',
            'switch-3way-computer': 'Link'
        }
    },
    {
        id: 'none',
        name: 'No Card',
        num: '--',
        desc: "Slot Empty.",
        class: 'CardNoOp',
        category: 'Other',
    }
];

if (typeof window !== 'undefined') {
    window.CARD_LIBRARY = CARD_LIBRARY;
}
