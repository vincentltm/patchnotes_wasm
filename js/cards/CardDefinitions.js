// =========================================================================
// METADATA LIBRARY FOR ALL WORKSHOP SYSTEM CARDS
// Auto-generated from Workshop_Computer/releases/*/info.yaml
// =========================================================================

const CARD_LIBRARY = [
    {
        id: 'simple_midi',
        name: 'Simple MIDI',
        num: '00',
        desc: 'Takes USB midi, sends it to pulse and CV outputs, also sends knob positions and CV inputs back to the computer as CC values.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'CV CC Source 1',
            'jack-cv2in': 'CV CC Source 2',
            'jack-cv1out': 'MIDI Pitch CV 1',
            'jack-cv2out': 'MIDI Pitch CV 2',
            'jack-pulse1out': 'Gate 1',
            'jack-pulse2out': 'Gate 2'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'MIDI CC Source (Main)',
                'knob-small-x': 'MIDI CC Source (X)',
                'knob-small-y': 'MIDI CC Source (Y)'
            },
            'down': {
                'knob-large-computer': 'Enter Calibration'
            }
        },
        creator: 'Tom Whitwell',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/00_Simple_MIDI'
    },
    {
        id: 'turing_machine',
        name: 'Turing Machine',
        num: '03',
        desc: 'Turing Machine with tap tempo clock, 2 x pulse outputs, 4 x CV outputs',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Randomness / Write',
                'knob-small-x': 'Loop Length',
                'knob-small-y': 'Divide/Multiply'
            },
            'down': {
                'knob-large-computer': 'Tap Tempo'
            }
        },
        creator: 'Tom Whitwell',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/03_Turing_Machine'
    },
    {
        id: 'byo_benjolin',
        name: 'BYO Benjolin',
        num: '04',
        desc: 'Rungler, Chaotic VCO, Noise Source, Turing Machine, Quantizer',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-pulse1in': 'FWD Clk In',
            'jack-pulse2in': 'Back Clk In',
            'jack-audio1in': 'Data Input',
            'jack-audio2in': 'Lock CV',
            'jack-cv1in': 'Offset CV',
            'jack-cv2in': 'VCA CV',
            'jack-audio1out': 'Raw Out 1',
            'jack-audio2out': 'Raw Out 2',
            'jack-cv1out': 'Quant Out 1',
            'jack-cv2out': 'Quant Out 2',
            'jack-pulse1out': '1-Bit Out 1',
            'jack-pulse2out': '1-Bit Out 2'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Chaos',
                'knob-small-x': 'Offset',
                'knob-small-y': 'Chaos VCA'
            }
        },
        creator: 'Dune Desormeaux',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/04_BYO_Benjolin'
    },
    {
        id: 'usb_audio_bridge',
        name: 'USB Audio & MIDI',
        num: '06',
        desc: '6-Channel USB Audio & MIDI firmware with CV/Gate support',
        class: 'WasmCardWrapper',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'MIDI CC Source (Main)',
                'knob-small-x': 'MIDI CC Source (X)',
                'knob-small-y': 'MIDI CC Source (Y)'
            }
        },
        creator: 'Vincent Maurer (vincentmaurer.de)',
        license: 'GPL-3.0',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/06_usb_audio'
    },
    {
        id: 'bumpers',
        name: 'Bumpers',
        num: '07',
        desc: 'Bouncing ball\' style delay and trigger generators',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Bounce Decay',
                'knob-small-x': 'Channel A Rate',
                'knob-small-y': 'Channel B Rate'
            },
            'down': {
                'knob-large-computer': 'Manual Trigger'
            }
        },
        creator: 'Chris Johnson',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/07_bumpers'
    },
    {
        id: 'goldfish',
        name: 'Goldfish',
        num: '11',
        desc: 'Weird delay/looper for audio and CV',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Left Audio Input',
            'jack-audio2in': 'Right Audio Input',
            'jack-cv1in': 'X Mod',
            'jack-cv2in': 'Y Mod',
            'jack-pulse1in': 'Sample Trig / clock',
            'jack-pulse2in': 'Reset / Rec Gate',
            'jack-audio1out': 'Left Audio Output',
            'jack-audio2out': 'Right Audio Output',
            'jack-cv1out': 'CV Mix Output',
            'jack-cv2out': 'Quantized CV Output',
            'jack-pulse1out': 'Internal Clock Output',
            'jack-pulse2out': 'Clock Divider Output'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Time / Speed',
                'knob-small-x': 'Int Clock Rate',
                'knob-small-y': 'Clock Div'
            }
        },
        creator: 'Dune Desormeaux',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/11_goldfish'
    },
    {
        id: 'noisebox',
        name: 'Noisebox',
        num: '13',
        desc: '13-algorithm noise synth with CV modulation, sample-and-hold, and crusher mode',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'up': {
                'knob-large-computer': 'Algorithm Select',
                'knob-small-x': 'Parameter X',
                'knob-small-y': 'Parameter Y'
            },
            'down': {
                'knob-large-computer': 'Randomize Offsets'
            }
        },
        creator: 'Eric Gao',
        license: 'CC BY-NC-SA 3.0',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/13_noisebox'
    },
    {
        id: 'cvmod',
        name: 'CVMod',
        num: '14',
        desc: 'Quad CV delay inspired by Make Noise Multimod',
        class: 'WasmCardWrapper',
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
        },
        layers: {
            'down': {
                'knob-large-computer': 'Reset Heads'
            },
            'up': {
                'knob-large-computer': 'Next Motion Function'
            }
        },
        creator: 'Chris Johnson',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/14_cvmod'
    },
    {
        id: 'mlrws',
        name: 'MLRws',
        num: '15',
        desc: 'A remix of monome\'s classic MLR sample cutting platform (grid controller encouraged but optional). Diagrams here are for Gridless mode.',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
            'jack-cv2out': 'ASR Envelope CV',
            'jack-pulse1out': 'Cut/Wrap Trigger',
            'jack-pulse2out': 'Envelope-End Trigger'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Track Select / Turing Probability',
                'knob-small-x': 'Mix Gain',
                'knob-small-y': 'Radiate'
            },
            'up': {
                'knob-large-computer': 'Selected Track Speed / Direction',
                'knob-small-x': 'Selected Track Level Slot',
                'knob-small-y': 'Selected Track Start Position'
            },
            'down': {
                'knob-small-y': 'CV2 Envelope Attack',
                'knob-large-computer': 'Record-Hold / Reset Gesture',
                'knob-small-x': 'Input Gain'
            }
        },
        creator: 'Dune Desormeaux',
        license: 'GPL-3.0',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/15_MLRws'
    },
    {
        id: 'ca_sequencer',
        name: 'Cellular Automata Sequencer',
        num: '19',
        desc: '16-cell gate and quantized CV melody generator inspired by NLC Cellular Automata, using CA rules 90 & 150 on a 4x4 grid',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {},
        layers: {},
        creator: 'Ainews',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/19_CA_Sequencer'
    },
    {
        id: 'reverb',
        name: 'Reverb+',
        num: '20',
        desc: 'Reverb effect, plus pulse/CV generators and MIDI-to-CV, configurable using web interface.',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'any': {
                'knob-large-computer': 'Configurable Parameter A',
                'knob-small-x': 'Configurable Parameter B',
                'knob-small-y': 'Configurable Parameter C'
            },
            'up': {
                'knob-large-computer': 'Reverb Open Input'
            },
            'middle': {
                'knob-large-computer': 'Reverb Input Gated'
            },
            'down': {
                'knob-large-computer': 'Reverb Freeze'
            }
        },
        creator: 'Chris Johnson',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/20_reverb'
    },
    {
        id: 'resonator',
        name: 'Resonator',
        num: '21',
        desc: 'Karplus-Strong sympathetic resonator for droning and plucked textures, with chord & tanpura tunings, arpeggiator, pitch tracking and web-configurable CV/pulse outputs.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Excitation Input Left',
            'jack-audio2in': 'Excitation Input Right',
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Damping CV',
            'jack-pulse1in': 'Pluck Trigger',
            'jack-pulse2in': 'Next Chord Trigger',
            'jack-audio1out': 'Resonator Output Mid',
            'jack-audio2out': 'Resonator Output Side'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Wet Dry Mix',
                'knob-small-x': 'Base Pitch',
                'knob-small-y': 'Damping'
            },
            'up': {
                'knob-large-computer': 'Tuning Mode'
            },
            'down': {
                'knob-large-computer': 'Factory Reset Progression'
            }
        },
        creator: 'Johan Eklund',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/21_resonator'
    },
    {
        id: 'sheep',
        name: 'Sheep',
        num: '22',
        desc: 'A time-stretching and pitch-shifting granular processor and digital degradation playground with 2 fidelity options.',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'any': {
                'knob-large-computer': 'Grain Speed',
                'knob-small-x': 'Delay Spread',
                'knob-small-y': 'Grain Size'
            }
        },
        creator: 'Dune Desormeaux',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/22_sheep'
    },
    {
        id: 'crafted_volts',
        name: 'Crafted Volts',
        num: '24',
        desc: 'Manually set control voltages (CV) with the input knobs and switch. It also attenuverts (attenuates and inverts) incoming voltages.',
        class: 'WasmCardWrapper',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Main Attenuverter',
                'knob-small-x': 'CV1 Attenuverter',
                'knob-small-y': 'CV2 Attenuverter'
            },
            'up': {
                'knob-large-computer': 'Gate High State'
            },
            'down': {
                'knob-large-computer': 'Momentary Gate High'
            }
        },
        creator: 'Brian Dorsey',
        license: '',
        repository: 'https://codeberg.org/briandorsey/mtmws_cards/src/branch/main/crafted_volts'
    },
    {
        id: 'utility_pair',
        name: 'Utility Pair',
        num: '25',
        desc: '25 small utilities, which can be combined in pairs',
        class: 'WasmCardWrapper',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Left Utility Secondary Control',
                'knob-small-x': 'Left Utility Primary Control',
                'knob-small-y': 'Right Utility Primary Control'
            },
            'any': {
                'knob-large-computer': 'Utility Selector (multi-pack firmware)',
                'knob-small-x': 'Left Utility Select',
                'knob-small-y': 'Right Utility Select'
            },
            'up': {
                'knob-large-computer': 'Run Selected Pair'
            },
            'down': {
                'knob-large-computer': 'Enter Selector Mode'
            }
        },
        creator: 'Chris Johnson',
        license: 'MIT',
        repository: 'https://github.com/chrisgjohnson/Utility-Pair'
    },
    {
        id: 'clockwork',
        name: 'Clockwork',
        num: '26',
        desc: '6-channel polyrhythmic clock, gate, and LFO/envelope generator inspired by Pamela\'s Workout.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Wave Param Mod',
            'jack-cv2in': 'Probability Mod',
            'jack-pulse1in': 'Clock Sync',
            'jack-pulse2in': 'Reset In',
            'jack-cv1out': 'Out 3 (CV Out 1)',
            'jack-cv2out': 'Out 4 (CV Out 2)',
            'jack-pulse1out': 'Out 5 (Pulse Out 1)',
            'jack-pulse2out': 'Out 6 (Pulse Out 2)'
        },
        layers: {},
        creator: 'Vincent Maurer',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/26_clockwork'
    },
    {
        id: 'siren',
        name: 'Siren',
        num: '27',
        desc: 'Multi-algorithm drone oscillator. Inspired by the Forge TME Vhikk X.',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'up': {
                'knob-large-computer': 'Warp',
                'knob-small-x': 'Span',
                'knob-small-y': 'Morph'
            },
            'middle': {
                'knob-large-computer': 'Seed',
                'knob-small-x': 'Scan',
                'knob-small-y': 'Basis'
            },
            'down': {
                'knob-large-computer': 'Bank Cycle'
            }
        },
        creator: 'Moses Hoyt',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/27_Siren'
    },
    {
        id: 'eighties_bass',
        name: 'Eighties Bass',
        num: '28',
        desc: 'Bass-oriented complete monosynth voice consisting of five detuned saw wave oscillators with mixable white noise and adjustable resonant filter.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Cutoff Modulation',
            'jack-audio1in': 'Detune Modulation',
            'jack-audio2in': 'Noise Mix Modulation',
            'jack-audio1out': 'Audio Left',
            'jack-audio2out': 'Audio Right'
        },
        layers: {
            'up': {
                'knob-large-computer': 'Filter Cutoff',
                'knob-small-x': 'Pitch Offset',
                'knob-small-y': 'Filter Resonance'
            },
            'down': {
                'knob-large-computer': 'Filter Mode Cycle'
            }
        },
        creator: 'Tod Kurt (@todbot)',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/28_eighties_bass'
    },
    {
        id: 'xht',
        name: 'XHT Card',
        num: '29',
        desc: 'A playable deep-note-inspired stereo chord swarm with manual scrubbing, one-shot movement, delay, reverb, CV, pulse, and optional MIDI control.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'External Audio Left',
            'jack-audio2in': 'External Audio Right',
            'jack-cv1in': 'Pitch Transpose',
            'jack-cv2in': 'Position / Destination',
            'jack-pulse1in': 'Gate',
            'jack-pulse2in': 'External Clock',
            'jack-audio1out': 'Left Output',
            'jack-audio2out': 'Right Output',
            'jack-cv1out': 'Position / Pitch',
            'jack-cv2out': 'Position',
            'jack-pulse1out': 'Note Gate',
            'jack-pulse2out': 'Clock Mirror'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Position / Destination',
                'knob-small-x': 'Delay',
                'knob-small-y': 'Reverb'
            }
        },
        creator: 'Adrian Vos',
        license: 'GPL-3.0',
        repository: 'https://github.com/adrianvos/XHT_card'
    },
    {
        id: 'cirpy_wavetable',
        name: 'Cirpy Wavetable',
        num: '30',
        desc: 'Wavetable oscillator that using wavetables from Plaits, Braids, and Microwave,',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Wavetable Position Mod',
            'jack-pulse1out': 'PWM Audio Out A',
            'jack-pulse2out': 'PWM Audio Out B',
            'jack-cv1out': 'Wavetable Position CV',
            'jack-cv2out': 'LFO Modulation CV'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Wavetable Position',
                'knob-small-x': 'LFO Amount',
                'knob-small-y': 'LFO Rate'
            },
            'down': {
                'knob-large-computer': 'Next Wavetable'
            },
            'up': {
                'knob-large-computer': 'Quantize Toggle'
            }
        },
        creator: 'Tod Kurt (@todbot)',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/30_cirpy_wavetable'
    },
    {
        id: 'drumdrum',
        name: 'drumdrum',
        num: '33',
        desc: 'DFAM-style 8-step sequencer',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'up': {
                'knob-large-computer': 'Tempo',
                'knob-small-x': 'Sequence Length',
                'knob-small-y': 'VCO 2 Offset'
            },
            'middle': {
                'knob-large-computer': 'Tempo',
                'knob-small-x': 'Step Pitch',
                'knob-small-y': 'Step Velocity'
            },
            'down': {
                'knob-large-computer': 'Play/Pause Toggle'
            }
        },
        creator: 'Moses Hoyt',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/33_drumdrum'
    },
    {
        id: 'dual_quant',
        name: 'DualQuant',
        num: '34',
        desc: 'Dual quantised granular pitch shifter with calibrated 1V/oct CV outputs',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Pitch Mod A',
            'jack-cv2in': 'Pitch Mod B',
            'jack-cv1out': 'Pitch CV Out A',
            'jack-cv2out': 'Pitch CV Out B'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/34_dual_quant'
    },
    {
        id: 'od',
        name: 'Od',
        num: '38',
        desc: 'Loopable chaotic Lorenz attractor trajectories and zero-crossings as CV and pulses, with sensitivity to initial conditions.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {},
        layers: {},
        creator: 'M. John Mills',
        license: 'MIT',
        repository: 'https://github.com/MJLMills/mtmws_od'
    },
    {
        id: 'blackbird',
        name: 'Blackbird',
        num: '41',
        desc: 'A scriptable, live-codable, USB-serial-to-CV device implementing monome crow\'s protocol',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'input[1]',
            'jack-cv2in': 'input[2]',
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
        },
        layers: {
            'any': {
                'knob-large-computer': 'bb.knob.main',
                'knob-small-x': 'bb.knob.x',
                'knob-small-y': 'bb.knob.y'
            }
        },
        creator: 'Dune Desormeaux',
        license: 'GPLv3 or later',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/41_blackbird'
    },
    {
        id: 'backyard_rain',
        name: 'Backyard Rain',
        num: '42',
        desc: 'Nature soundscape audio. A cozy rain ambience mix for background listening. You control the intensity. This card plays rain ambience which was recorded in my backyard.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {},
        layers: {},
        creator: 'Brian Dorsey',
        license: '',
        repository: 'https://codeberg.org/briandorsey/mtmws_cards'
    },
    {
        id: 'castle_process',
        name: 'Castle Process',
        num: '43',
        desc: 'Fort Processor-inspired harsh noise processor with chopped external audio and a bass pulse voice',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'CV 1',
            'jack-cv2in': 'CV 2',
            'jack-pulse1in': 'Bass Trigger',
            'jack-pulse2in': 'Pulse 2',
            'jack-pulse1out': 'Bass Activity',
            'jack-pulse2out': 'Chop Pulse'
        },
        layers: {},
        creator: 'Adrian Vos',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/43_Castle_Process'
    },
    {
        id: 'birds',
        name: 'Birds',
        num: '44',
        desc: 'Two birds sing to each other controlled by a Turing-style shift register sequencer with clock in and CV/pulse out.',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Lock/Change Amount',
                'knob-small-x': 'Bird Pitch',
                'knob-small-y': 'Playback Time'
            },
            'up': {
                'knob-large-computer': 'Lock/Change Amount (Wild)',
                'knob-small-x': 'Bird Pitch (Wild)',
                'knob-small-y': 'Playback Time (Wild)'
            },
            'down': {
                'knob-large-computer': 'Reseed'
            }
        },
        creator: 'Tom Whitwell',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/44_Birds'
    },
    {
        id: 'two_tracks',
        name: 'Two Tracks',
        num: '48',
        desc: 'Two Tracks — Dual-read-head phase looper. Record a mono loop to flash (IMA-ADPCM) and play it through two independent heads with separately controllable positions and loop lengths for evolving phase patterns and interference textures.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Audio In',
            'jack-audio2in': 'Audio In 2',
            'jack-cv1in': 'CV 1',
            'jack-cv2in': 'CV 2',
            'jack-pulse1in': 'Pulse 1',
            'jack-pulse2in': 'Pulse 2',
            'jack-audio1out': 'Left Out',
            'jack-audio2out': 'Right Out',
            'jack-cv1out': 'CV 1',
            'jack-cv2out': 'CV 2',
            'jack-pulse1out': 'Pulse 1',
            'jack-pulse2out': 'Pulse 2'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Loop window / Right loop length',
                'knob-small-x': 'Left position offset / Right window start',
                'knob-small-y': 'Right position offset / Right speed'
            }
        },
        creator: 'Joep Vermaat',
        license: 'MIT',
        repository: 'https://codeberg.org/johantv/two-tracks'
    },
    {
        id: 'flux',
        name: 'Flux',
        num: '50',
        desc: 'Effects, Synthesizer and Utility',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'up': {
                'knob-large-computer': 'Envelope / Decay',
                'knob-small-x': 'Pitch',
                'knob-small-y': 'Timbre / Color'
            },
            'middle': {
                'knob-large-computer': 'Wet/Dry Mix',
                'knob-small-x': 'Effect Parameter 1',
                'knob-small-y': 'Effect Parameter 2'
            },
            'down': {
                'knob-large-computer': 'Internal Tempo',
                'knob-small-x': 'Performance Parameter 1',
                'knob-small-y': 'Performance Parameter 2'
            }
        },
        creator: 'Vincent Maurer',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/50_flux'
    },
    {
        id: 'grains',
        name: 'Grains',
        num: '51',
        desc: 'Granular Sampler and Effect',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {},
        creator: 'Vincent Maurer',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/51_grains'
    },
    {
        id: 'lens',
        name: 'Lens',
        num: '52',
        desc: 'A programmable synth. Write patches in Loupe (a tiny Lisp); sequences of values read through lenses become pitch, rhythm, CV and audio.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {},
        layers: {},
        creator: 'Graham Ritchie',
        license: '',
        repository: 'https://github.com/vincentltm/Workshop_Computer_VCV/tree/main/deps/external/52_lens'
    },
    {
        id: 'glitter',
        name: 'Glitter',
        num: '53',
        desc: 'Granular Looping Sampler',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Audio Input Left',
            'jack-audio2in': 'Audio Input Right',
            'jack-cv1in': 'Grain Repeat Chance CV',
            'jack-cv2in': 'Grain Sleep Chance CV',
            'jack-pulse1in': 'Clock Input',
            'jack-audio1out': 'Audio Out Left',
            'jack-audio2out': 'Audio Out Right'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Loop vs Grains Blend',
                'knob-small-y': 'Max Grain Size'
            },
            'middle': {
                'knob-small-x': 'Repitch Chance'
            },
            'up_or_down_record': {
                'knob-small-x': 'Punch Record'
            }
        },
        creator: 'Steve Jones',
        license: 'MIT',
        repository: 'https://github.com/sdrjones/mtws/tree/main/53_glitter'
    },
    {
        id: 'tapegrade',
        name: 'Tapegrade',
        num: '54',
        desc: 'Mono-input stereo cassette warble processor with wow, flutter, hiss, crackle, and tape wear morphing.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Tape Depth Mod',
            'jack-cv2in': 'Instability Mod',
            'jack-pulse1in': 'Damage Burst Trig',
            'jack-pulse2in': 'Crackle Gate',
            'jack-cv1out': 'CV1 Attenuated',
            'jack-cv2out': 'CV2 Attenuated'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/54_Tapegrade'
    },
    {
        id: 'fifths',
        name: 'Fifths',
        num: '55',
        desc: 'A quantizer/sequencer that can create harmony and nimbly traverse the circle of fifths in attempts to make jazz',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'CV/Audio Source',
            'jack-audio2in': 'VCA CV',
            'jack-cv1in': 'Transpose CV',
            'jack-cv2in': 'Key CV',
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Loop Toggle',
            'jack-audio1out': 'Key Monitor Output',
            'jack-audio2out': 'VCA Output',
            'jack-cv1out': 'Quantized Note',
            'jack-cv2out': 'Third Harmony',
            'jack-pulse1out': 'Internal Clock Pulse',
            'jack-pulse2out': 'Sequence Pulse'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Key Center',
                'knob-small-x': 'Loop Length',
                'knob-small-y': 'VCA Att'
            },
            'down': {
                'knob-small-x': 'Pulse Duration',
                'knob-small-y': 'Pulse Probability Threshold'
            }
        },
        creator: 'Dune Desormeaux',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/55_fifths'
    },
    {
        id: 'glitch',
        name: 'Glitch',
        num: '57',
        desc: 'Clock-synced beat-repeater with ratcheting, reversal and audio degradation',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {},
        creator: 'Andy Jenkinson (uglifruit)',
        license: 'MIT',
        repository: 'https://github.com/uglifruit/Workshop_Computer/tree/main/Demonstrations%2BHelloWorlds/PicoSDK/ComputerCard/examples/glitch'
    },
    {
        id: 'lochovibes',
        name: 'LoCho Vibes',
        num: '58',
        desc: 'Stereo chorus and vibrato effect featuring triangle, sine, and slow drift LFO modes, modulation-based delay movement, and tape-style saturation.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Depth Mod',
            'jack-cv2in': 'Character Mod',
            'jack-pulse1in': 'Ext LFO Clock',
            'jack-cv1out': 'LFO CV',
            'jack-cv2out': 'Inverted LFO CV'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/58_LoChoVibes'
    },
    {
        id: 'bitphase',
        name: 'BitPhase',
        num: '59',
        desc: 'Resonant 4-stage phaser with wide modulation sweeps, tremolo blending, and Burst-mode degradation',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Rate CV',
            'jack-cv2in': 'Resonance CV',
            'jack-pulse1in': 'LFO Reset',
            'jack-audio1out': 'Processed Output A',
            'jack-audio2out': 'Processed Output B',
            'jack-cv1out': 'Phaser LFO CV',
            'jack-cv2out': 'Tremolo LFO CV',
            'jack-pulse1out': 'Burst Active',
            'jack-pulse2out': 'Phaser LFO Phase'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/59_BitPhase'
    },
    {
        id: 'markov',
        name: 'Markov',
        num: '60',
        desc: 'Dual generative Markov chain module — evolving melody (MarkoV) left side, rhythmic percussion patterns (MarkovPerc) right side, with internal synth voice',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Loop Lock Length / Mutation',
                'knob-small-x': 'Melody Profile',
                'knob-small-y': 'Percussion Profile'
            },
            'up': {
                'knob-large-computer': 'Base Transpose',
                'knob-small-x': 'Melody Profile',
                'knob-small-y': 'Percussion Profile'
            },
            'down': {
                'knob-large-computer': 'Scale Select',
                'knob-small-x': 'Melody Profile',
                'knob-small-y': 'Percussion Profile'
            }
        },
        creator: 'Andy Jenkinson (uglifruit)',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/60_markov'
    },
    {
        id: 'voices_of_sid',
        name: 'Voices of SID',
        num: '64',
        desc: 'Dual MOS 6581 SID emulation (reSID engine) with CV/gate control, stereo output, waveform selection, and randomize',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Voice 1 Pitch CV',
            'jack-cv2in': 'Voice 2 Pitch CV',
            'jack-pulse1in': 'Voice 1 Gate',
            'jack-pulse2in': 'Voice 2 Gate',
            'jack-audio1out': 'SID 1 Output',
            'jack-audio2out': 'SID 2 Output',
            'jack-cv1out': 'CV 1 Passthrough',
            'jack-cv2out': 'CV 2 Passthrough',
            'jack-pulse1out': 'Gate 1 Passthrough',
            'jack-pulse2out': 'Gate 2 Passthrough'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Decay/Release',
                'knob-small-x': 'Filter Resonance',
                'knob-small-y': 'Pulse Width'
            },
            'up': {
                'knob-large-computer': 'Decay/Release',
                'knob-small-x': 'Voice 1 Waveform',
                'knob-small-y': 'Voice 2 Waveform'
            },
            'down': {
                'knob-large-computer': 'Randomize'
            }
        },
        creator: 'Joep Vermaat',
        license: 'MIT',
        repository: 'https://codeberg.org/johantv/voices-of-sid'
    },
    {
        id: 'stretchcore',
        name: 'Stretchcore',
        num: '66',
        desc: 'A card for playing and manipulating samples with tempo control, timestretch with browser-based audio loading (infinitedigits.com/stretchcore/)',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Position / Sample Target',
                'knob-small-x': 'Internal Tempo',
                'knob-small-y': 'Timestretch Amount'
            },
            'down': {
                'knob-large-computer': 'Jump To Main Position'
            },
            'up': {
                'knob-large-computer': 'Select Sample By Main Position'
            }
        },
        creator: 'Infinite Digits',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/66_stretchcore'
    },
    {
        id: 'fragments',
        name: 'Fragments',
        num: '67',
        desc: 'Six-slot audio recorder and clocked fragment sequencer with browser librarian, MIDI pitch control, random CV outputs, and an alternate long-sample variation mode.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {},
        layers: {},
        creator: 'Max Harnishfeger',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/67_Fragments'
    },
    {
        id: 'degenerator',
        name: 'Degenerator',
        num: '71',
        desc: 'Degenerator — Disintegrating Looper. Capture audio loops and apply irreversible degradation with 6 algorithms (Saturation, Filter Drift, Tape Hiss, Oxide Shedding, Bit Crush, Bit Rot) via preview/apply workflow. Inspired by William Basinski\'s The Disintegration Loops.',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Mix Amount',
                'knob-small-x': 'Harmonic Effect Select',
                'knob-small-y': 'Destructive Effect Select'
            },
            'up': {
                'knob-large-computer': 'Degrade Commit Rate',
                'knob-small-x': 'Harmonic Degrade Effect',
                'knob-small-y': 'Destructive Degrade Effect'
            },
            'down': {
                'knob-large-computer': 'Boot Mode Select'
            }
        },
        creator: 'Joep Vermaat',
        license: 'MIT',
        repository: 'https://codeberg.org/johantv/Degenerator'
    },
    {
        id: 'motorik',
        name: 'Motorik',
        num: '72',
        desc: 'Motorik drum machine — kick/snare/hihat with bass and melody CV, classic Krautrock grooves',
        class: 'WasmCardWrapper',
        category: 'Utility',
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
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Pattern Energy',
                'knob-small-x': 'Bass Root Transpose',
                'knob-small-y': 'Fill Probability'
            },
            'down': {
                'knob-large-computer': 'Spectral Tilt',
                'knob-small-x': 'Bass Root Pattern Shift',
                'knob-small-y': 'Bass Mirror Pattern Shift'
            },
            'up': {
                'knob-large-computer': 'Texture / Decimation',
                'knob-small-x': 'Pattern Variation',
                'knob-small-y': 'Humanize Range'
            }
        },
        creator: 'Joep Vermaat',
        license: 'MIT',
        repository: 'https://codeberg.org/johantv/motorik'
    },
    {
        id: 'wild_pebble',
        name: 'Wild Pebble',
        num: '74',
        desc: 'MIDI-clockable generative rhythm and melody organism inspired by Pet Rock',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-pulse1in': 'Ext Clock',
            'jack-pulse2in': 'Freeze Gate',
            'jack-cv1in': 'Density Mod',
            'jack-cv2in': 'Mutation Mod',
            'jack-pulse1out': 'Primary Trig Stream',
            'jack-pulse2out': 'Companion Trig Stream',
            'jack-cv1out': 'Quant Melody CV',
            'jack-cv2out': 'Energy / Tension CV'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/74_Wild_Pebble'
    },
    {
        id: 'turing_clouds',
        name: 'Turing Clouds',
        num: '75',
        desc: 'Turing Machine-driven granular texture generator and rhythmic delay for the Workshop Computer',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {},
        layers: {},
        creator: 'Ainews',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/75_Turing_Clouds'
    },
    {
        id: 'hot_fuzz',
        name: 'Hot Fuzz',
        num: '76',
        desc: 'A stereo fuzz/distortion + resonant wah effects processor with manual and auto-wah modes, built on fixed-point DSP.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Left Audio In',
            'jack-audio2in': 'Right Audio In',
            'jack-cv1in': 'Wah CV (optional)',
            'jack-cv2in': 'Drive CV (optional)',
            'jack-pulse1in': 'Fuzz Toggle',
            'jack-pulse2in': 'Auto-Wah Toggle',
            'jack-audio1out': 'Left Audio Out',
            'jack-audio2out': 'Right Audio Out'
        },
        layers: {
            'up': {
                'knob-large-computer': 'Fuzz Type',
                'knob-small-x': 'Fuzz Drive',
                'knob-small-y': 'Wah Q / Resonance'
            },
            'middle': {
                'knob-large-computer': 'Fuzz Blend',
                'knob-small-x': 'Fuzz Drive',
                'knob-small-y': 'Wah Q / Resonance'
            },
            'down': {
                'knob-large-computer': 'Wah Frequency / Auto-Wah Base',
                'knob-small-x': 'Dry / Wet Blend',
                'knob-small-y': 'Wah Q / Resonance'
            }
        },
        creator: 'Joep Vermaat',
        license: 'MIT',
        repository: 'https://codeberg.org/johantv/hot-fuzz'
    },
    {
        id: 'talker',
        name: 'Talker',
        num: '78',
        desc: 'Proof of concept speech synthesizer, based on TalkiePCM, inspired by 1970s LPC speech synths.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Exciter Audio Replace',
            'jack-cv1in': 'Pitch CV',
            'jack-cv2in': 'Speed CV',
            'jack-audio1out': 'Speech Output',
            'jack-audio2out': 'LPC Exciter Components',
            'jack-cv1out': 'Exciter Amplitude',
            'jack-cv2out': 'Exciter Pitch'
        },
        layers: {
            'up': {
                'knob-large-computer': 'Pitch',
                'knob-small-x': 'Pitch CV Attenuverter',
                'knob-small-y': 'Babble Speed'
            },
            'middle': {
                'knob-large-computer': 'Off'
            },
            'down': {
                'knob-large-computer': 'Single Word Trigger'
            }
        },
        creator: 'Chris Johnson',
        license: 'GPL-3.0',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/78_Talker'
    },
    {
        id: 'computer_grids',
        name: 'Computer Grids',
        num: '82',
        desc: 'Grids-inspired trigger sequencer with Web MIDI SysEx configuration.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Pattern Reset',
            'jack-cv1in': 'Map Modulation',
            'jack-cv2in': 'Fill Modulation',
            'jack-pulse1out': 'Trigger Lane 1',
            'jack-pulse2out': 'Trigger Lane 2',
            'jack-cv1out': 'Trigger Lane 3',
            'jack-cv2out': 'Aux Output'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Chaos',
                'knob-small-x': 'Internal BPM',
                'knob-small-y': 'Swing'
            },
            'up': {
                'knob-large-computer': 'Lane 1 Density',
                'knob-small-x': 'Lane 2 Density',
                'knob-small-y': 'Lane 3 Density'
            },
            'down': {
                'knob-large-computer': 'Alt Layer Toggle'
            }
        },
        creator: 'Phil Miller',
        license: 'GPL-3.0-or-later',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/82_Computer_Grids'
    },
    {
        id: 'cosmik_c1zzl3',
        name: 'Cosmik C1ZZL3',
        num: '84',
        desc: 'Stable phase-distortion synthesiser and Turing machine firmware with Web MIDI envelope readback, PD, detune, eight waveform families, hosted CZ patch import, USB MIDI device/host operation, and optional Turing MIDI output.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Phase Distortion',
            'jack-cv2in': 'Wave Control CV',
            'jack-pulse1in': 'Ext Turing Clock',
            'jack-pulse2in': 'Envelope Trig',
            'jack-cv1out': 'Stepped Turing CV',
            'jack-cv2out': 'Smoothed Turing CV',
            'jack-pulse1out': 'Main Turing Pulse',
            'jack-pulse2out': 'Alternate Turing Pulse'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/84_CosmikC1zzl3'
    },
    {
        id: 'tesserae',
        name: 'Tesserae',
        num: '86',
        desc: 'Tesserae — Variable-voice (2-8) arpeggiated chord generator with 5 patterns, 10 scales, tap tempo, CV/audio transpose inputs, and dual CV + audio pitch outputs. Inspired by Laurie Spiegel\'s Music Mouse and Patchwork.',
        class: 'WasmCardWrapper',
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
        },
        layers: {
            'up': {
                'knob-large-computer': 'Arpeggio Pattern',
                'knob-small-x': 'Melody Position',
                'knob-small-y': 'Chord Spacing'
            },
            'middle': {
                'knob-large-computer': 'Root Note',
                'knob-small-x': 'Melody Position',
                'knob-small-y': 'Chord Spacing'
            },
            'down': {
                'knob-large-computer': 'Scale Select',
                'knob-small-y': 'Voice Count'
            }
        },
        creator: 'Joep Vermaat',
        license: 'MIT',
        repository: 'https://codeberg.org/johantv/Tesserae'
    },
    {
        id: 'fr330hfr33',
        name: 'Fr330hfr33',
        num: '87',
        desc: 'Performance-focused acid voice with diode filtering, distortion, MIDI, and a persistent sequencer',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Pitch CV',
            'jack-pulse1in': 'Gate In',
            'jack-pulse2in': 'Clock / Slide',
            'jack-cv1out': 'Pitch Out',
            'jack-pulse1out': 'Gate Out'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/87_fr330hfr33'
    },
    {
        id: 'pantograph',
        name: 'Pantograph',
        num: '90',
        desc: 'Trace and record CV — record knob movements, loop them at bipolar speed',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'X Mod',
            'jack-cv2in': 'Y Mod',
            'jack-pulse1in': 'Trigger',
            'jack-pulse2in': '(unused)',
            'jack-audio1in': '(unused)',
            'jack-audio2in': '(unused)',
            'jack-cv1out': 'Trace X CV',
            'jack-cv2out': 'Trace Y CV',
            'jack-pulse1out': 'End of cycle',
            'jack-pulse2out': 'Contour Gate',
            'jack-audio1out': '(unused)',
            'jack-audio2out': '(unused)'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Speed',
                'knob-small-x': 'Trace X',
                'knob-small-y': 'Trace Y'
            }
        },
        creator: 'Kenny Shen',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/90_Pantograph'
    },
    {
        id: 'chorgan',
        name: 'Chorgan',
        num: '91',
        desc: 'Chorgan — 6-voice chord synthesizer with morphing timbre, chord extension presets, and built-in chord sequencer. Two modes: normal (detune/chorus) and slew (portamento chord changes). Inspired by the Music Thing Modular Chord Organ.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-cv1in': 'Root Pitch CV',
            'jack-cv2in': 'Timbre Offset CV',
            'jack-audio1in': 'Slew Speed CV',
            'jack-audio2in': 'Chord Inversion CV',
            'jack-pulse1in': 'Preset Advance',
            'jack-pulse2in': 'Chord Recall Clock',
            'jack-audio1out': 'Six-Voice Mix',
            'jack-audio2out': 'Phase-Offset Mix',
            'jack-pulse1out': 'Sub-Octave Square',
            'jack-pulse2out': 'Chord Event PWM',
            'jack-cv1out': 'Voiced Pitch CV',
            'jack-cv2out': 'Chord Event Ramp'
        },
        layers: {
            'middle': {
                'knob-large-computer': 'Timbre',
                'knob-small-x': 'Root Pitch',
                'knob-small-y': 'Interval'
            },
            'up': {
                'knob-large-computer': 'Timbre',
                'knob-small-x': 'Root Pitch',
                'knob-small-y': 'Preset Cycle / Store'
            }
        },
        creator: 'Andy Jenkinson (uglifruit)',
        license: '',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/91_chorgan'
    },
    {
        id: 'turing_matrix',
        name: 'Turing Matrix',
        num: '93',
        desc: 'Turing Machine sequencer with a switchable mixer layer inspired by the Music Thing Modular Turing Machine and Vactrol Mix combination',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-pulse1in': 'Ext Clock 1',
            'jack-pulse2in': 'Ext Clock 2',
            'jack-cv1in': 'CV Input 1',
            'jack-cv2in': 'CV Input 2',
            'jack-pulse1out': 'Chan 1 Pulse',
            'jack-pulse2out': 'Chan 2 Pulse',
            'jack-cv1out': 'Chan 1 Quant CV',
            'jack-cv2out': 'Chan 2 Quant CV'
        },
        layers: {},
        creator: 'Music Thing Modular',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/93_Turing_Matrix'
    },
    {
        id: 'offair2',
        name: 'OffAir',
        num: '95',
        desc: 'OffAir — AM/Shortwave/Longwave radio simulator. Tune between two Stations and interference with authentic heterodyne whistles, SSB pitch-shift detuning, AM envelope detection, swelling per-band static, and triggerable Insta-ference one-shots. Baked recordings or live audio inputs become the Stations.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Station 1 In',
            'jack-audio2in': 'Station 2 In',
            'jack-cv1in': 'Tuner',
            'jack-cv2in': 'Noise',
            'jack-pulse1in': 'Shuffle Signals',
            'jack-pulse2in': 'Insta-ference',
            'jack-cv1out': 'Signal Strength',
            'jack-cv2out': 'Station 1 CV Offset',
            'jack-audio1out': 'Output',
            'jack-audio2out': 'Just Noise',
            'jack-pulse1out': 'Station 1 Tuned Gate',
            'jack-pulse2out': 'Station 2 Tuned Gate'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Tuning',
                'knob-small-x': 'Brightness',
                'knob-small-y': 'Noise Level'
            },
            'down': {
                'knob-large-computer': 'Cycle Band'
            },
            'up': {
                'knob-large-computer': 'Dead-air / Morse'
            }
        },
        creator: 'Andy Jenkinson (uglifruit)',
        license: 'CC BY-SA 4.0',
        repository: 'https://github.com/uglifruit/Workshop_Computer'
    },
    {
        id: 'alloy',
        name: 'Alloy',
        num: '97',
        desc: 'Fixed-point 15-zone cross-modulator with a clocked Turing CV and gate companion.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Carrier',
            'jack-audio2in': 'Modulator',
            'jack-cv1in': 'Algorithm CV',
            'jack-cv2in': 'Timbre CV',
            'jack-pulse1in': 'Clock',
            'jack-pulse2in': 'Reset',
            'jack-audio1out': 'Main',
            'jack-audio2out': 'Aux / Right',
            'jack-cv1out': 'Turing Pitch',
            'jack-cv2out': 'Turing CV',
            'jack-pulse1out': 'Turing Gate A',
            'jack-pulse2out': 'Turing Gate B'
        },
        layers: {},
        creator: 'Eric Gao',
        license: 'MIT',
        repository: 'https://github.com/Ericxgao/Workshop_Computer/tree/eric/warps-port/releases/97_alloy'
    },
    {
        id: 'acid',
        name: 'Acid',
        num: '303',
        desc: 'A 303-style step sequencer',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1in': 'Pitch Phase Offset',
            'jack-audio2in': 'Step-type Phase Offset',
            'jack-cv1in': 'Transpose',
            'jack-cv2in': 'Portamento Time',
            'jack-pulse1in': 'External Clock',
            'jack-pulse2in': 'Reset',
            'jack-audio1out': 'Sawtooth Voice',
            'jack-audio2out': 'Gate',
            'jack-cv1out': 'Pitch',
            'jack-cv2out': 'Accent CV',
            'jack-pulse1out': 'Clock',
            'jack-pulse2out': 'Accent Trigger'
        },
        layers: {
            'up': {
                'knob-large-computer': 'Length',
                'knob-small-x': 'Swing',
                'knob-small-y': 'Tempo'
            },
            'middle': {
                'knob-large-computer': 'Note',
                'knob-small-x': 'Octave',
                'knob-small-y': 'Step Mode'
            },
            'down': {
                'knob-large-computer': 'Reset Mode',
                'knob-small-x': 'Randomise Pitch',
                'knob-small-y': 'Randomise Step Type'
            }
        },
        creator: 'Samuel Smith',
        license: 'MIT',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/303_acid'
    },
    {
        id: 'sense_of_space',
        name: '433 Sense of Space',
        num: '433',
        desc: 'Whimsical 4\'33\"-inspired ambience looper with a three-loop transport, LED countdown, restlessness fidgets, Pulse In restart, and chair creak one-shot.',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {
            'jack-audio1out': 'Left',
            'jack-audio2out': 'Right'
        },
        layers: {
            'any': {
                'knob-large-computer': 'Restlessness',
                'knob-small-x': 'Space',
                'knob-small-y': 'Amount'
            },
            'down': {
                'knob-large-computer': 'Seat Creak'
            },
            'up': {
                'knob-large-computer': 'Stop / Arm'
            },
            'middle': {
                'knob-large-computer': 'Start'
            }
        },
        creator: 'Music Thing Modular / AI-assisted',
        license: 'Mixed - source code/reverb components follow their original project licences; embedded BBC Sound Effects audio is subject to BBC Sound Effects Archive licensing',
        repository: 'https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/433_sense_of_space'
    },
];

if (typeof window !== 'undefined') {
    window.CARD_LIBRARY = CARD_LIBRARY;
}
