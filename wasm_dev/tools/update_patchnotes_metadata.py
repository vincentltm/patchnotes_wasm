import os
import re

# Paths
PATCHNOTES_DIR = "/Users/vmaurer/Music/Workshop_VCV_Dev/patchnotes/patch_notes"
RELEASES_DIR = "/Users/vmaurer/Music/Workshop_Computer/releases"
DEFINITIONS_PATH = os.path.join(PATCHNOTES_DIR, "js/cards/CardDefinitions.js")

# Simple YAML parser for creator, license, repository
def parse_yaml(path):
    result = {"creator": "", "license": "", "repository": ""}
    if not os.path.exists(path):
        return result
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Parse line by line
    for line in content.splitlines():
        line_rstrip = line.rstrip()
        stripped = line_rstrip.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line_rstrip) - len(line_rstrip.lstrip())
        if indent == 0 and ":" in stripped:
            k, v = stripped.split(":", 1)
            k = k.strip().lower()
            v = v.strip().strip("'\"")
            if k == "creator":
                result["creator"] = v
            elif k == "license":
                result["license"] = v
            elif k == "repository":
                result["repository"] = v
    return result

def main():
    with open(DEFINITIONS_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
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
                    
                    # Find corresponding info.yaml
                    folder_name = ""
                    yaml_path = ""
                    for folder in os.listdir(RELEASES_DIR):
                        if folder.startswith(num + "_"):
                            folder_name = folder
                            yaml_path = os.path.join(RELEASES_DIR, folder, "info.yaml")
                            break
                            
                    # Parse yaml
                    yaml_data = parse_yaml(yaml_path)
                    creator = yaml_data["creator"] or "Music Thing Modular"
                    lic = yaml_data["license"]
                    repo = yaml_data["repository"]
                    
                    if folder_name and not repo:
                        repo = f"https://github.com/TomWhitwell/Workshop_Computer/tree/main/releases/{folder_name}"
                    if not lic:
                        creator_lower = creator.lower()
                        if "chris johnson" in creator_lower or "tom whitwell" in creator_lower or "music thing" in creator_lower:
                            lic = "MIT"
                            
                    # Remove any existing creator/license/repository fields from card_lines
                    cleaned_lines = []
                    closing_line = card_lines[-1]
                    
                    for l in card_lines[:-1]:
                        if re.search(r"\b(creator|license|repository):\s*['\"]", l):
                            continue
                        cleaned_lines.append(l)
                        
                    # Remove trailing comma on the last data line if we are adding new fields
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
            
        output_lines.append(line)
        
    with open(DEFINITIONS_PATH, "w", encoding="utf-8") as f:
        f.writelines(output_lines)
        
    print("Successfully updated CardDefinitions.js line-by-line!")

if __name__ == "__main__":
    main()
