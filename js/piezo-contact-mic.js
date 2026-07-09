/**
 * piezo-contact-mic.js — Web Audio contact mic simulator using extracted piezo OGG samples.
 *
 * Mirrors the VCV Workshop System ContactMicModule architecture:
 *   - TransientPlayer:     Round-robin one-shot playback on tap/scratch/drag events
 *   - GranularLoopPlayer:  Crossfading granular loop during sustained contact
 *   - PiezoContactMic:     Combines both, exposes a GainNode as the signal output
 *
 * Prerequisites:
 *   - Run scripts/extract-piezo.js first to generate assets/piezo/*.ogg + manifest.json
 *   - OGG files must be served from the same origin (file:// or http://)
 *
 * Usage:
 *   const mic = new PiezoContactMic(audioCtx, 'assets/piezo/manifest.json');
 *   await mic.load();
 *   mic.output.connect(someNode);
 *
 *   // On tap event:
 *   mic.trigger('tap_near', { velocity: 0.8, pitch: 1.0 + Math.random() * 0.1 });
 *
 *   // For sustained drag:
 *   mic.startLoop('scratch');
 *   mic.stopLoop();
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TransientPlayer — plays a short one-shot buffer with pitch randomisation
// and round-robin variant selection (prevents "machine gun" repetition).
// ─────────────────────────────────────────────────────────────────────────────

class TransientPlayer {
    /**
     * @param {AudioContext} ctx
     * @param {AudioNode}    destination  Target node to connect to (e.g., a GainNode)
     * @param {AudioBuffer[]} buffers     Variant buffers for this group
     */
    constructor(ctx, destination, buffers) {
        this._ctx         = ctx;
        this._dest        = destination;
        this._buffers     = buffers;
        this._rrIndex     = 0;
        this._activeNodes = [];
    }

    /**
     * Trigger a one-shot transient.
     * @param {object} options
     * @param {number} [options.velocity=1]   Amplitude (0..1)
     * @param {number} [options.pitch=1]      Playback rate multiplier
     * @param {number} [options.when=0]       Scheduled time (ctx.currentTime offset)
     */
    trigger({ velocity = 1, pitch = 1, when = 0 } = {}) {
        if (!this._buffers.length) return;

        const buf  = this._buffers[this._rrIndex % this._buffers.length];
        this._rrIndex = (this._rrIndex + 1) % this._buffers.length;

        const now     = this._ctx.currentTime + when;
        const src     = this._ctx.createBufferSource();
        const gainNode = this._ctx.createGain();

        src.buffer             = buf;
        src.playbackRate.value = pitch;
        gainNode.gain.value    = Math.max(0, Math.min(1, velocity));

        src.connect(gainNode);
        gainNode.connect(this._dest);

        // Short envelope: attack=1ms, decay over buffer duration
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(velocity, now + 0.001);
        gainNode.gain.setValueAtTime(velocity, now + buf.duration - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, now + buf.duration);

        src.start(now);
        src.stop(now + buf.duration + 0.02);

        // Clean up after playback
        src.onended = () => {
            try { gainNode.disconnect(); } catch {}
            const i = this._activeNodes.indexOf(gainNode);
            if (i !== -1) this._activeNodes.splice(i, 1);
        };

        this._activeNodes.push(gainNode);
    }

    stopAll() {
        for (const n of this._activeNodes) {
            try { n.gain.cancelScheduledValues(0); n.gain.setTargetAtTime(0, this._ctx.currentTime, 0.02); } catch {}
        }
        this._activeNodes = [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GranularLoopPlayer — continuously crossfades overlapping grains from a buffer
// to create a smooth sustain (mirrors VCV GranularLoopPlayer).
// ─────────────────────────────────────────────────────────────────────────────

class GranularLoopPlayer {
    /**
     * @param {AudioContext} ctx
     * @param {AudioNode}    destination
     * @param {AudioBuffer[]} buffers     Variant buffers for this group
     * @param {object} [options]
     * @param {number} [options.grainDuration=0.08]   Grain length in seconds
     * @param {number} [options.grainOverlap=0.5]     Fraction of grain that overlaps (0..1)
     * @param {number} [options.pitchVariance=0.03]   Random pitch spread per grain
     */
    constructor(ctx, destination, buffers, {
        grainDuration  = 0.08,
        grainOverlap   = 0.5,
        pitchVariance  = 0.03
    } = {}) {
        this._ctx           = ctx;
        this._dest          = destination;
        this._buffers       = buffers;
        this._grainDuration = grainDuration;
        this._grainOverlap  = grainOverlap;
        this._pitchVariance = pitchVariance;

        this._playing    = false;
        this._rrIndex    = 0;
        this._timerID    = null;
        this._grainGain  = ctx.createGain();
        this._grainGain.gain.value = 0;
        this._grainGain.connect(destination);
        this._velocity   = 0.7;
    }

    /**
     * Start the granular loop.
     * @param {number} [velocity=0.7]
     */
    start(velocity = 0.7) {
        if (this._playing || !this._buffers.length) return;
        this._playing  = true;
        this._velocity = velocity;
        // Fade in
        this._grainGain.gain.cancelScheduledValues(this._ctx.currentTime);
        this._grainGain.gain.setTargetAtTime(velocity, this._ctx.currentTime, 0.05);
        this._scheduleGrain();
    }

    /**
     * Stop the granular loop (with fade out).
     * @param {number} [fadeTime=0.15]
     */
    stop(fadeTime = 0.15) {
        if (!this._playing) return;
        this._playing = false;
        this._grainGain.gain.cancelScheduledValues(this._ctx.currentTime);
        this._grainGain.gain.setTargetAtTime(0, this._ctx.currentTime, fadeTime / 3);
        if (this._timerID) { clearTimeout(this._timerID); this._timerID = null; }
    }

    _scheduleGrain() {
        if (!this._playing) return;

        const buf       = this._buffers[this._rrIndex % this._buffers.length];
        this._rrIndex   = (this._rrIndex + 1) % this._buffers.length;

        // Random position in the buffer (avoid first/last 10%)
        const maxStart  = Math.max(0, buf.duration - this._grainDuration);
        const startOff  = maxStart * 0.1 + Math.random() * maxStart * 0.8;

        const src = this._ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = 1 + (Math.random() * 2 - 1) * this._pitchVariance;

        // Per-grain envelope (Hanning window)
        const grainGain = this._ctx.createGain();
        const now       = this._ctx.currentTime;
        const dur       = this._grainDuration;

        grainGain.gain.setValueAtTime(0, now);
        grainGain.gain.linearRampToValueAtTime(1, now + dur * 0.15);
        grainGain.gain.setValueAtTime(1, now + dur * 0.85);
        grainGain.gain.linearRampToValueAtTime(0, now + dur);

        src.connect(grainGain);
        grainGain.connect(this._grainGain);

        src.start(now, startOff, dur);
        src.onended = () => { try { grainGain.disconnect(); } catch {} };

        // Schedule next grain (overlapping by grainOverlap fraction)
        const interval = this._grainDuration * (1 - this._grainOverlap) * 1000;
        this._timerID = setTimeout(() => this._scheduleGrain(), interval);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PiezoContactMic — top-level API
// ─────────────────────────────────────────────────────────────────────────────

class PiezoContactMic {
    /**
     * @param {AudioContext} ctx
     * @param {string}       manifestUrl  URL to manifest.json produced by extract-piezo.js
     */
    constructor(ctx, manifestUrl = 'assets/piezo/manifest.json') {
        this._ctx         = ctx;
        this._manifestUrl = manifestUrl;
        this._manifest    = null;
        this._buffers     = {};   // groupName -> AudioBuffer[]
        this._transients  = {};   // groupName -> TransientPlayer
        this._loops       = {};   // groupName -> GranularLoopPlayer

        /** Master output GainNode — connect this into your signal chain */
        this.output       = ctx.createGain();
        this.output.gain.value = 1.0;

        this._loaded      = false;
        this._activeLoop  = null; // currently playing group name
    }

    /**
     * Load manifest and decode all OGG buffers.
     * Call once after constructing, before triggering any events.
     * @returns {Promise<void>}
     */
    async load() {
        // Load manifest
        const res          = await fetch(this._manifestUrl);
        this._manifest     = await res.json();
        const baseUrl      = this._manifestUrl.replace(/\/[^/]+$/, '/');

        const groupEntries = Object.entries(this._manifest.groups);
        await Promise.all(groupEntries.map(async ([name, group]) => {
            const variantBuffers = await Promise.all(
                group.variants.map(async (v) => {
                    const audioRes = await fetch(baseUrl + v.file);
                    const arrBuf   = await audioRes.arrayBuffer();
                    return this._ctx.decodeAudioData(arrBuf);
                })
            );
            this._buffers[name] = variantBuffers;

            // Create players
            this._transients[name] = new TransientPlayer(
                this._ctx, this.output, variantBuffers
            );
            this._loops[name] = new GranularLoopPlayer(
                this._ctx, this.output, variantBuffers
            );
        }));

        this._loaded = true;
        console.log('[PiezoContactMic] Loaded ' + groupEntries.length + ' sample groups.');
    }

    /**
     * Trigger a one-shot transient (tap, scratch event).
     * @param {string} group          e.g. 'tap_near', 'tap_mid', 'scratch'
     * @param {object} [options]
     * @param {number} [options.velocity=0.8]
     * @param {number} [options.pitch=1.0]
     */
    trigger(group, options = {}) {
        if (!this._loaded) return;
        const player = this._transients[group];
        if (!player) {
            console.warn('[PiezoContactMic] Unknown group: ' + group);
            return;
        }
        player.trigger({
            velocity: options.velocity ?? 0.8,
            pitch:    options.pitch    ?? (1 + (Math.random() - 0.5) * 0.04)
        });
    }

    /**
     * Start a sustained granular loop (e.g., during drag/rub).
     * @param {string} group     e.g. 'scratch', 'rub'
     * @param {number} [velocity=0.6]
     */
    startLoop(group, velocity = 0.6) {
        if (!this._loaded) return;
        if (this._activeLoop === group) return;
        if (this._activeLoop) this.stopLoop();
        const player = this._loops[group];
        if (!player) return;
        player.start(velocity);
        this._activeLoop = group;
    }

    /**
     * Stop the current granular loop.
     */
    stopLoop() {
        if (!this._activeLoop) return;
        const player = this._loops[this._activeLoop];
        if (player) player.stop();
        this._activeLoop = null;
    }

    /**
     * Returns a sorted list of available group names.
     * @returns {string[]}
     */
    get groups() {
        return Object.keys(this._buffers).sort();
    }

    get loaded() { return this._loaded; }
}

// Export for use as a module or via <script> tag
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PiezoContactMic, TransientPlayer, GranularLoopPlayer };
} else if (typeof window !== 'undefined') {
    window.PiezoContactMic     = PiezoContactMic;
    window.TransientPlayer     = TransientPlayer;
    window.GranularLoopPlayer  = GranularLoopPlayer;
}
