#!/usr/bin/env node
/**
 * extract-piezo.js — One-time offline tool to extract piezo contact mic samples
 * from the VCV Workshop System piezo_samples.h and encode them as OGG Vorbis files.
 *
 * Prerequisites:
 *   - ffmpeg must be in PATH  (brew install ffmpeg)
 *   - Node.js >= 16
 *
 * Usage (run from the patchnotes root):
 *   node scripts/extract-piezo.js
 *
 * Output:
 *   assets/piezo/<group>_<variant>.ogg
 *   assets/piezo/manifest.json  — catalogue of groups, variants, sample rates
 *
 * The raw C float arrays are at 44100 Hz (VCV piezo engine uses baseRate = 44100/sampleRate).
 * Total input: ~34.9 MB (2.93 M floats); output: ~935 KB (OGG q3).
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const cp     = require('child_process');
const os     = require('os');

// ─── Config ──────────────────────────────────────────────────────────────────
const PIEZO_H       = path.resolve(__dirname, '../../../Workshop_System_VCV/src/piezo_samples.h');
const OUT_DIR       = path.resolve(__dirname, '../assets/piezo');
const SAMPLE_RATE   = 44100;   // Hz — confirmed by VCV baseRate = 44100/sampleRate
const OGG_QUALITY   = 3;       // VBR quality 0-10 (3 ~= ~112 kbps, transparent for 1ch audio)
const CHANNELS      = 1;       // All piezo samples are mono
// ─────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(PIEZO_H)) {
    console.error('ERROR: piezo_samples.h not found at:\n  ' + PIEZO_H);
    process.exit(1);
}

try {
    cp.execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
    console.error('ERROR: ffmpeg not found in PATH. Install it with: brew install ffmpeg');
    process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('Reading ' + PIEZO_H + ' ...');
console.log('(This file is ~35 MB - streaming parse, please wait)\n');

// ─── Parse the header file ────────────────────────────────────────────────────
// We look for lines of the form:
//   const float tap_near_0[] = { 0.1234f, -0.5678f, ... };
// across potentially many lines (the arrays wrap at 80 cols).

const source = fs.readFileSync(PIEZO_H, 'utf8');

// Match array declarations: const float <name>_data[N] = { ... };
// Actual format in piezo_samples.h:
//   const float piezo_scratch_near_var1_data[22573] = { 0.123f, -0.456f, ... };
const DECL_RE = /const\s+float\s+(\w+)\s*\[\s*\d+\s*\]\s*=\s*\{([^}]+)\};/gs;

const arrays = {};   // name -> Float32Array
let match;

console.log('Parsing float arrays ...');
while ((match = DECL_RE.exec(source)) !== null) {
    const name   = match[1];
    const body   = match[2];
    // Parse comma-separated float literals (may have trailing 'f')
    const values = body
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseFloat(s));   // parseFloat ignores trailing 'f'
    arrays[name] = new Float32Array(values);
    process.stdout.write('  found: ' + name + ' (' + values.length + ' samples)\n');
}

const names = Object.keys(arrays);
console.log('\nFound ' + names.length + ' arrays.\n');

if (names.length === 0) {
    console.error('No arrays found - check the regex or file format.');
    process.exit(1);
}

// ─── Group arrays by base name ────────────────────────────────────────────────
// Convention: tap_near_0, tap_near_1, ... -> group "tap_near", variants [0,1,...]
// Also handles names without trailing _N (single variants).

// Group arrays by base name.
// Naming convention: piezo_<group>_var<N>_data
//   e.g. piezo_scratch_near_var1_data  →  group "scratch_near", variant 0 (var1=index 0)
//        piezo_tap_hard_var3_data      →  group "tap_hard",     variant 2
// Strips the leading "piezo_" prefix and "_data" suffix.

const groups = {};   // baseName -> { variant_index: Float32Array }

for (const name of names) {
    // Remove leading 'piezo_' and trailing '_data'
    let core = name;
    if (core.startsWith('piezo_')) core = core.slice('piezo_'.length);
    if (core.endsWith('_data'))   core = core.slice(0, -'_data'.length);

    // Extract trailing _varN variant number
    const mVar = core.match(/^(.+)_var(\d+)$/);
    if (mVar) {
        const base    = mVar[1];
        const variant = parseInt(mVar[2], 10) - 1; // var1 → index 0
        if (!groups[base]) groups[base] = {};
        groups[base][variant] = arrays[name];
    } else {
        // No _varN suffix — treat as variant 0
        if (!groups[core]) groups[core] = {};
        groups[core][0] = arrays[name];
    }
}

console.log('Groups:');
for (const [g, vs] of Object.entries(groups)) {
    console.log('  ' + g + ': ' + Object.keys(vs).length + ' variant(s)');
}
console.log('');

// ─── Encode each variant -> OGG ──────────────────────────────────────────────
// Write raw f32le PCM to a temp file then pipe through ffmpeg to OGG.

const manifest = {
    sampleRate: SAMPLE_RATE,
    channels:   CHANNELS,
    groups:     {}
};

let total = 0;
for (const [group, variants] of Object.entries(groups)) {
    manifest.groups[group] = { variants: [] };
    for (const [vi, pcm] of Object.entries(variants)) {
        const tag    = group + '_' + vi;
        const tmpRaw = path.join(os.tmpdir(), tag + '.f32');
        const outOgg = path.join(OUT_DIR, tag + '.ogg');

        // Write raw float32 PCM
        const buf = Buffer.from(pcm.buffer);
        fs.writeFileSync(tmpRaw, buf);

        // Encode with ffmpeg: f32le PCM -> OGG Vorbis
        const cmd = [
            'ffmpeg', '-y',
            '-f', 'f32le',
            '-ar', String(SAMPLE_RATE),
            '-ac', String(CHANNELS),
            '-i', tmpRaw,
            '-c:a', 'libvorbis',
            '-q:a', String(OGG_QUALITY),
            outOgg
        ].join(' ');

        try {
            cp.execSync(cmd, { stdio: 'pipe' });
            const size = fs.statSync(outOgg).size;
            total += size;
            process.stdout.write('  [OK] ' + tag + '.ogg - ' + (size/1024).toFixed(1) + ' KB  (' + pcm.length + ' samples)\n');
            fs.unlinkSync(tmpRaw);
        } catch (err) {
            console.error('  [FAIL] ' + tag + ': ' + err.message);
            if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
        }

        manifest.groups[group].variants.push({
            index:    parseInt(vi, 10),
            file:     tag + '.ogg',
            samples:  pcm.length,
            duration: pcm.length / SAMPLE_RATE
        });
    }
}

// Sort variants within each group
for (const g of Object.values(manifest.groups)) {
    g.variants.sort((a, b) => a.index - b.index);
}

const manifestPath = path.join(OUT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('\nDone.');
console.log('   Output dir:   ' + OUT_DIR);
console.log('   Total size:   ' + (total/1024).toFixed(1) + ' KB');
console.log('   Manifest:     ' + manifestPath);
console.log('\nNext step: serve assets/piezo/ as static files and reference');
console.log('           them from js/piezo-contact-mic.js');
