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

def parse_yaml(path):
    result = {
        "name": "",
        "desc": "",
        "creator": "",
        "license": "",
        "repository": "",
        "inputs": {},
        "outputs": {}
    }
    if not os.path.exists(path):
        return result
        
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    lines = content.splitlines()
    current_section = None
    current_subsection = None
    current_item = None
    
    is_multiline_desc = False
    desc_lines = []
    desc_indent = None
    
    for line in lines:
        line_rstrip = line.rstrip()
        stripped = line_rstrip.strip()
        
        if is_multiline_desc:
            if not stripped:
                desc_lines.append("")
                continue
            indent = len(line_rstrip) - len(line_rstrip.lstrip())
            if indent > 0:
                if desc_indent is None:
                    desc_indent = indent
                content_line = line_rstrip[desc_indent:] if len(line_rstrip) >= desc_indent else line_rstrip.lstrip()
                desc_lines.append(content_line)
                continue
            else:
                is_multiline_desc = False
                result["desc"] = " ".join(desc_lines).strip()
        
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line_rstrip) - len(line_rstrip.lstrip())
        
        if indent == 0 and ":" in stripped:
            k, v = stripped.split(":", 1)
            k = k.strip().lower()
            v = v.strip().strip("'\"")
            if k == "name":
                result["name"] = v
            elif k in ["description", "summary"]:
                if v == "|" or v == ">" or v == ">-" or v == "|-":
                    is_multiline_desc = True
                    desc_lines = []
                    desc_indent = None
                else:
                    result["desc"] = v
            elif k == "creator":
                result["creator"] = v
            elif k == "license":
                result["license"] = v
            elif k == "repository":
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
            
        if indent == 4 and stripped.startswith("-"):
            item_content = stripped[1:].strip()
            if current_subsection in ["inputs", "outputs"]:
                current_item = {}
                if ":" in item_content:
                    k, v = item_content.split(":", 1)
                    current_item[k.strip().lower()] = v.strip().strip("'\"")
            continue
            
        if indent >= 6 and ":" in stripped and current_item is not None:
            k, v = stripped.split(":", 1)
            k = k.strip().lower()
            v = v.strip().strip("'\"")
            current_item[k] = v
            
            # Map item
            iid = current_item.get("id", "").lower().replace("_", "").replace(" ", "")
            name = current_item.get("name", "")
            if iid and name:
                if current_subsection == "inputs" and iid in in_map_js:
                    result["inputs"][in_map_js[iid]] = name
                elif current_subsection == "outputs" and iid in out_map_js:
                    result["outputs"][out_map_js[iid]] = name
            continue
            
    if is_multiline_desc:
        result["desc"] = " ".join(desc_lines).strip()
        
    return result

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
                    
                    # Find info.yaml folder
                    folder_name = ""
                    yaml_path = ""
                    # Search both releases and external folders
                    found = False
                    
                    # 1. search releases/
                    releases_dir = "/Users/vmaurer/Music/Workshop_Computer/releases"
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
                            
                    cleaned_lines = []
                    closing_line = card_lines[-1]
                    
                    for l in card_lines[:-1]:
                        if re.search(r"\b(creator|license|repository):\s*['\"]", l):
                            continue
                        cleaned_lines.append(l)
                        
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
                    new_fields = f"{indent}creator: '{escaped_creator}',\n{indent}license: '{lic}',\n{indent}repository: '{repo}'\n"
                    cleaned_lines.append(new_fields)
                    cleaned_lines.append(closing_line)
                    
                    output_lines.extend(cleaned_lines)
                else:
                    output_lines.extend(card_lines)
            continue
            
        # Check if we are at the closing brace of CARD_LIBRARY array
        if stripped == "];" and len(output_lines) > 0:
            # We want to insert any missing cards before the array closes!
            for card in CARD_WHITELIST:
                if card["id"] not in existing_ids:
                    print(f"Adding new card to definitions: {card['id']}")
                    
                    # Find info.yaml
                    folder_name = ""
                    yaml_path = ""
                    found = False
                    
                    # 1. search releases/
                    releases_dir = "/Users/vmaurer/Music/Workshop_Computer/releases"
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
        creator: '{escaped_creator}',
        license: '{lic}',
        repository: '{repo}'
    }}
"""
                    output_lines.append(new_card_obj)
            
        output_lines.append(line)
        
    with open(DEFINITIONS_PATH, "w", encoding="utf-8") as f:
        f.writelines(output_lines)
        
    print("Successfully updated CardDefinitions.js line-by-line!")

if __name__ == "__main__":
    main()
