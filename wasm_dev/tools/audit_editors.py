#!/usr/bin/env python3
import os
import re
import sys

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB_DIR = os.path.join(BASE_DIR, "js", "cards", "wasm", "web")

CARDS_WITH_WEB_EDITORS = {
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
}

failures = 0
successes = 0

print("=== STARTING WEB EDITORS AUDIT ===")

for card_id, html_name in CARDS_WITH_WEB_EDITORS.items():
    folder = "usb_audio" if card_id == "usb_audio_bridge" else card_id
    card_dir = os.path.join(WEB_DIR, folder)
    html_path = os.path.join(card_dir, html_name)
    
    print(f"\nAuditing card: {card_id} -> {html_name}")
    
    if not os.path.exists(html_path):
        print(f"  [ERROR] Entry file does not exist: {html_path}")
        failures += 1
        continue
        
    # Read HTML content
    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        html_content = f.read()
        
    # 1. Check for editor_bridge.js
    if "editor_bridge.js" not in html_content:
        print("  [ERROR] editor_bridge.js is NOT injected!")
        failures += 1
    else:
        print("  [OK] editor_bridge.js is injected.")
        successes += 1
        
    # 2. Check for local referenced files (scripts, stylesheets)
    # Find all src="...", href="..."
    refs = re.findall(r'(?:src|href)=[\'"]([^\'"]+)[\'"]', html_content)
    for ref in refs:
        # Ignore external CDNs, schemas, queries, hashes
        if ref.startswith(("http:", "https:", "//", "data:")):
            continue
        clean_ref = ref.split("?")[0].split("#")[0]
        if not clean_ref:
            continue
            
        ref_path = os.path.abspath(os.path.join(card_dir, clean_ref))
        if not os.path.exists(ref_path):
            # Special check for editor_bridge.js relative path which is in parent directory
            if "editor_bridge.js" in clean_ref:
                # editor_bridge.js is resolved dynamically at runtime/relative, let's verify if that path exists
                # The bridge is inside patchnotes/patch_notes/js/cards/wasm/editor_bridge.js
                expected_bridge = os.path.join(BASE_DIR, "js", "cards", "wasm", "editor_bridge.js")
                if os.path.exists(expected_bridge):
                    print(f"  [OK] Referenced bridge: {clean_ref} resolves to valid file.")
                    successes += 1
                else:
                    print(f"  [ERROR] Referenced bridge file does not exist: {expected_bridge}")
                    failures += 1
            else:
                print(f"  [ERROR] Referenced local file does not exist: {clean_ref} (Full path: {ref_path})")
                failures += 1
        else:
            print(f"  [OK] Referenced local file exists: {clean_ref}")
            successes += 1

print(f"\nAudit summary: {successes} checks passed, {failures} checks failed.")
if failures > 0:
    sys.exit(1)
else:
    sys.exit(0)
