(function() {
    console.log("[Editor Bridge] Initializing WebMIDI and WebSerial intercepts...");

    // ────────────────────────────────────────────────────────────────────────
    // 1. WebMIDI Mocking
    // ────────────────────────────────────────────────────────────────────────
    class MockMIDIInput extends EventTarget {
        constructor(id, name) {
            super();
            this.id = id;
            this.name = name;
            this.type = 'input';
            this.connection = 'open';
            this.state = 'connected';
            this._onmidimessage = null;
        }

        get onmidimessage() {
            return this._onmidimessage;
        }

        set onmidimessage(fn) {
            this._onmidimessage = fn;
        }

        // Support addEventListener / EventTarget properly
        addEventListener(type, listener, options) {
            super.addEventListener(type, listener, options);
        }
    }

    class MockMIDIOutput {
        constructor(id, name) {
            this.id = id;
            this.name = name;
            this.type = 'output';
            this.connection = 'open';
            this.state = 'connected';
        }

        send(data, timestamp) {
            // Forward outbound MIDI bytes directly to the parent page (WasmCardWrapper)
            window.parent.postMessage({
                type: 'midi_to_card',
                data: Array.from(data)
            }, '*');
        }
    }

    class MockMIDIAccess extends EventTarget {
        constructor() {
            super();
            this.inputs = new Map();
            this.outputs = new Map();
            this.sysexEnabled = true;

            const virtualInput = new MockMIDIInput('virtual-card-input', 'MTMComputer (Flux, DrumDrum, Twists, MLRws, Blackbird, Clockwork MIDI) Input');
            const virtualOutput = new MockMIDIOutput('virtual-card-output', 'MTMComputer (Flux, DrumDrum, Twists, MLRws, Blackbird, Clockwork MIDI) Output');

            this.inputs.set(virtualInput.id, virtualInput);
            this.outputs.set(virtualOutput.id, virtualOutput);
        }
    }

    const mockMidiAccess = new MockMIDIAccess();

    // Override requestMIDIAccess
    navigator.requestMIDIAccess = function(options) {
        console.log("[Editor Bridge] Intercepted requestMIDIAccess", options);
        return Promise.resolve(mockMidiAccess);
    };

    // ────────────────────────────────────────────────────────────────────────
    // 2. WebSerial Mocking
    // ────────────────────────────────────────────────────────────────────────
    class MockSerialPort {
        constructor() {
            this.readableController = null;
            this.readable = new ReadableStream({
                start: (controller) => {
                    this.readableController = controller;
                }
            });
            this.writable = new WritableStream({
                write: (chunk) => {
                    // Forward outbound serial bytes to WasmCardWrapper
                    window.parent.postMessage({
                        type: 'serial_to_card',
                        data: Array.from(chunk)
                    }, '*');
                }
            });
        }

        getInfo() {
            return { usbVendorId: 0x2e8a, usbProductId: 0x000a };
        }

        open(options) {
            console.log("[Editor Bridge] Intercepted SerialPort.open", options);
            return Promise.resolve();
        }

        close() {
            console.log("[Editor Bridge] Intercepted SerialPort.close");
            return Promise.resolve();
        }
    }

    const mockSerialPort = new MockSerialPort();
    const mockSerial = {
        getPorts: () => {
            console.log("[Editor Bridge] Intercepted serial.getPorts");
            return Promise.resolve([mockSerialPort]);
        },
        requestPort: (options) => {
            console.log("[Editor Bridge] Intercepted serial.requestPort", options);
            return Promise.resolve(mockSerialPort);
        },
        addEventListener: (type, fn) => {
            console.log("[Editor Bridge] Intercepted serial.addEventListener", type);
        },
        removeEventListener: (type, fn) => {}
    };

    Object.defineProperty(navigator, 'serial', {
        value: mockSerial,
        configurable: true,
        writable: true
    });

    // ────────────────────────────────────────────────────────────────────────
    // 3. Parent Message Routing (receiving from parent WasmCardWrapper)
    // ────────────────────────────────────────────────────────────────────────
    window.addEventListener('message', (e) => {
        if (!e.data) return;

        if (e.data.type === 'midi_from_card') {
            const input = mockMidiAccess.inputs.get('virtual-card-input');
            if (input) {
                // Trigger both onmidimessage handler and addEventListener listeners
                const event = new MessageEvent('midimessage', {
                    data: new Uint8Array(e.data.data)
                });
                
                if (typeof input.onmidimessage === 'function') {
                    input.onmidimessage(event);
                }
                input.dispatchEvent(event);
            }
        } else if (e.data.type === 'serial_from_card') {
            if (mockSerialPort.readableController) {
                mockSerialPort.readableController.enqueue(new Uint8Array(e.data.data));
            }
        }
    });
    // ────────────────────────────────────────────────────────────────────────
    // 4. Picoboot Mocking (for virtual flashing of samples/presets)
    // ────────────────────────────────────────────────────────────────────────
    try {
        import("./lib/picoflash/index.js").then((m) => {
            console.log("[Editor Bridge] Mocking Picoboot flashing library...");
            m.Picoboot.requestDevice = function() {
                const mockPicobootInstance = {
                    connect() { return Promise.resolve(); },
                    disconnect() { return Promise.resolve(); },
                    isConnected() { return true; },
                    reboot(delay) {
                        console.log("[Editor Bridge] Mock reboot requested");
                        return Promise.resolve();
                    },
                    flashEraseAndWrite(address, data, progressCallback) {
                        console.log("[Editor Bridge] Mock Picoboot flashing address:", address, data.byteLength);
                        
                        let offset = address;
                        if (offset >= 0x10000000) {
                            offset -= 0x10000000;
                        }

                        window.parent.postMessage({
                            type: 'write_flash_bytes',
                            offset: offset,
                            bytes: Array.from(new Uint8Array(data))
                        }, '*');
                        
                        return new Promise((resolve) => {
                            let pct = 0;
                            const interval = setInterval(() => {
                                pct += 10;
                                if (progressCallback) {
                                    progressCallback(pct, `Flashing simulated memory... (${pct}%)`);
                                }
                                if (pct >= 100) {
                                    clearInterval(interval);
                                    resolve();
                                }
                            }, 50);
                        });
                    }
                };
                return Promise.resolve(mockPicobootInstance);
            };
        }).catch(err => {
            // It's fine if the card doesn't have Picoboot
        });
    } catch (e) {
        // Safe catch for browsers that don't support dynamic import in this context
    }

    console.log("[Editor Bridge] API overrides successfully injected!");
})();

