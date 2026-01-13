
class CardNetwork extends ComputerCard {
    static meta = {
        id: 'network',
        name: 'Tab Link',
        num: '111',
        desc: "WebRTC Audio Link. Connects audio between browser tabs.\nSwitch Up: Connect\nSwitch Down: Disconnect"
    };

    constructor(ctx, io) {
        super(ctx, io);

        if (!ctx) return;

        // --- NODES ---
        // Input: From Patch -> WebRTC
        this.inputStreamDest = this.ctx.createMediaStreamDestination();

        // Output: From WebRTC -> Patch
        this.outputGainL = this.ctx.createGain();
        this.outputGainR = this.ctx.createGain();

        // Helper to split incoming stereo stream if needed
        this.splitter = this.ctx.createChannelSplitter(2);

        // Internal State
        this.channelName = 'patchnotes_link';
        this.bc = new BroadcastChannel(this.channelName);
        this.myId = Math.random().toString(36).substring(7);
        this.peerId = null;
        this.pc = null;
        this.isConnected = false;

        // ICE Configuration (Google STUN is standard/free)
        this.rtcConfig = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };

        // Bind BC listeners
        this.bc.onmessage = (e) => this.handleSignal(e.data);

        // Track last switch state to detect toggle
        this.lastSwitchState = 0;
    }

    mount() {
        if (!this.ctx || !this.io) return;
        super.mount();

        // Connect Synth Inputs to WebRTC Destination
        // inputL/R are nodes coming FROM the jack into the card
        this.io.inputL.connect(this.inputStreamDest);
        this.io.inputR.connect(this.inputStreamDest);

        // Connect WebRTC Outputs to Synth Outputs
        // outputGainL/R are my internal nodes, connect to io.outputL/R
        this.outputGainL.connect(this.io.outputL);
        this.outputGainR.connect(this.io.outputR);
    }

    unmount() {
        super.unmount();
        if (this.io) {
            this.io.inputL.disconnect(this.inputStreamDest);
            this.io.inputR.disconnect(this.inputStreamDest);
            this.outputGainL.disconnect(this.io.outputL);
            this.outputGainR.disconnect(this.io.outputR);
        }
        this.disconnect();
    }

    update(p, time) {
        // p.switch is 0 (bottom), 1 (mid), 2 (top)
        const sw = Math.round(p.switch);

        if (sw !== this.lastSwitchState) {
            if (sw > 0 && !this.isConnected) {
                this.connect();
            } else if (sw === 0 && this.isConnected) {
                this.disconnect();
            }
            this.lastSwitchState = sw;
        }

        // Update LED based on connection
        // LED 0 (Top Left) = Connection Status
        // Green if connected, Yellow if connecting, Red if err/disconnected?
        // Using setLed from Base/Benjolin pattern manually as Base DOESNT implement setLed

        const ledIndex = 0;
        const led = document.getElementById(`led-comp-${ledIndex}`);
        if (led) {
            if (this.isConnected) {
                led.classList.add('active');
                led.style.backgroundColor = 'rgb(34, 197, 94)'; // Green
                led.style.boxShadow = '0 0 10px rgb(34, 197, 94)';
            } else if (sw > 0) {
                // Trying to connect (Yellow)
                led.classList.add('active');
                led.style.backgroundColor = 'rgb(234, 179, 8)'; // Yellow
                led.style.boxShadow = '0 0 5px rgb(234, 179, 8)';
            } else {
                // Off
                led.classList.remove('active');
                led.style.backgroundColor = '';
                led.style.boxShadow = '';
            }
        }
    }

    // --- WebRTC Logic ---

    async connect() {
        if (this.isConnected) return;

        console.log(`[Net] ${this.myId} broadcasting hello...`);
        this.bc.postMessage({ type: 'hello', sender: this.myId });
    }

    disconnect() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        this.isConnected = false;
        this.peerId = null;
        // Keep AudioContext graph intact, just stop flow?
        // outputGains are still connected but no input from PC.
    }

    async initPeerConnection(isInitiator) {
        if (this.pc) this.pc.close();

        this.pc = new RTCPeerConnection(this.rtcConfig);

        // 1. ADD LOCAL TRACKS
        this.inputStreamDest.stream.getTracks().forEach(track => {
            this.pc.addTrack(track, this.inputStreamDest.stream);
        });

        // 2. HANDLE REMOTE TRACKS
        this.pc.ontrack = (event) => {
            const remoteStream = event.streams[0];

            // --- AUDIO ELEMENT HACK ---
            // Create a hidden audio element to "pump" the stream. 
            // Required in Chrome/Edge for WebAudio to pick it up properly.
            const audioEl = new Audio();
            audioEl.srcObject = remoteStream;
            audioEl.muted = true; // Still pumps audio to WebAudio, but prevents direct speaker output
            audioEl.play().catch(e => console.log("[Net] Autoplay prevented?", e));

            const source = this.ctx.createMediaStreamSource(remoteStream);

            // Re-route to my gains
            if (remoteStream.getAudioTracks()[0].getSettings().channelCount === 2) {
                source.connect(this.splitter);
                this.splitter.connect(this.outputGainL, 0);
                this.splitter.connect(this.outputGainR, 1);
            } else {
                source.connect(this.outputGainL);
                source.connect(this.outputGainR);
            }
        };

        // 3. ICE CANDIDATES
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.bc.postMessage({
                    type: 'candidate',
                    candidate: event.candidate.toJSON(),
                    sender: this.myId,
                    target: this.peerId
                });
            }
        };

        this.pc.onconnectionstatechange = () => {
            if (this.pc.connectionState === 'connected') {
                this.isConnected = true;
            } else if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
                this.isConnected = false;
                // Optionally disconnect fully?
            }
        };

        // 4. NEGOTIATION
        if (isInitiator) {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            this.bc.postMessage({
                type: 'offer',
                sdp: offer.toJSON ? offer.toJSON() : offer,
                sender: this.myId,
                target: this.peerId
            });
        }
    }

    async handleSignal(data) {
        if (data.target && data.target !== this.myId) return; // Not for me
        if (data.sender === this.myId) return; // From me

        // Only process signals if we are "active" (Switch is On)
        if (this.lastSwitchState === 0) return;

        switch (data.type) {
            case 'hello':
                if (!this.isConnected && !this.peerId) {
                    this.peerId = data.sender;
                    this.bc.postMessage({ type: 'welcome', sender: this.myId, target: this.peerId });
                }
                break;

            case 'welcome':
                if (!this.isConnected && !this.peerId) {
                    this.peerId = data.sender;
                    this.initPeerConnection(true);
                }
                break;

            case 'offer':
                if (!this.peerId) this.peerId = data.sender;
                if (this.peerId !== data.sender) return;

                await this.initPeerConnection(false);
                await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                this.bc.postMessage({
                    type: 'answer',
                    sdp: answer.toJSON ? answer.toJSON() : answer,
                    sender: this.myId,
                    target: this.peerId
                });
                break;

            case 'answer':
                if (this.peerId !== data.sender) return;
                await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                break;

            case 'candidate':
                if (this.peerId !== data.sender) return;
                try {
                    await this.pc.addIceCandidate(data.candidate);
                } catch (e) {
                    console.error("Error adding ice candidate", e);
                }
                break;
        }
    }
}

if (window.registerCard) {
    window.registerCard(CardNetwork);
}
