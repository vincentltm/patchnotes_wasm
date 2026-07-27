import os
import re
import sys

# Paths
PATCHNOTES_DIR = "/Users/vmaurer/Music/Workshop_VCV_Dev/patchnotes/patch_notes"
DEFINITIONS_PATH = os.path.join(PATCHNOTES_DIR, "js/cards/CardDefinitions.js")

# Import CARD_WHITELIST from VCV port script
sys.path.append("/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/tools")
from port_all_cards import CARD_WHITELIST

# Mappings for Port IDs to JS Jack IDs
in_map_js = {
    "audioin1": "jack-audio1in", "audioinput1": "jack-audio1in", "audioinleft": "jack-audio1in", "audioinputleft": "jack-audio1in", "audio1": "jack-audio1in", "audioin": "jack-audio1in",
    "audioin2": "jack-audio2in", "audioinput2": "jack-audio2in", "audioinright": "jack-audio2in", "audioinputright": "jack-audio2in", "audio2": "jack-audio2in",
    "cvin1": "jack-cv1in", "cvinput1": "jack-cv1in", "cv1": "jack-cv1in", "cvmodx": "jack-cv1in",
    "cvin2": "jack-cv2in", "cvinput2": "jack-cv2in", "cv2": "jack-cv2in", "cvmody": "jack-cv2in",
    "pulsein1": "jack-pulse1in", "pulseinput1": "jack-pulse1in", "trigin1": "jack-pulse1in", "triginput1": "jack-pulse1in", "gatein1": "jack-pulse1in", "gateinput1": "jack-pulse1in", "pulse1": "jack-pulse1in",
    "pulsein2": "jack-pulse2in", "pulseinput2": "jack-pulse2in", "trigin2": "jack-pulse2in", "triginput2": "jack-pulse2in", "gatein2": "jack-pulse2in", "gateinput2": "jack-pulse2in", "pulse2": "jack-pulse2in"
}
out_map_js = {
    "audioout1": "jack-audio1out", "audiooutput1": "jack-audio1out", "audiooutleft": "jack-audio1out", "audiooutputleft": "jack-audio1out", "audio1": "jack-audio1out", "audioout": "jack-audio1out",
    "audioout2": "jack-audio2out", "audiooutput2": "jack-audio2out", "audiooutright": "jack-audio2out", "audiooutputright": "jack-audio2out", "audio2": "jack-audio2out",
    "cvout1": "jack-cv1out", "cvoutput1": "jack-cv1out", "cv1": "jack-cv1out", "cvout": "jack-cv1out",
    "cvout2": "jack-cv2out", "cvoutput2": "jack-cv2out", "cv2": "jack-cv2out",
    "pulseout1": "jack-pulse1out", "pulseoutput1": "jack-pulse1out", "gateout1": "jack-pulse1out", "gateoutput1": "jack-pulse1out", "pulse1": "jack-pulse1out",
    "pulseout2": "jack-pulse2out", "pulseoutput2": "jack-pulse2out", "gateout2": "jack-pulse2out", "gateoutput2": "jack-pulse2out", "pulse2": "jack-pulse2out"
}

def parse_yaml(yaml_path):
    result = {
        "name": "",
        "desc": "",
        "creator": "",
        "license": "",
        "repository": "",
        "inputs": {},
        "outputs": {}
    }
    
    if not yaml_path or not os.path.exists(yaml_path):
        return result
        
    with open(yaml_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    current_section = None
    current_subsection = None
    current_item = None
    
    multiline_target = None
    multiline_lines = []
    multiline_indent = None
    
    for line in lines:
        line_rstrip = line.rstrip()
        stripped = line_rstrip.strip()
        
        if multiline_target is not None:
            if not stripped:
                multiline_lines.append("")
                continue
            indent = len(line_rstrip) - len(line_rstrip.lstrip())
            if indent > 0 and (multiline_indent is None or indent >= multiline_indent):
                if multiline_indent is None:
                    multiline_indent = indent
                content_line = line_rstrip[multiline_indent:] if len(line_rstrip) >= multiline_indent else line_rstrip.lstrip()
                multiline_lines.append(content_line)
                continue
            else:
                # End multiline
                val = " ".join(multiline_lines).strip()
                if multiline_target[0] == "desc":
                    result["desc"] = val
                elif multiline_target[0] == "port":
                    _, sub, key = multiline_target
                    current_item[key] = val
                    # Map item if we have id and name/label
                    iid = current_item.get("id", "").lower().replace("_", "").replace(" ", "")
                    name = current_item.get("name") or current_item.get("label") or ""
                    if iid and name:
                        if sub == "inputs" and iid in in_map_js:
                            result["inputs"][in_map_js[iid]] = name
                        elif sub == "outputs" and iid in out_map_js:
                            result["outputs"][out_map_js[iid]] = name
                multiline_target = None
        
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line_rstrip) - len(line_rstrip.lstrip())
        
        if indent == 0 and ":" in stripped:
            k, v = stripped.split(":", 1)
            k = k.strip().lower()
            v = v.strip().strip("'\"")
            if k in ["title", "name"] and not result["name"]:
                result["name"] = v
            elif k in ["short-description", "description", "summary"] and not result["desc"]:
                v_strip = v.strip() if v else ""
                if v_strip in ["|", ">", "|-", ">-"]:
                    multiline_target = ("desc",)
                    multiline_lines = []
                    multiline_indent = None
                else:
                    result["desc"] = v
            elif k == "creator" and not result["creator"]:
                result["creator"] = v
            elif k == "license" and not result["license"]:
                result["license"] = v
            elif k == "repository" and not result["repository"]:
                result["repository"] = v
            elif k in ["panel", "controls"]:
                current_section = k
                current_subsection = None
            continue
            
        if indent == 2 and ":" in stripped:
            k, v = stripped.split(":", 1)
            k = k.strip().lower()
            if current_section == "panel" and k in ["inputs", "outputs"]:
                current_subsection = k
            else:
                current_subsection = None
            continue
            
        if indent == 4:
            if stripped.startswith("-"):
                item_content = stripped[1:].strip()
                if current_subsection in ["inputs", "outputs"]:
                    current_item = {}
                    if ":" in item_content:
                        k, v = item_content.split(":", 1)
                        current_item[k.strip().lower()] = v.strip().strip("'\"")
            elif ":" in stripped and current_subsection in ["inputs", "outputs"]:
                k, v = stripped.split(":", 1)
                k = k.strip().lower()
                current_item = {"id": k}
                if v.strip():
                    current_item["name"] = v.strip().strip("'\"")
            continue
            
        if indent >= 6 and ":" in stripped and current_item is not None:
            k, v = stripped.split(":", 1)
            k = k.strip().lower()
            v = v.strip().strip("'\"")
            v_strip = v.strip() if v else ""
            
            if v_strip in ["|", ">", "|-", ">-"]:
                multiline_target = ("port", current_subsection, k)
                multiline_lines = []
                multiline_indent = None
            else:
                current_item[k] = v
                # Map item
                iid = current_item.get("id", "").lower().replace("_", "").replace(" ", "")
                name = current_item.get("name") or current_item.get("label") or ""
                if iid and name:
                    if current_subsection == "inputs" and iid in in_map_js:
                        result["inputs"][in_map_js[iid]] = name
                    elif current_subsection == "outputs" and iid in out_map_js:
                        result["outputs"][out_map_js[iid]] = name
            continue
            
    if multiline_target is not None:
        val = " ".join(multiline_lines).strip()
        if multiline_target[0] == "desc":
            result["desc"] = val
        elif multiline_target[0] == "port":
            _, sub, key = multiline_target
            current_item[key] = val
            iid = current_item.get("id", "").lower().replace("_", "").replace(" ", "")
            name = current_item.get("name") or current_item.get("label") or ""
            if iid and name:
                if sub == "inputs" and iid in in_map_js:
                    result["inputs"][in_map_js[iid]] = name
                elif sub == "outputs" and iid in out_map_js:
                    result["outputs"][out_map_js[iid]] = name
                    
    return result

def parse_knob_layers(yaml_path):
    if not yaml_path or not os.path.exists(yaml_path):
        return {}
    with open(yaml_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    layers = {}
    lines = content.splitlines()
    current_layer = None
    current_knob = None
    in_controls = False
    in_knobs = False
    
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        indent = len(line) - len(line.lstrip())
        
        if indent == 0:
            if stripped.startswith('controls:'):
                in_controls = True
            else:
                in_controls = False
            in_knobs = False
            continue
            
        if in_controls and indent == 2:
            if stripped.startswith('knobs:'):
                in_knobs = True
            else:
                in_knobs = False
            continue
            
        if in_knobs and indent == 4:
            if stripped.startswith('- when:'):
                m = re.search(r'z:\s*([a-zA-Z0-9_-]+)', stripped)
                if m:
                    z_val = m.group(1).lower()
                    current_layer = {}
                    layers[z_val] = current_layer
                else:
                    current_layer = None
            continue
            
        if current_layer is not None and indent == 6:
            if ':' in stripped:
                knob_name = stripped.split(':', 1)[0].strip().lower()
                if knob_name in ['main', 'x', 'y']:
                    current_knob = knob_name
            continue
            
        if current_layer is not None and current_knob is not None and indent == 8:
            if ':' in stripped:
                k, v = stripped.split(':', 1)
                k = k.strip().lower()
                v = v.strip().strip('\"\'')
                if k == 'name':
                    js_knob_id = {
                        'main': 'knob-large-computer',
                        'x': 'knob-small-x',
                        'y': 'knob-small-y'
                    }[current_knob]
                    current_layer[js_knob_id] = v
            continue
            
def discover_all_hardware_cards():
    cards = []
    seen = set()
    
    # 1. Whitelisted functional cards
    for c in CARD_WHITELIST:
        seen.add(c["id"])
        cards.append(c)
        
    # 2. Discover remaining hardware folders with info.yaml
    releases_dir = "/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/deps/Workshop_Computer/releases"
    external_dir = "/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/deps/external"
    
    for search_dir in [releases_dir, external_dir]:
        if not os.path.exists(search_dir):
            continue
        for folder in sorted(os.listdir(search_dir)):
            yaml_path = os.path.join(search_dir, folder, "info.yaml")
            if os.path.exists(yaml_path):
                parts = folder.split('_', 1)
                num = parts[0] if parts[0].isdigit() else "99"
                raw_id = parts[1].lower() if len(parts) > 1 else folder.lower()
                clean_id = raw_id.replace(" ", "_").replace("-", "_")
                if clean_id not in seen:
                    seen.add(clean_id)
                    cards.append({
                        "id": clean_id,
                        "dir": folder,
                        "num": num
                    })
    return cards

def main():
    with open(DEFINITIONS_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        
    # First, let's parse existing JS card ids
    existing_ids = set(re.findall(r"\bid:\s*['\"]([^'\"]+)['\"]", content))
    
    # We will read lines to segment card library
    lines = content.splitlines(keepends=True)
    output_lines = []
    in_card = False
    card_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Check start of card
        if not in_card and line.startswith("    {"):
            in_card = True
            card_lines = [line]
            continue
            
        if in_card:
            card_lines.append(line)
            # Check end of card
            if line.startswith("    },") or line.startswith("    }"):
                in_card = False
                obj_str = "".join(card_lines)
                id_match = re.search(r"\bid:\s*['\"]([^'\"]+)['\"]", obj_str)
                num_match = re.search(r"\bnum:\s*['\"]([^'\"]+)['\"]", obj_str)
                
                if id_match and num_match:
                    card_id = id_match.group(1)
                    num = num_match.group(1)
                    
                    whitelisted_card_ids = set(c["id"] for c in CARD_WHITELIST)
                    is_functional = card_id in whitelisted_card_ids
                        
                    existing_ids.add(card_id)
                    # Find info.yaml folder
                    folder_name = ""
                    yaml_path = ""
                    # Search both releases and external folders
                    found = False
                    
                    # 1. search releases/
                    releases_dir = "/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/deps/Workshop_Computer/releases"
                    for folder in os.listdir(releases_dir):
                        if folder.startswith(num + "_"):
                            folder_name = folder
                            yaml_path = os.path.join(releases_dir, folder, "info.yaml")
                            found = True
                            break
                            
                    # 2. search external/
                    if not found:
                        external_dir = "/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/deps/external"
                        if os.path.exists(external_dir):
                            for folder in os.listdir(external_dir):
                                if folder.startswith(num + "_") or folder.endswith(card_id):
                                    folder_name = folder
                                    yaml_path = os.path.join(external_dir, folder, "info.yaml")
                                    break
                                
                    yaml_data = parse_yaml(yaml_path)
                    creator = yaml_data["creator"] or "Music Thing Modular"
                    lic = yaml_data["license"]
                    repo = yaml_data["repository"]
                    
                    if folder_name and not repo:
                        if "external" in yaml_path:
                            repo = f"https://github.com/vincentltm/Workshop_Computer_VCV/tree/main/deps/external/{folder_name}"
                        else:
                            repo = f"https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/{folder_name}"
                            
                    if not lic:
                        creator_lower = creator.lower()
                        if "chris johnson" in creator_lower or "tom whitwell" in creator_lower or "music thing" in creator_lower:
                            lic = "MIT"
                            
                    # Build labels dictionary
                    labels_lines = []
                    for k, v in yaml_data["inputs"].items():
                        escaped_v = v.replace("'", "\\'")
                        labels_lines.append(f"            '{k}': '{escaped_v}'")
                    for k, v in yaml_data["outputs"].items():
                        escaped_v = v.replace("'", "\\'")
                        labels_lines.append(f"            '{k}': '{escaped_v}'")
                        
                    labels_str = "{\n" + ",\n".join(labels_lines) + "\n        }" if labels_lines else "{}"

                    # Build layers dictionary
                    layers_data = parse_knob_layers(yaml_path)
                    layers_str = ""
                    if layers_data:
                        layers_lines = []
                        for z_mode, knobs in layers_data.items():
                            knob_lines = []
                            for k, v in knobs.items():
                                escaped_v = v.replace("'", "\\'")
                                knob_lines.append(f"                '{k}': '{escaped_v}'")
                            knobs_str = "{\n" + ",\n".join(knob_lines) + "\n            }"
                            layers_lines.append(f"            '{z_mode}': {knobs_str}")
                        layers_str = "{\n" + ",\n".join(layers_lines) + "\n        }"
                    else:
                        layers_str = "{}"

                    cleaned_lines = []
                    closing_line = card_lines[-1]
                    if closing_line.strip() == "}":
                        closing_line = "    },\n"
                    
                    in_labels = False
                    in_layers = False
                    brace_depth = 0
                    for l in card_lines[:-1]:
                        if re.search(r"\b(creator|license|repository):\s*['\"]", l):
                            continue
                        
                        if not in_labels and not in_layers:
                            if "labels:" in l:
                                if "{" in l and "}" in l: # single-line
                                    continue
                                in_labels = True
                                brace_depth = l.count("{") - l.count("}")
                                continue
                            if "layers:" in l:
                                if "{" in l and "}" in l: # single-line
                                    continue
                                in_layers = True
                                brace_depth = l.count("{") - l.count("}")
                                continue
                            cleaned_lines.append(l)
                        else:
                            brace_depth += l.count("{") - l.count("}")
                            if brace_depth <= 0:
                                in_labels = False
                                in_layers = False
                        
                    last_idx = -1
                    for idx in range(len(cleaned_lines)-1, -1, -1):
                        if cleaned_lines[idx].strip() and not cleaned_lines[idx].strip().endswith("{"):
                            last_idx = idx
                            break
                    if last_idx != -1:
                        if not cleaned_lines[last_idx].rstrip().endswith(","):
                            cleaned_lines[last_idx] = cleaned_lines[last_idx].rstrip().rstrip(",") + ",\n"
                            
                    escaped_creator = creator.replace("'", "\\'")
                    indent = "        "
                    new_fields = f"{indent}labels: {labels_str},\n{indent}layers: {layers_str},\n{indent}creator: '{escaped_creator}',\n{indent}license: '{lic}',\n{indent}repository: '{repo}'\n"
                    cleaned_lines.append(new_fields)
                    cleaned_lines.append(closing_line)
                    
                    output_lines.extend(cleaned_lines)
                else:
                    output_lines.extend(card_lines)
            continue
            
        # Check if we are at the closing brace of CARD_LIBRARY array
        if stripped == "];" and len(output_lines) > 0:
            whitelisted_card_ids = set(c["id"] for c in CARD_WHITELIST)
            for card in discover_all_hardware_cards():
                if card["id"] not in existing_ids:
                    is_functional = card["id"] in whitelisted_card_ids
                    print(f"Adding new card to definitions (functional={is_functional}): {card['id']}")
                    
                    # Find info.yaml
                    folder_name = ""
                    yaml_path = ""
                    found = False
                    
                    # 1. search releases/
                    releases_dir = "/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/deps/Workshop_Computer/releases"
                    for folder in os.listdir(releases_dir):
                        if folder.startswith(card["num"] + "_"):
                            folder_name = folder
                            yaml_path = os.path.join(releases_dir, folder, "info.yaml")
                            found = True
                            break
                            
                    # 2. search external/
                    if not found:
                        external_dir = "/Users/vmaurer/Music/Workshop_VCV_Dev/Workshop_Computer_VCV/deps/external"
                        if os.path.exists(external_dir):
                            for folder in os.listdir(external_dir):
                                if folder.startswith(card["num"] + "_") or folder.endswith(card["id"]):
                                    folder_name = folder
                                    yaml_path = os.path.join(external_dir, folder, "info.yaml")
                                    break
                                    
                    yaml_data = parse_yaml(yaml_path)
                    
                    name = yaml_data["name"] or card["id"].replace("_", " ").title()
                    desc = yaml_data["desc"] or "Workshop Computer Card"
                    creator = yaml_data["creator"] or "Music Thing Modular"
                    lic = yaml_data["license"]
                    repo = yaml_data["repository"]
                    
                    if folder_name and not repo:
                        if "external" in yaml_path:
                            repo = f"https://github.com/vincentltm/Workshop_Computer_VCV/tree/main/deps/external/{folder_name}"
                        else:
                            repo = f"https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/{folder_name}"
                            
                    if not lic:
                        creator_lower = creator.lower()
                        if "chris johnson" in creator_lower or "tom whitwell" in creator_lower or "music thing" in creator_lower:
                            lic = "MIT"
                            
                    # Build labels dictionary
                    labels_lines = []
                    for k, v in yaml_data["inputs"].items():
                        escaped_v = v.replace("'", "\\'")
                        labels_lines.append(f"            '{k}': '{escaped_v}'")
                    for k, v in yaml_data["outputs"].items():
                        escaped_v = v.replace("'", "\\'")
                        labels_lines.append(f"            '{k}': '{escaped_v}'")
                        
                    labels_str = "{\n" + ",\n".join(labels_lines) + "\n        }" if labels_lines else "{}"

                    # Build layers dictionary
                    layers_data = parse_knob_layers(yaml_path)
                    layers_str = ""
                    if layers_data:
                        layers_lines = []
                        for z_mode, knobs in layers_data.items():
                            knob_lines = []
                            for k, v in knobs.items():
                                escaped_v = v.replace("'", "\\'")
                                knob_lines.append(f"                '{k}': '{escaped_v}'")
                            knobs_str = "{\n" + ",\n".join(knob_lines) + "\n            }"
                            layers_lines.append(f"            '{z_mode}': {knobs_str}")
                        layers_str = "{\n" + ",\n".join(layers_lines) + "\n        }"
                    else:
                        layers_str = "{}"
                    
                    escaped_creator = creator.replace("'", "\\'")
                    escaped_desc = desc.replace("'", "\\'").replace("\n", " ")
                    escaped_name = name.replace("'", "\\'")
                    
                    # Ensure preceding element has trailing comma
                    last_comma_idx = -1
                    for idx in range(len(output_lines)-1, -1, -1):
                        if output_lines[idx].strip() == "}":
                            last_comma_idx = idx
                            break
                    if last_comma_idx != -1:
                        output_lines[last_comma_idx] = "    },\n"
                        
                    new_card_obj = f"""    {{
        id: '{card["id"]}',
        name: '{escaped_name}',
        num: '{card["num"]}',
        desc: '{escaped_desc}',
        class: 'WasmCardWrapper',
        category: 'Utility',
        labels: {labels_str},
        layers: {layers_str},
        creator: '{escaped_creator}',
        license: '{lic}',
        repository: '{repo}'
    }},
"""
                    output_lines.append(new_card_obj)
            
        output_lines.append(line)
        
    full_text = "".join(output_lines)
    full_text = re.sub(r"(\n\s*\})\s*(\n\s*\{)", r"\1,\2", full_text)
    
    with open(DEFINITIONS_PATH, "w", encoding="utf-8") as f:
        f.write(full_text)
        
    print("Successfully updated CardDefinitions.js line-by-line!")

if __name__ == "__main__":
    main()
