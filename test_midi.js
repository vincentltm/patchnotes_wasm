
// Mock AudioContext and Nodes
global.AudioContext = class {
    createAnalyser() {
        return {
            fftSize: 32,
            getFloatTimeDomainData: (arr) => {
                // Simulate a High Gate signal
                arr[0] = 1.0;
            },
            connect: () => { },
            disconnect: () => { }
        };
    }
    createGain() {
        return { connect: () => { }, disconnect: () => { } };
    }
};

// Mock global functions
global.sendMidiNoteOn = (note, vel) => {
    console.log(`[TEST] sendMidiNoteOn called: Note ${note}, Vel ${vel}`);
};
global.sendMidiNoteOff = (note) => {
    console.log(`[TEST] sendMidiNoteOff called: Note ${note}`);
};
global.audioNodes = {
    'Midi_Pitch': { connect: () => { }, disconnect: () => { } },
    'Midi_Gate': { connect: () => { }, disconnect: () => { } },
    'Midi_Velocity': { connect: () => { }, disconnect: () => { } },
    'Midi_Clock': { connect: () => { }, disconnect: () => { } }
};

// Load the CardMIDI class
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, 'js', 'cards', 'CardMIDI.js'), 'utf8');
// Extract the class definition manually since it's not a module
const classDef = content.match(/class CardMIDI extends ComputerCard {[\s\S]*?}/)[0];
// Mock ComputerCard base class
class ComputerCard { constructor(ctx, io) { this.ctx = ctx; this.io = io || {}; } }

// Eval the class
eval(classDef);


// Test
const ctx = new AudioContext();
const io = {
    pulse1Out: { connect: () => { }, disconnect: () => { } },
    pulse1In: { connect: () => { }, disconnect: () => { } },
    cv1In: { connect: () => { }, disconnect: () => { } },
    inputL: { connect: () => { }, disconnect: () => { } },
    outputL: { connect: () => { }, disconnect: () => { } },
    outputR: { connect: () => { }, disconnect: () => { } }
};

const card = new CardMIDI(ctx, io);
card.mount();

console.log("--- TEST START ---");
// Run update to trigger logic
card.update({}, 0);

console.log("--- TEST END ---");
