// Mapping from JS Card ID → WASM Card Index (0-based, matches g_card_functions[] in WasmCardBridge.cpp)
// DO NOT edit manually — regenerate by running tools/wasm_build_prep.py
const WASM_CARD_MAP = {
    'midi':              0,  // simple_midi
    'turing_machine':    1,
    'byo_benjolin':      2,
    'usb_audio':         3,  // usb_audio_bridge
    'bumpers':           4,
    'goldfish':          5,
    'noisebox':          6,
    'cvmod':             7,
    'mlrws':             8,
    'ca_sequencer':      9,
    'reverb':            10,
    'resonator':         11,
    'sheep':             12,
    'crafted_volts':     13,
    'utility_pair':      14,
    'clockwork':         15,
    'siren':             16,
    'eighties_bass':     17,
    'xht':               18,
    'cirpy_wavetable':   19,
    'drumdrum':          20,
    'dual_quant':        21,
    'od':                22,
    'blackbird':         23,
    'backyard_rain':     24,
    'castle_process':    25,
    'birds':             26,
    'two_tracks':        27,
    'flux':              28,
    'grains':            29,
    'lens':              30,
    'glitter':           31,
    'tapegrade':         32,
    'fifths':            33,
    'glitch':            34,
    'lochovibes':        35,
    'bitphase':          36,
    'markov':            37,
    'voices_of_sid':     38,
    'stretchcore':       39,
    'fragments':         40,
    'degenerator':       41,
    'motorik':           42,
    'wild_pebble':       43,
    'turing_clouds':     44,
    'hot_fuzz':          45,
    'talker':            46,
    'computer_grids':    47,
    'cosmik_c1zzl3':     48,
    'tesserae':          49,
    'fr330hfr33':        50,
    'pantograph':        51,
    'chorgan':           52,
    'turing_matrix':     53,
    'offair2':           54,
    'alloy':             55,
    'acid':              56,
    'sense_of_space':    57,
};

class WasmCardWrapper extends ComputerCard {
    constructor(ctx, io) {
        super(ctx, io);
        this.utilityIndexL = 0;
        this.utilityIndexR = 0;
        this.uiElements = null;
        this.resizeHandler = null;
        this.editorBtn = null;
        this.editorModal = null;
        this.editorIframe = null;
        this.lastSwitchVal = null;
    }

    mount() {
        super.mount();
        
        // Find our card definition from activeComputerCard targetCardId or UI label
        const cardId = window.activeComputerCardId;
        this.cardId = cardId;
        const cardIdx = WASM_CARD_MAP[cardId] ?? null; // null = no card loaded
        
        console.log(`[WasmCardWrapper] Mounting card ID: ${cardId} (WASM Index: ${cardIdx})`);
        
        if (cardId === 'utility_pair') {
            this.createSelectionUI();
            this.updateLabels();
            this.writeUtilityIndicesToWasm();
        } else {
            // Initialize dynamic labels based on current physical switch state
            const switchVal = (typeof componentStates !== 'undefined' && componentStates['switch-3way-computer']) ? componentStates['switch-3way-computer'].value : 1;
            const mappedSwitch = 2 - switchVal;
            this.lastSwitchVal = mappedSwitch;
            this.updateWasmCardLabels(mappedSwitch);
        }

        // Retrieve saved flash sectors from localStorage
        const savedFlashStr = localStorage.getItem('mtm_flash_sectors_' + cardId);
        let flashSectors = null;
        if (savedFlashStr) {
            try {
                flashSectors = JSON.parse(savedFlashStr);
                console.log(`[WasmCardWrapper] Loaded saved flash sectors for ${cardId}`);
            } catch (err) {
                console.error(`[WasmCardWrapper] Error parsing saved flash sectors for ${cardId}:`, err);
            }
        }

        if (audioNodes['WasmComputerNode'] && cardIdx !== null) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'load_card',
                cardIndex: cardIdx,
                flashSectors: flashSectors
            });

            // Immediately send current knob/switch state so the card's startup
            // lock_knobs() snapshot captures actual positions, not default zeros.
            // Without this, the KnobLock references 0 but the UI knob is non-zero,
            // causing the lock to immediately release and trigger spurious parameter changes.
            const getNormMount = (id) => {
                const s = componentStates?.[id];
                const val = s ? parseFloat(s.value) : 0;
                let min = s?.range?.[0] ?? (id.includes('knob-small') ? -135 : -150);
                let max = s?.range?.[1] ?? (id.includes('knob-small') ? 135 : 150);
                return (val - min) / (max - min);
            };
            const initSwitchVal = componentStates?.['switch-3way-computer']?.value ?? 1;
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'controls',
                knobMain: getNormMount('knob-large-computer'),
                knobX: getNormMount('knob-small-x'),
                knobY: getNormMount('knob-small-y'),
                switchZ: 2 - initSwitchVal  // UI 0=Up,1=Mid,2=Down → C++ 2=Up,1=Mid,0=Down
            });
        } else if (cardIdx === null) {
            console.warn(`[WasmCardWrapper] Mounting metadata-only card (no WASM binary): ${cardId}`);
            if (audioNodes['WasmComputerNode']) {
                audioNodes['WasmComputerNode'].port.postMessage({
                    type: 'load_card',
                    cardIndex: -1
                });
            }
        }

        
        // Setup LED message handler if not already done, or listen to messages from WasmComputerNode
        if (audioNodes['WasmComputerNode']) {
            audioNodes['WasmComputerNode'].port.onmessage = (e) => {
                if (e.data.type === 'leds') {
                    this.updateLEDs(e.data.leds);
                } else if (e.data.type === 'midi_from_card') {
                    this.handleMidiFromCard(e.data.data);
                } else if (e.data.type === 'serial_from_card') {
                    this.handleSerialFromCard(e.data.data);
                } else if (e.data.type === 'flash_persisted') {
                    const activeCardId = this.cardId || window.activeComputerCardId;
                    console.log(`[WasmCardWrapper] Saving flash memory for ${activeCardId}: ${Object.keys(e.data.sectors || {}).length} sectors`);
                    if (e.data.sectors && Object.keys(e.data.sectors).length > 0) {
                        localStorage.setItem('mtm_flash_sectors_' + activeCardId, JSON.stringify(e.data.sectors));
                    } else {
                        localStorage.removeItem('mtm_flash_sectors_' + activeCardId);
                    }
                }
            };
        }

        // Listen to messages from the editor iframe and forward to the WASM card worklet
        this.messageListener = (e) => {
            if (!e.data) return;
            if (e.data.type === 'midi_to_card') {
                this.onMidiMessage(e.data.data);
            } else if (e.data.type === 'serial_to_card') {
                if (audioNodes['WasmComputerNode']) {
                    audioNodes['WasmComputerNode'].port.postMessage({
                        type: 'serial_to_card',
                        data: e.data.data
                    });
                }
            } else if (e.data.type === 'write_flash_bytes') {
                if (audioNodes['WasmComputerNode']) {
                    audioNodes['WasmComputerNode'].port.postMessage({
                        type: 'write_flash_bytes',
                        offset: e.data.offset,
                        bytes: e.data.bytes
                    });
                }
            }
        };
        window.addEventListener('message', this.messageListener);

        this.setupActionButtons(cardId);
    }

    unmount() {
        // Clean up UI buttons and modals
        this.removeActionButtons();
        if (this.editorModal) {
            this.editorModal.remove();
            this.editorModal = null;
            this.editorIframe = null;
        }

        if (this.messageListener) {
            window.removeEventListener('message', this.messageListener);
            this.messageListener = null;
        }

        super.unmount();
        console.log(`[WasmCardWrapper] Unmounted.`);
        
        this.removeSelectionUI();

        if (audioNodes['WasmComputerNode']) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'unload_card'
            });
            audioNodes['WasmComputerNode'].port.onmessage = null;
        }
    }

    reset() {
        const cardId = this.cardId || window.activeComputerCardId;
        const cardIdx = WASM_CARD_MAP[cardId] ?? null;
        
        console.log(`[WasmCardWrapper] Resetting card ID: ${cardId} (WASM Index: ${cardIdx})`);

        // Load saved flash sectors if they exist
        const savedFlashStr = localStorage.getItem('mtm_flash_sectors_' + cardId);
        let flashSectors = null;
        if (savedFlashStr) {
            try {
                flashSectors = JSON.parse(savedFlashStr);
                console.log(`[WasmCardWrapper] Reset: loaded saved flash sectors`);
            } catch (err) {
                console.error(`[WasmCardWrapper] Reset: error parsing saved flash sectors:`, err);
            }
        }

        if (audioNodes['WasmComputerNode'] && cardIdx !== null) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'load_card',
                cardIndex: cardIdx,
                flashSectors: flashSectors
            });
        }
    }

    onMidiMessage(data) {
        // Forward incoming MIDI to worklet
        if (audioNodes['WasmComputerNode']) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'midi_to_card',
                data: Array.from(data)
            });
        }
    }

    handleMidiFromCard(bytes) {
        // 1. Forward to editor iframe if open
        if (this.editorIframe && this.editorIframe.contentWindow) {
            this.editorIframe.contentWindow.postMessage({
                type: 'midi_from_card',
                data: bytes
            }, '*');
        }

        // 2. Forward to selected global MIDI Output device
        if (typeof midiAccess !== 'undefined' && midiAccess && typeof midiOutputs !== 'undefined' && midiOutputs.length > 0) {
            midiOutputs.forEach(output => {
                if (typeof midiOutDeviceId !== 'undefined' && (midiOutDeviceId === 'all' || output.id === midiOutDeviceId)) {
                    try {
                        output.send(bytes);
                    } catch (err) {
                        // Ignore
                    }
                }
            });
        }
    }

    handleSerialFromCard(bytes) {
        // Forward to editor iframe if open
        if (this.editorIframe && this.editorIframe.contentWindow) {
            this.editorIframe.contentWindow.postMessage({
                type: 'serial_from_card',
                data: bytes
            }, '*');
        }
    }

    setupActionButtons(cardId) {
        // Check for Editor
        const CARDS_WITH_WEB_EDITORS = {
            'flux': 'flux_manager.html',
            'lens': 'lens.html',
            'drumdrum': 'editor.html',
            'reverb': 'reverb.html',
            'twists': 'twists.html',
            'bytebeat': 'bytebeat.html',
            'bends': 'bends_manager.html',
            'modes': 'modes_manager.html',
            'grains': 'grains_manager.html',
            'stretchcore': 'index.html',
            'degenerator': 'index.html',
            'computer_grids': 'index.html',
            'rompler': 'rompler_manager.html',
            'mlrws': 'index.html',
            'blackbird': 'index.html',
            'clockwork': 'index.html',
            'cosmik_c1zzl3': 'index.html',
            'fr330hfr33': 'index.html',
            'turing_matrix': 'index.html',
            'turing_machine': 'index.html',
            'resonator': 'index.html',
            'fragments': 'fragments_librarian.html',
            'usb_audio_bridge': 'midi_config.html'
        };

        const editorBtn = document.getElementById('cardEditorBtn');

        if (editorBtn) {
            if (CARDS_WITH_WEB_EDITORS[cardId]) {
                editorBtn.classList.remove('hidden');
                
                // Clone node to clear existing event listeners
                const newEditorBtn = editorBtn.cloneNode(true);
                editorBtn.parentNode.replaceChild(newEditorBtn, editorBtn);
                this.editorBtn = newEditorBtn;

                const htmlFile = CARDS_WITH_WEB_EDITORS[cardId];
                const openAction = (e) => {
                    e.stopPropagation();
                    this.openEditorModal(cardId, htmlFile);
                };
                this.editorBtn.addEventListener('click', openAction);
                this.editorBtn.addEventListener('touchstart', openAction);
            } else {
                editorBtn.classList.add('hidden');
                this.editorBtn = null;
            }
        }
    }

    removeActionButtons() {
        const editorBtn = document.getElementById('cardEditorBtn');
        if (editorBtn) editorBtn.classList.add('hidden');
        this.editorBtn = null;
    }

    closeModals() {
        if (this.editorModal) {
            this.editorModal.classList.remove('visible');
        }
    }

    openEditorModal(cardId, htmlFile) {
        if (this.editorModal) {
            this.editorModal.classList.add('visible');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay visible';

        let cardFolder = cardId;
        if (cardId === 'usb_audio_bridge') cardFolder = 'usb_audio';

        modal.innerHTML = `
            <div class="modal-content card-editor-modal">
                <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="display: flex; align-items: center;">
                        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">${cardId.toUpperCase()} EDITOR</h2>
                    </div>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <iframe class="card-editor-iframe" src="js/cards/wasm/web/${cardFolder}/${htmlFile}" allow="midi; serial"></iframe>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.editorModal = modal;
        this.editorIframe = modal.querySelector('.card-editor-iframe');

        const closeAction = () => this.closeModals();
        modal.querySelector('.close-btn').addEventListener('click', closeAction);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAction();
        });
    }

    update(params, time) {
        // Update dynamic labels if Z-switch changes layers
        if (params.switch !== this.lastSwitchVal) {
            this.lastSwitchVal = params.switch;
            this.updateWasmCardLabels(params.switch);
        }

        // Send control parameters (knobs and switches) to the worklet
        if (audioNodes['WasmComputerNode']) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'controls',
                knobMain: params.main ?? 0,
                knobX: params.x ?? 0,
                knobY: params.y ?? 0,
                switchZ: params.switch ?? 0
            });

            // Send jack connection state every update tick.
            // ComputerCard.h returns 0/false for disconnected jacks, so this is critical.
            // Order matches g_input_connected[6]: audioL, audioR, cv1, cv2, pulse1, pulse2
            const isJackPatched = (jackId) => {
                if (typeof cableData === 'undefined') return true; // assume connected if unknown
                return cableData.some(c => c.start === jackId || c.end === jackId);
            };

            const connected = [
                isJackPatched('jack-audio1in'),
                isJackPatched('jack-audio2in'),
                isJackPatched('jack-cv1in'),
                isJackPatched('jack-cv2in'),
                isJackPatched('jack-pulse1in'),
                isJackPatched('jack-pulse2in')
            ];

            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'connected',
                connected: connected
            });
        }
    }

    updateWasmCardLabels(switchVal) {
        const cardId = window.activeComputerCardId;
        if (cardId === 'utility_pair') return; // Handled separately
        
        const cardDef = (window.AVAILABLE_CARDS || []).find(c => c.id === cardId);
        if (!cardDef) return;

        const zMode = ['down', 'middle', 'up'][switchVal] || 'middle';
        const anyLabels = (cardDef.layers && cardDef.layers['any']) || {};
        const layerLabels = (cardDef.layers && cardDef.layers[zMode]) || {};

        const newLabels = {
            'knob-large-computer': 'Main',
            'switch-3way-computer': 'Mode',
            'knob-small-x': 'X',
            'knob-small-y': 'Y',
            ...(cardDef.labels || {}),
            ...anyLabels,
            ...layerLabels
        };

        this.labels = newLabels;

        if (typeof renderComponentLabels === 'function') {
            renderComponentLabels();
        }
    }

    updateLEDs(leds) {
        // leds is an array of 6 brightness values (0.0 to 1.0)
        for (let i = 0; i < 6; i++) {
            const led = document.getElementById(`led-comp-${i}`);
            if (!led) continue;
            
            const brightness = leds[i] ?? 0;
            if (brightness > 0.02) {
                led.classList.add('active');
                led.style.opacity = 0.3 + (brightness * 0.7);
                led.style.boxShadow = `0 0 ${brightness * 10}px #ef4444`;
            } else {
                led.classList.remove('active');
                led.style.opacity = 0.2;
                led.style.boxShadow = 'none';
            }
        }
    }

    writeUtilityIndicesToWasm() {
        if (audioNodes['WasmComputerNode']) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'write_flash_bytes',
                offset: 2093056, // configFlashAddr
                bytes: [this.utilityIndexL, this.utilityIndexR]
            });
        }
    }

    createSelectionUI() {
        try {
            this.removeSelectionUI();

            const synthContainer = document.getElementById('synthContainer');
            const cardSlot = document.getElementById('computerCardSlot');
            if (!synthContainer || !cardSlot) return;

            if (typeof UTILITY_PAIR_LIBRARY === 'undefined' || !UTILITY_PAIR_LIBRARY || UTILITY_PAIR_LIBRARY.length === 0) {
                console.error('UTILITY_PAIR_LIBRARY not loaded!');
                return;
            }

            const container = document.createElement('div');
            container.id = 'utility-pair-controls';
            container.className = 'utility-pair-controls';

            container.style.cssText = `
                position: absolute;
                bottom: 20px;
                left: 20px;
                display: flex;
                gap: 8px;
                align-items: center;
                background: var(--bg-elevated, #2a2a2a);
                border: 1px solid var(--border-color, #444);
                border-radius: 6px;
                padding: 4px 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                z-index: 10;
                font-size: 10px;
                pointer-events: auto;
                transition: opacity 0.2s;
            `;

            const labelL = document.createElement('span');
            labelL.textContent = 'L:';
            labelL.style.cssText = 'color: var(--text-color, #fff); font-weight: bold; font-size: 9px;';

            const selectL = document.createElement('select');
            selectL.id = 'utility-select-L';
            selectL.className = 'utility-select';
            selectL.style.cssText = `
                background: var(--input-bg, #1a1a1a);
                color: var(--text-color, #fff);
                border: 1px solid var(--border-color, #555);
                border-radius: 4px;
                padding: 2px 4px;
                font-size: 9px;
                cursor: pointer;
                min-width: 90px;
                max-width: 110px;
            `;

            const labelR = document.createElement('span');
            labelR.textContent = 'R:';
            labelR.style.cssText = 'color: var(--text-color, #fff); font-weight: bold; font-size: 9px; margin-left: 4px;';

            const selectR = document.createElement('select');
            selectR.id = 'utility-select-R';
            selectR.className = 'utility-select';
            selectR.style.cssText = selectL.style.cssText;

            (window.UTILITY_PAIR_LIBRARY || []).forEach((util, index) => {
                const optionL = document.createElement('option');
                optionL.value = index;
                optionL.textContent = util.name;
                optionL.title = util.desc || util.fullName;

                const optionR = document.createElement('option');
                optionR.value = index;
                optionR.textContent = util.name;
                optionR.title = util.desc || util.fullName;

                selectL.appendChild(optionL);
                selectR.appendChild(optionR);
            });

            selectL.value = this.utilityIndexL;
            selectR.value = this.utilityIndexR;

            selectL.addEventListener('change', (e) => {
                e.stopPropagation();
                this.selectUtility(parseInt(e.target.value), 'L');
            });

            selectR.addEventListener('change', (e) => {
                e.stopPropagation();
                this.selectUtility(parseInt(e.target.value), 'R');
            });

            const style = document.createElement('style');
            style.textContent = `
                .utility-print-label { display: none; }
                body.exporting .utility-print-label { display: inline-block; font-size: 10px; border: 1px solid #777; padding: 2px 4px; border-radius: 4px; color: black; background: white; white-space: nowrap; }
                body.exporting .utility-select { display: none !important; }
            `;
            container.appendChild(style);

            const printLabelL = document.createElement('span');
            printLabelL.id = 'utility-print-L';
            printLabelL.className = 'utility-print-label';
            if (UTILITY_PAIR_LIBRARY[this.utilityIndexL]) {
                printLabelL.textContent = UTILITY_PAIR_LIBRARY[this.utilityIndexL].name;
            }

            const printLabelR = document.createElement('span');
            printLabelR.id = 'utility-print-R';
            printLabelR.className = 'utility-print-label';
            if (UTILITY_PAIR_LIBRARY[this.utilityIndexR]) {
                printLabelR.textContent = UTILITY_PAIR_LIBRARY[this.utilityIndexR].name;
            }

            container.appendChild(labelL);
            container.appendChild(selectL);
            container.appendChild(printLabelL);
            container.appendChild(labelR);
            container.appendChild(selectR);
            container.appendChild(printLabelR);

            container.addEventListener('mousedown', e => e.stopPropagation());
            container.addEventListener('click', e => e.stopPropagation());
            container.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

            synthContainer.appendChild(container);
            this.uiElements = container;
        } catch (error) {
            console.error('Error creating utility pair UI:', error);
        }
    }

    removeSelectionUI() {
        const existing = document.getElementById('utility-pair-controls');
        if (existing) existing.remove();

        if (this.uiElements) {
            this.uiElements.remove();
            this.uiElements = null;
        }
    }

    selectUtility(index, channel) {
        console.log(`Switching ${channel} channel to: ${UTILITY_PAIR_LIBRARY[index].name}`);
        if (channel === 'L') {
            this.utilityIndexL = index;
        } else {
            this.utilityIndexR = index;
        }

        this.writeUtilityIndicesToWasm();

        // Reload card in C++ so it picks up new index from flash config
        const cardIdx = WASM_CARD_MAP['utility_pair'];
        if (audioNodes['WasmComputerNode']) {
            audioNodes['WasmComputerNode'].port.postMessage({
                type: 'load_card',
                cardIndex: cardIdx
            });
        }

        this.updateLabels();

        const printL = document.getElementById('utility-print-L');
        const printR = document.getElementById('utility-print-R');
        if (printL && UTILITY_PAIR_LIBRARY[this.utilityIndexL]) printL.textContent = UTILITY_PAIR_LIBRARY[this.utilityIndexL].name;
        if (printR && UTILITY_PAIR_LIBRARY[this.utilityIndexR]) printR.textContent = UTILITY_PAIR_LIBRARY[this.utilityIndexR].name;

        if (typeof saveState === 'function') {
            saveState();
        }
    }

    updateLabels() {
        const utilityL = UTILITY_PAIR_LIBRARY[this.utilityIndexL];
        const utilityR = UTILITY_PAIR_LIBRARY[this.utilityIndexR];

        const newLabels = {
            'knob-large-computer': 'Main',
            'switch-3way-computer': 'Mode'
        };

        const mapLabels = (util, channel) => {
            if (!util || !util.labels) return;
            const suffix = channel === 'L' ? '1' : '2';
            const knobKey = channel === 'L' ? 'knob-small-x' : 'knob-small-y';

            if (util.labels.knob) newLabels[knobKey] = Array.isArray(util.labels.knob) ? util.labels.knob[channel === 'L' ? 0 : 1] : util.labels.knob;
            if (util.labels.in) newLabels[`jack-audio${suffix}in`] = (Array.isArray(util.labels.in) ? util.labels.in[channel === 'L' ? 0 : 1] : util.labels.in).replace('L ', channel + ' ');
            if (util.labels.out) newLabels[`jack-audio${suffix}out`] = (Array.isArray(util.labels.out) ? util.labels.out[channel === 'L' ? 0 : 1] : util.labels.out).replace('L ', channel + ' ');
            if (util.labels.cv) newLabels[`jack-cv${suffix}in`] = Array.isArray(util.labels.cv) ? util.labels.cv[channel === 'L' ? 0 : 1] : util.labels.cv;
            if (util.labels.cvIn) newLabels[`jack-cv${suffix}in`] = Array.isArray(util.labels.cvIn) ? util.labels.cvIn[channel === 'L' ? 0 : 1] : util.labels.cvIn;
            if (util.labels.cvOut) newLabels[`jack-cv${suffix}out`] = Array.isArray(util.labels.cvOut) ? util.labels.cvOut[channel === 'L' ? 0 : 1] : util.labels.cvOut;
            if (util.labels.sub) {
                const label = Array.isArray(util.labels.sub) ? util.labels.sub[channel === 'L' ? 0 : 1] : util.labels.sub;
                if (channel === 'L') newLabels['knob-large-computer'] = label;
                else newLabels['switch-3way-computer'] = label;
            }
            if (util.labels.pulseIn) newLabels[`jack-pulse${suffix}in`] = Array.isArray(util.labels.pulseIn) ? util.labels.pulseIn[channel === 'L' ? 0 : 1] : util.labels.pulseIn;
            if (util.labels.pulseOut) newLabels[`jack-pulse${suffix}out`] = Array.isArray(util.labels.pulseOut) ? util.labels.pulseOut[channel === 'L' ? 0 : 1] : util.labels.pulseOut;
        };

        mapLabels(utilityL, 'L');
        mapLabels(utilityR, 'R');

        this.labels = newLabels;

        if (typeof renderComponentLabels === 'function') {
            renderComponentLabels();
        }

        if (typeof updateCardVisuals === 'function' && window.AVAILABLE_CARDS) {
            const def = window.AVAILABLE_CARDS.find(c => c.id === 'utility_pair');
            if (def) updateCardVisuals(def);
        }
    }

    getState() {
        const cardId = window.activeComputerCardId;
        if (cardId === 'utility_pair') {
            return {
                utilityIndexL: this.utilityIndexL,
                utilityIndexR: this.utilityIndexR
            };
        }
        return null;
    }

    setState(state) {
        const cardId = window.activeComputerCardId;
        if (cardId === 'utility_pair' && state) {
            this.utilityIndexL = state.utilityIndexL ?? 0;
            this.utilityIndexR = state.utilityIndexR ?? 0;

            const selectL = document.getElementById('utility-select-L');
            const selectR = document.getElementById('utility-select-R');
            if (selectL) selectL.value = this.utilityIndexL;
            if (selectR) selectR.value = this.utilityIndexR;

            this.writeUtilityIndicesToWasm();

            const cardIdx = WASM_CARD_MAP['utility_pair'];
            if (audioNodes['WasmComputerNode']) {
                audioNodes['WasmComputerNode'].port.postMessage({
                    type: 'load_card',
                    cardIndex: cardIdx
                });
            }

            this.updateLabels();
        }
    }
}

// Make globally available
window.WasmCardWrapper = WasmCardWrapper;

// Map all C++ cards in AVAILABLE_CARDS to use WasmCardWrapper
if (window.AVAILABLE_CARDS) {
    window.AVAILABLE_CARDS.forEach(card => {
        if (card.id !== 'none') {
            card.class = WasmCardWrapper;
            card.hasImplementation = true;
        }
    });
}

