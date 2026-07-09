import os
import re
import shutil

VCV_WORKSPACE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../Workshop_Computer_VCV"))

CARDS = [
    "simple_midi", "turing_machine", "byo_benjolin", "chord_blimey", "usb_audio_bridge",
    "bumpers", "bytebeat", "divcom", "goldfish",
    "am_coupler", "noisebox", "cvmod", "mlrws", "chord_organ",
    "reverb", "resonator", "sheep", "slowmod", "crafted_volts",
    "utility_pair", "siren", "eighties_bass", "cirpy_wavetable", "esp",
    "vink", "drumdrum", "dual_quant", "freq_shift",
    "od", "knots", "blackbird", "backyard_rain", "birds",
    "bends", "rompler", "nzt", "modes", "flux",
    "grains", "glitter", "tapegrade", "fifths", "krell",
    "glitch", "lochovibes", "bitphase", "markov", "voices_of_sid",
    "stretchcore", "trace", "degenerator", "motorik", "wild_pebble",
    "talker", "computer_grids", "tesserae", "duo_midi", "toolbox",
    "clockwork", "castle_process", "west_coast_lpg", "origami", "cosmik_c1zzl3",
    "fr330hfr33", "pantograph", "chorgan", "turing_matrix", "offair2"
]

def preprocess_main_loops(src_path, content):
    filename = os.path.basename(src_path)
    
    # ── BLACKBIRD / DUO MIDI / KRELL ──
    if filename in ["Card_blackbird.cpp", "Card_duo_midi.cpp", "Card_krell.cpp"]:
        # 1. CDC wait loop bypass
        cdc_wait_pattern = r'\{\s*absolute_time_t\s+until\s*=\s*make_timeout_time_ms\(1500\);\s*while\s*\(\s*!tud_cdc_connected\(\)[^{}]+.*?\}\s*\}'
        content = re.sub(cdc_wait_pattern, '// Wait bypassed for WASM', content, flags=re.DOTALL)
        
        # 2. sleep_ms(500) bypass
        content = content.replace('sleep_ms(500);', '// sleep bypassed for WASM')
        
        # Map welcome_sent and welcome_time declarations to instance variables
        content = content.replace("bool welcome_sent = false;", "#ifndef __EMSCRIPTEN__\n        bool welcome_sent = false;\n#endif")
        content = content.replace("absolute_time_t welcome_time = make_timeout_time_ms(1500);", "#ifdef __EMSCRIPTEN__\n        if (t_instance->welcome_time_val == 0) {\n            t_instance->welcome_time_val = make_timeout_time_ms(1500);\n        }\n#else\n        absolute_time_t welcome_time = make_timeout_time_ms(1500);\n#endif")
        
        # Map g_force_all_leds_armed and g_force_all_leds_on_until_us to instance variables
        content = content.replace("static volatile bool g_force_all_leds_armed = false;", "#ifndef __EMSCRIPTEN__\nstatic volatile bool g_force_all_leds_armed = false;\n#endif")
        content = content.replace("static volatile uint32_t g_force_all_leds_on_until_us = 0;", "#ifndef __EMSCRIPTEN__\nstatic volatile uint32_t g_force_all_leds_on_until_us = 0;\n#endif")

        # 3. MainControlLoop while(1) lambda wrapping
        idx = content.find("void MainControlLoop()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    loop_body = loop_body.replace("sleep_us(100);", "#ifndef __EMSCRIPTEN__\n            sleep_us(100);\n#endif")
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
        g_wasm_background_tick = [this]() {{
            {loop_body}
        }};
#else
        while (1) {{
            {loop_body}
        }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]
        
        ns_name = "Card_Blackbird" if filename == "Card_blackbird.cpp" else \
                  ("Card_DuoMidi" if filename == "Card_duo_midi.cpp" else "Card_Krell")

        content = content.replace(f"namespace {ns_name} {{", f"""namespace {ns_name} {{
    class BlackbirdCrow;
#ifdef __EMSCRIPTEN__
    extern BlackbirdCrow* crow_ptr;
    #define welcome_sent (t_instance->welcome_sent_val)
    #define welcome_time (t_instance->welcome_time_val)
    #define g_force_all_leds_armed (t_instance->g_force_all_leds_armed_val)
    #define g_force_all_leds_on_until_us (t_instance->g_force_all_leds_on_until_us_val)
#endif""")

        # 5. Heap allocation for blackbird, duo_midi, krell to avoid static deletion crash on reset
        content = content.replace("BlackbirdCrow crow;", f"""#ifdef __EMSCRIPTEN__
BlackbirdCrow* crow_ptr = nullptr;
#define crow (*::{ns_name}::crow_ptr)
#else
BlackbirdCrow crow;
#endif""")
        
        content = content.replace("    ~BlackbirdCrow() {\n        if (lua_manager) {\n            delete lua_manager;\n        }\n    }", f"""    ~BlackbirdCrow() {{
        if (lua_manager) {{
            delete lua_manager;
        }}
#ifdef __EMSCRIPTEN__
        crow_ptr = nullptr;
#endif
    }}""")

        content = content.replace("    void run_card() {\n        is_core1_thread = false;", f"""    void run_card() {{
        is_core1_thread = false;
#ifdef __EMSCRIPTEN__
        {ns_name}::crow_ptr = new {ns_name}::BlackbirdCrow();
        {ns_name}::crow_ptr->is_heap_allocated = true;
#endif""")

    # ── CHORD BLIMEY ──
    elif filename == "Card_chord_blimey.cpp":
        idx = content.find("int main()")
        if idx != -1:
            while_idx = content.find("while (true)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    loop_body = loop_body.replace("continue;", "return;")
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = []() {{
        {loop_body}
    }};
#else
    while (true) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── BYTEBEAT ──
    elif filename == "Card_bytebeat.cpp":
        idx = content.find("void BackgroundLoop() override")
        if idx != -1:
            brace_pos = content.find("{", idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                
                replacement = """{
#ifdef __EMSCRIPTEN__
        static bool init_done = false;
        if (!init_done) {
            init_done = true;
            eeRead(0);
            eeRead(100);
            eeRead(200);
            eeRead(300);
            eeRead(400);
            eeRead(500);
        }
#else
        // Read stored formulas on startup
        eeRead(0);
        eeRead(100);
        eeRead(200);
        eeRead(300);
        eeRead(400);
        eeRead(500);

        while (!g_cancellation_requested.load(std::memory_order_relaxed)) {
            int c = getchar_timeout_us(1000);
            if (c != PICO_ERROR_TIMEOUT) {
                if (c == '\\n' || c == '\\r') {
                    if (!serialInput.empty()) {
                        process_serial_line(serialInput);
                        serialInput = "";
                    }
                } else if (c >= 32 && c < 127) {
                    serialInput += (char)c;
                }
            }
        }
#endif
    }"""
                content = content[:brace_pos] + replacement + content[closing_brace_idx+1:]

    # ── DEGENERATOR ──
    elif filename == "Card_degenerator.cpp":
        content = content.replace("absolute_time_t last_flash_check = get_absolute_time();", "static absolute_time_t last_flash_check = get_absolute_time();")
        idx = content.find("int main()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    loop_body = loop_body.replace("sleep_ms(10);", "#ifndef __EMSCRIPTEN__\n        sleep_ms(10);\n#endif")
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = []() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── ROMPLER ──
    elif filename == "Card_rompler.cpp":
        idx = content.find("int main()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    loop_body = loop_body.replace("sleep_us(250);", "#ifndef __EMSCRIPTEN__\n    sleep_us(250);\n#endif")
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = []() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── TURING MACHINE ──
    elif filename == "Card_turing_machine.cpp":
        content = re.sub(
            r'while\s*\(\s*!multicore_fifo_rvalid\(\)\s*\)\s*\{\s*sleep_ms\(1\);\s*\}',
            '#ifndef __EMSCRIPTEN__\n    while (!multicore_fifo_rvalid()) { sleep_ms(1); }\n#endif',
            content
        )
        
        # SwitchDown wait loop
        switch_down_idx = content.find("while (gApp->SwitchDown())")
        if switch_down_idx != -1:
            brace_pos = content.find("{", switch_down_idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                content = (
                    content[:switch_down_idx] +
                    "#ifndef __EMSCRIPTEN__\n" +
                    content[switch_down_idx : closing_brace_idx+1] +
                    "\n#endif" +
                    content[closing_brace_idx+1:]
                )
                
        # Main while(true) loop
        idx = content.find("int main()")
        if idx != -1:
            while_idx = content.find("while (true)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    loop_body_clean = []
                    for line in loop_body.split('\n'):
                        if "sleep_until" in line or "next =" in line:
                            loop_body_clean.append("// " + line)
                        else:
                            loop_body_clean.append(line)
                    loop_body = '\n'.join(loop_body_clean)
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = []() {{
        {loop_body}
    }};
#else
    while (true) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── TWISTS ──
    elif filename == "Card_twists.cpp":
        idx = content.find("int main()")
        if idx != -1:
            while_idx = content.find("while (!g_cancellation_requested", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = []() {{
        {loop_body}
    }};
#else
    while (!g_cancellation_requested.load(std::memory_order_relaxed)) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── DRUMDRUM ──
    elif filename == "Card_drumdrum.cpp":
        # 1. Rewrite run_host_loop()'s while (true) loop
        idx = content.find("static void run_host_loop(void)")
        if idx != -1:
            while_idx = content.find("while (true)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        {loop_body}
    }};
#else
    while (true) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

        # 2. Rewrite run_device_loop()'s while (true) loop
        idx = content.find("static void run_device_loop(void)")
        if idx != -1:
            while_idx = content.find("while (true)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        {loop_body}
    }};
#else
    while (true) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

        # 3. Rewrite core1_entry()'s while (true) loop
        idx = content.find("void core1_entry(void)")
        if idx != -1:
            while_idx = content.find("while (true)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        {loop_body}
    }};
#else
    while (true) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── FLUX ──
    elif filename == "Card_flux.cpp":
        idx = content.find("void __not_in_flash_func(core1_entry)()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    loop_body = loop_body.replace("busy_wait_us_32(1000);", "")
                    loop_body = loop_body.replace("busy_wait_us_32(10);", "")
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── GRAINS ──
    elif filename == "Card_grains.cpp":
        idx = content.find("void __not_in_flash_func(core1_worker)()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    loop_body = loop_body.replace("continue;", "return;")
                    
                    # Wrap while(core1_paused) in core1_worker under EMSCRIPTEN
                    loop_body = re.sub(
                        r'while\s*\(\s*core1_paused\s*\)\s*\{\s*\}',
                        '#ifndef __EMSCRIPTEN__\n      while (core1_paused) {}\n#endif',
                        loop_body
                    )
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

        # Wrap while (!core1_is_paused) in BackgroundLoop
        bg_idx = content.find("void BackgroundLoop()")
        if bg_idx != -1:
            while_bg = content.find("while (!core1_is_paused)", bg_idx)
            if while_bg != -1:
                brace_bg = content.find("{", while_bg)
                if brace_bg != -1:
                    brace_count = 1
                    curr_pos = brace_bg + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_bg = curr_pos - 1
                    while_body = content[while_bg:closing_bg+1]
                    content = content.replace(while_body, f"#ifndef __EMSCRIPTEN__\n      {while_body}\n#endif")


    # ── MLRWS ──
    elif filename == "Card_mlrws.cpp":
        mgr_idx = content.find("static void run_sample_manager_until_disconnect(uint8_t first_byte, bool resume_gridless)")
        if mgr_idx != -1:
            brace_pos = content.find("{", mgr_idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                
                content = (
                    content[:mgr_idx] +
                    "#ifndef __EMSCRIPTEN__\n" +
                    content[mgr_idx : closing_brace_idx+1] +
                    "\n#else\n\tstatic void run_sample_manager_until_disconnect(uint8_t first_byte, bool resume_gridless) {}\n#endif" +
                    content[closing_brace_idx+1:]
                )
                
        grid_idx = content.find("static void run_grid_device_until_disconnect(uint8_t first_byte)")
        if grid_idx != -1:
            brace_pos = content.find("{", grid_idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                
                content = (
                    content[:grid_idx] +
                    "#ifndef __EMSCRIPTEN__\n" +
                    content[grid_idx : closing_brace_idx+1] +
                    "\n#else\n\tstatic void run_grid_device_until_disconnect(uint8_t first_byte) {}\n#endif" +
                    content[closing_brace_idx+1:]
                )
                
        core1_idx = content.find("static void core1_entry()")
        if core1_idx != -1:
            brace_pos = content.find("{", core1_idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                
                replacement = """\n#ifdef __EMSCRIPTEN__
\t\tg_wasm_core1_tick = []() {
\t\t\tswitch (s_mode_) {
\t\t\tcase Mode::HostMLR:
\t\t\t\tmonome_ws_task();
\t\t\t\tmlr_io_task();
\t\t\t\tservice_panel_vu_leds_core1();
\t\t\t\tservice_grid_redraw_core1();
\t\t\t\tbreak;
\t\t\tcase Mode::DeviceMLR:
\t\t\t\ttud_task();
\t\t\t\tmonome_ws_task();
\t\t\t\tmlr_io_task();
\t\t\t\tservice_panel_vu_leds_core1();
\t\t\t\tservice_grid_redraw_core1();
\t\t\t\tbreak;
\t\t\tcase Mode::DeviceGridless:
\t\t\t\ttud_task();
\t\t\t\tmlr_io_task();
\t\t\t\tbreak;
\t\t\tcase Mode::DeviceSampleMgr:
\t\t\t\ttud_task();
\t\t\t\tdevice_mode_task();
\t\t\t\tbreak;
\t\t\t}
\t\t};
\t\tswitch (s_mode_) {
\t\tcase Mode::HostMLR:
\t\t\tboard_init();
\t\t\ttusb_init();
\t\t\tbreak;
\t\tcase Mode::DeviceGridless:
\t\t\tdevice_mode_init();
\t\t\tbreak;
\t\tcase Mode::DeviceSampleMgr:
\t\t\ts_sample_mgr_active_ = true;
\t\t\t__dmb();
\t\t\tbreak;
\t\tdefault:
\t\t\tbreak;
\t\t}
#else
""" + content[brace_pos+1 : closing_brace_idx] + "\n#endif\n"
                content = content[:brace_pos+1] + replacement + content[closing_brace_idx:]

    # ── RESONATOR ──
    elif filename == "Card_resonator.cpp":
        idx = content.find("void core1_serial_handler()")
        if idx != -1:
            while_idx = content.find("while (true)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        if (g_resonator) {{
            g_resonator->checkPendingFlashSave();
        }}
    }};
#else
    while (true) {{
        int c = getchar_timeout_us(10000);  // 10ms timeout
        if (c == PICO_ERROR_TIMEOUT) {{
            // Check if Core 0 requested a flash save (e.g. long-press reset)
            g_resonator->checkPendingFlashSave();
            continue;
        }}
        if (c == '\\n' || c == '\\r') {{
            if (linePos > 0) {{
                lineBuf[linePos] = '\\0';
                g_resonator->handleSerialCommand(lineBuf);
                linePos = 0;
            }}
        }} else if (linePos < 127) {{
            lineBuf[linePos++] = (char)c;
        }}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── REVERB ──
    elif filename == "Card_reverb.cpp":
        content = content.replace(
            "while (runADCMode != RUN_ADC_MODE_ADC_STOPPED) {}",
            "#ifndef __EMSCRIPTEN__\n\twhile (runADCMode != RUN_ADC_MODE_ADC_STOPPED) {}\n#endif"
        )
        content = content.replace(
            "bool isHost;",
            "#ifdef __EMSCRIPTEN__\n\tstatic bool isHost;\n#else\n\tbool isHost;\n#endif"
        )
        # Rewrite usb_worker()'s while (1) loop
        usb_idx = content.find("void usb_worker()")
        if usb_idx != -1:
            while_idx = content.find("while (1)", usb_idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = []() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

        # Rewrite audio_worker()'s while (1) loop
        idx = content.find("void __not_in_flash_func(audio_worker)()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        if (runADCMode == RUN_ADC_MODE_REQUEST_ADC_RESTART)
        {{
            runADCMode = RUN_ADC_MODE_RUNNING;

            dma_hw->ints0 = 1u << adc_dma; // reset adc interrupt flag
            dma_channel_set_write_addr(adc_dma, ADC_Buffer[dmaPhase], true); // start writing into new buffer
            dma_channel_set_read_addr(spi_dma, SPI_Buffer[dmaPhase], true); // start reading from new buffer

            adc_set_round_robin(0);
            adc_select_input(0);
            adc_set_round_robin(0b0001111U);
            adc_run(true);
        }}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── COMPULIDEAN ──
    elif filename == "Card_compulidean.cpp":
        run_card_idx = content.find("void run_card()")
        if run_card_idx != -1:
            brace_pos = content.find("{", run_card_idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                
                replacement = """{
        is_core1_thread = false;
        try {
            auto& card = *(new CompulideanCard());
            ComputerCard::thisptr = &card;
            if (t_instance) {
                t_instance->card_ptr = &card;
                t_instance->g_dsp_ready = true;
            }
        } catch (const ThreadExitException& e) {
            // Thread terminated safely
        }
    }"""
                content = content[:brace_pos] + replacement + content[closing_brace_idx+1:]

    # ── COMPUTER GRIDS ──
    elif filename == "Card_computer_grids.cpp":
        idx = content.find("static void usb_core0_loop(GridsCard* card)")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = [card, is_host]() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── BENDS ──
    elif filename == "Card_bends.cpp":
        idx = content.find("void BendsCard::run_core0_ui_loop()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_background_tick = [this]() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── KNOTS ──
    elif filename == "Card_knots.cpp":
        idx = content.find("void ControlAndMIDIWorkerCore()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = [this]() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── STRETCHCORE ──
    elif filename == "Card_stretchcore.cpp":
        idx = content.find("void breaky_sample_manager_core()")
        if idx != -1:
            brace_pos = content.find("{", idx)
            if brace_pos != -1:
                brace_count = 1
                curr_pos = brace_pos + 1
                while brace_count > 0 and curr_pos < len(content):
                    if content[curr_pos] == '{':
                        brace_count += 1
                    elif content[curr_pos] == '}':
                        brace_count -= 1
                    curr_pos += 1
                closing_brace_idx = curr_pos - 1
                
                content = (
                    content[:idx] +
                    "#ifndef __EMSCRIPTEN__\n" +
                    content[idx : closing_brace_idx+1] +
                    "\n#else\nvoid breaky_sample_manager_core() {}\n#endif" +
                    content[closing_brace_idx+1:]
                )

    # ── TWISTS USB WORKER (Braids) ──
    elif filename == "Card_twists_braids_usb_worker_cc.cpp":
        idx = content.find("void UsbWorker::Run()")
        if idx != -1:
            while_idx = content.find("while(1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = [this]() {{
        {loop_body}
    }};
#else
    while(1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

    # ── MODES ──
    elif filename == "Card_modes.cpp":
        content = content.replace("uint32_t prng_seed = 0x12345678;", "static uint32_t prng_seed = 0x12345678;")
        content = content.replace("int32_t random_pitch = 0;", "static int32_t random_pitch = 0;")
        content = content.replace("int32_t random_timbre = 0;", "static int32_t random_timbre = 0;")
        
        idx = content.find("void __not_in_flash_func(core1_dsp_loop)()")
        if idx != -1:
            while_idx = content.find("while (1)", idx)
            if while_idx != -1:
                brace_pos = content.find("{", while_idx)
                if brace_pos != -1:
                    brace_count = 1
                    curr_pos = brace_pos + 1
                    while brace_count > 0 and curr_pos < len(content):
                        if content[curr_pos] == '{':
                            brace_count += 1
                        elif content[curr_pos] == '}':
                            brace_count -= 1
                        curr_pos += 1
                    closing_brace_idx = curr_pos - 1
                    loop_body = content[brace_pos+1 : closing_brace_idx]
                    
                    loop_body = loop_body.replace(
                        "if (pause_core1) {\n      core1_is_paused = true;\n      while (pause_core1) {\n        tight_loop_contents();\n      }\n      core1_is_paused = false;\n    }",
                        "#ifndef __EMSCRIPTEN__\n    if (pause_core1) {\n      core1_is_paused = true;\n      while (pause_core1) {\n        tight_loop_contents();\n      }\n      core1_is_paused = false;\n    }\n#else\n    if (pause_core1) { core1_is_paused = true; return; }\n    core1_is_paused = false;\n#endif"
                    )
                    loop_body = loop_body.replace(
                        "if (!multicore_fifo_rvalid()) {\n      tight_loop_contents();\n      continue;\n    }",
                        "#ifndef __EMSCRIPTEN__\n    if (!multicore_fifo_rvalid()) {\n      tight_loop_contents();\n      continue;\n    }\n#else\n    if (!multicore_fifo_rvalid()) return;\n#endif"
                    )
                    # Replace any remaining bare continue; (e.g. FIFO_FLAG_ACTIVE check)
                    # In a cooperative lambda, continue; is invalid — use return; instead
                    loop_body = loop_body.replace("      continue;\n    }", "      return;\n    }")
                    loop_body = loop_body.replace("      continue;\n  }", "      return;\n  }")
                    loop_body = loop_body.replace("    continue;\n  }", "    return;\n  }")
                    loop_body = loop_body.replace("    continue;\n}", "    return;\n}")
                    
                    replacement = f"""#ifdef __EMSCRIPTEN__
    g_wasm_core1_tick = []() {{
        {loop_body}
    }};
#else
    while (1) {{
        {loop_body}
    }}
#endif"""
                    content = content[:while_idx] + replacement + content[closing_brace_idx+1:]

        # Wrap while (!core1_is_paused) in save_global_settings and save_preset
        for func_name in ["save_global_settings", "save_preset"]:
            f_idx = content.find(func_name)
            if f_idx != -1:
                w_idx = content.find("while (!core1_is_paused)", f_idx)
                if w_idx != -1:
                    brace_w = content.find("{", w_idx)
                    if brace_w != -1:
                        brace_count = 1
                        curr_pos = brace_w + 1
                        while brace_count > 0 and curr_pos < len(content):
                            if content[curr_pos] == '{':
                                brace_count += 1
                            elif content[curr_pos] == '}':
                                brace_count -= 1
                            curr_pos += 1
                        closing_w = curr_pos - 1
                        while_body = content[w_idx:closing_w+1]
                        content = content.replace(while_body, f"#ifndef __EMSCRIPTEN__\n  {while_body}\n#endif")

                    
    # ── POST-PASS: fix bare continue; inside WASM lambdas ──
    # Any continue; inside a g_wasm_*_tick = [](){...}; lambda is illegal C++.
    # We scan the content, detect lambda bodies, and replace continue; → return;
    # This handles any card-specific cases not caught by the targeted rules above.
    content = _fix_continues_in_wasm_lambdas(content)

    # Post-pass for BackgroundLoop blocking whiles removed (replaced with explicit card rules)

    # ── POST-PASS: guard blocking while(1) in embedded library code ──
    # Some cards embed library C files (MIDI USB helpers, etc.) that contain their own
    # while(1) event loops. These are never run from Run() but get called from ProcessSample
    # or background ticks. Guard them so they return immediately under EMSCRIPTEN.
    content = _fix_library_blocking_whiles(content)

    return content


def _fix_continues_in_wasm_lambdas(content: str) -> str:
    """Replace bare `continue;` with `return;` inside g_wasm_*_tick lambda bodies.
    
    The approach: scan for `g_wasm_background_tick` or `g_wasm_core1_tick` = ...() {
    then brace-balance to find the lambda end, then replace continue; with return;
    only within that range — but skip any nested #ifndef __EMSCRIPTEN__ blocks where
    continue; is still valid (those run the actual while loop on real hardware).
    """
    for marker in ['g_wasm_background_tick', 'g_wasm_core1_tick']:
        search_start = 0
        while True:
            idx = content.find(marker, search_start)
            if idx == -1:
                break
            # Find the opening { of the lambda body
            assign_end = content.find('= []() {', idx)
            if assign_end == -1:
                assign_end = content.find('= [this]() {', idx)
            if assign_end == -1:
                assign_end = content.find('= [&]() {', idx)
            if assign_end == -1:
                search_start = idx + 1
                continue
            brace_open = content.find('{', assign_end)
            if brace_open == -1:
                search_start = idx + 1
                continue
            # Balance braces to find lambda end
            brace_count = 1
            pos = brace_open + 1
            while brace_count > 0 and pos < len(content):
                if content[pos] == '{':
                    brace_count += 1
                elif content[pos] == '}':
                    brace_count -= 1
                pos += 1
            lambda_end = pos  # exclusive
            
            lambda_body = content[brace_open+1:lambda_end-1]
            
            # Replace continue; that are NOT inside #ifndef __EMSCRIPTEN__ blocks
            fixed = _replace_continues_outside_ifndef(lambda_body)
            
            content = content[:brace_open+1] + fixed + content[lambda_end-1:]
            search_start = lambda_end
    return content


def _replace_continues_outside_ifndef(body: str) -> str:
    """Replace continue; → return; in `body`, but only outside #ifndef __EMSCRIPTEN__ guards."""
    lines = body.split('\n')
    result = []
    depth = 0  # nesting depth of #ifndef __EMSCRIPTEN__ blocks
    for line in lines:
        stripped = line.strip()
        if stripped == '#ifndef __EMSCRIPTEN__':
            depth += 1
            result.append(line)
        elif stripped == '#endif' and depth > 0:
            depth -= 1
            result.append(line)
        elif stripped == 'continue;' and depth == 0:
            # Replace bare continue; with return; (lambda-safe equivalent)
            result.append(line.replace('continue;', 'return;'))
        else:
            result.append(line)
    return '\n'.join(result)


def _fix_background_loop_blocking_whiles(content: str) -> str:
    """Neutralize blocking while loops inside BackgroundLoop() overrides.

    BackgroundLoop() is called cooperatively from the audio tick ~1ms.
    Any while(!cancellation_requested) or while(getchar...) inside it
    will spin forever under WASM and hang the audio thread.

    Strategy: find BackgroundLoop() bodies, detect any while(...) whose
    condition matches a blocking pattern, and replace it with an
    #ifdef __EMSCRIPTEN__ guard that executes only ONE iteration (drop the
    loop entirely — BackgroundLoop itself is called repeatedly by the tick).
    """
    # Patterns in the while() condition that indicate a blocking loop
    BLOCKING_CONDITIONS = [
        'g_cancellation_requested',
        'g_core1_cancellation_requested',
        'getchar',
        'multicore_fifo',
        'tud_task',
        'tuh_task',
    ]

    # Find all BackgroundLoop() method bodies
    search_start = 0
    while True:
        # Match BackgroundLoop override definitions
        idx = content.find('BackgroundLoop()', search_start)
        if idx == -1:
            break

        # Find the opening { of the method body
        brace_open = content.find('{', idx)
        if brace_open == -1:
            search_start = idx + 1
            continue

        # Balance braces to find method end
        depth = 1
        pos = brace_open + 1
        while depth > 0 and pos < len(content):
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            pos += 1
        method_end = pos  # exclusive (points past closing })

        method_body = content[brace_open:method_end]

        # Scan method body for blocking while patterns
        modified_body = method_body
        inner_search = 0
        while True:
            while_idx = -1
            while_pattern = None
            for pat in ['while (!', 'while(!', 'while (']:
                candidate = modified_body.find(pat, inner_search)
                if candidate != -1 and (while_idx == -1 or candidate < while_idx):
                    while_idx = candidate
                    while_pattern = pat

            if while_idx == -1:
                break

            # Extract the while condition
            paren_open = modified_body.find('(', while_idx)
            if paren_open == -1:
                inner_search = while_idx + 1
                continue

            # Balance parens to find end of condition
            depth_p = 1
            ppos = paren_open + 1
            while depth_p > 0 and ppos < len(modified_body):
                if modified_body[ppos] == '(':
                    depth_p += 1
                elif modified_body[ppos] == ')':
                    depth_p -= 1
                ppos += 1
            condition = modified_body[paren_open+1:ppos-1]

            # Check if this condition is a blocking pattern
            is_blocking = any(pat in condition for pat in BLOCKING_CONDITIONS)

            # Also treat while(1) / while(true) as blocking when inside BackgroundLoop
            if condition.strip() in ('1', 'true'):
                is_blocking = True

            if not is_blocking:
                inner_search = while_idx + 1
                continue

            # Already guarded?
            preceding = modified_body[max(0, while_idx-40):while_idx]
            if '__EMSCRIPTEN__' in preceding:
                inner_search = while_idx + 1
                continue

            # Find the while body braces
            body_open = modified_body.find('{', ppos - 1)
            if body_open == -1:
                inner_search = while_idx + 1
                continue

            depth_b = 1
            bpos = body_open + 1
            while depth_b > 0 and bpos < len(modified_body):
                if modified_body[bpos] == '{':
                    depth_b += 1
                elif modified_body[bpos] == '}':
                    depth_b -= 1
                bpos += 1
            while_end = bpos  # exclusive

            while_full = modified_body[while_idx:while_end]
            # Strip blocking hardware calls from the body to make a single-pass version
            loop_body = modified_body[body_open+1:bpos-1]

            # If the body uses getchar_timeout_us, the whole thing is serial I/O
            # which is unavailable in WASM — emit an empty stub rather than broken code
            if 'getchar_timeout_us' in loop_body or 'getchar' in loop_body:
                loop_body_clean = '  // Serial I/O not available in WASM'
            else:
                # Remove blocking sleep/wait calls
                loop_body_clean = re.sub(
                    r'\bsleep_ms\s*\([^)]*\)\s*;', '', loop_body)
                loop_body_clean = re.sub(
                    r'\bsleep_us\s*\([^)]*\)\s*;', '', loop_body_clean)
                loop_body_clean = re.sub(
                    r'\bbusy_wait_us\w*\s*\([^)]*\)\s*;', '', loop_body_clean)

            startup_code = modified_body[1:while_idx]
            if startup_code.strip():
                startup_wrapped = (
                    f'#ifdef __EMSCRIPTEN__\n'
                    f'    static bool init_done = false;\n'
                    f'    if (!init_done) {{\n'
                    f'        init_done = true;\n'
                    f'        {startup_code.strip()}\n'
                    f'    }}\n'
                    f'#else\n'
                    f'    {startup_code}\n'
                    f'#endif\n'
                )
            else:
                startup_wrapped = startup_code

            replacement = (
                f'{startup_wrapped}\n'
                f'#ifdef __EMSCRIPTEN__\n'
                f'    // WASM: BackgroundLoop() called cooperatively; run body once per tick\n'
                f'    {{\n'
                f'    {loop_body_clean}\n'
                f'    }}\n'
                f'#else\n'
                f'    {while_full}\n'
                f'#endif'
            )
            modified_body = '{\n' + replacement + modified_body[while_end:]
            inner_search = 2 + len(replacement)

        if modified_body != method_body:
            content = content[:brace_open] + modified_body + content[method_end:]
            # Adjust search start past this method
            search_start = brace_open + len(modified_body)
        else:
            search_start = method_end

    return content


def _fix_library_blocking_whiles(content: str) -> str:
    """Guard while(1)/while(true) loops in embedded library helper functions.

    Cards like reverb, krell, rompler embed C library code that contains
    MIDI USB event loop spinners (while(1) { tuh_midi_stream_read(...) }).
    These are called from ProcessSample or background ticks and will hang.

    Strategy: wrap any while(1)/while(true) that:
      - Is NOT already inside #ifdef __EMSCRIPTEN__ guard
      - Is NOT inside a g_wasm_*_tick lambda (already handled)
      - Contains only early-exit break patterns (i.e. bounded iteration)
    with a compile-time guard that makes it a single-pass under EMSCRIPTEN.

    We only target specific blocking patterns to avoid touching legitimate
    algorithmic while loops (parsers, binary search, etc.).
    """
    BLOCKING_LIB_PATTERNS = [
        'tuh_midi_stream_read',
        'tud_midi_stream_read',
        'tud_midi_available',
        'tuh_midi_available',
        'multicore_fifo_rvalid',
        'multicore_fifo_pop_blocking',
    ]

    lines = content.split('\n')
    result = []
    i = 0
    ifdef_depth = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Track #ifdef __EMSCRIPTEN__ depth
        if '#ifdef __EMSCRIPTEN__' in stripped or '#ifndef __EMSCRIPTEN__' in stripped:
            ifdef_depth += 1
        elif stripped == '#endif' and ifdef_depth > 0:
            ifdef_depth -= 1

        # Detect while(1) or while(true) lines
        is_inf_while = re.match(r'\s*while\s*\(\s*(1|true)\s*\)\s*\{?\s*$', line)

        if is_inf_while and ifdef_depth == 0:
            # Look ahead: check if any of the next ~15 lines contain a blocking lib pattern
            lookahead = '\n'.join(lines[i:min(i+15, len(lines))])
            if any(pat in lookahead for pat in BLOCKING_LIB_PATTERNS):
                # Wrap this while block in a guard
                result.append('#ifndef __EMSCRIPTEN__  // WASM: skip blocking USB/FIFO spin loop')
                result.append(line)
                # Collect the whole while block (brace-balanced)
                depth = line.count('{') - line.count('}')
                if depth == 0 and '{' not in line:
                    # while(...) without { on same line — next line has {
                    i += 1
                    result.append(lines[i])
                    depth = 1
                i += 1
                while i < len(lines) and depth > 0:
                    result.append(lines[i])
                    depth += lines[i].count('{') - lines[i].count('}')
                    i += 1
                result.append('#endif  // __EMSCRIPTEN__')
                continue

        result.append(line)
        i += 1

    return '\n'.join(result)


def strip_usb_callbacks(content):
    callbacks = [
        "tud_mount_cb", "tud_umount_cb", "tud_suspend_cb", "tud_resume_cb",
        "tuh_midi_tx_cb", "tuh_midi_rx_cb", "tuh_midi_mount_cb", "tuh_midi_umount_cb"
    ]
    for cb in callbacks:
        # Search for void cb(...) {
        pattern = r'void\s+' + cb + r'\s*\([^)]*\)\s*\{'
        match = re.search(pattern, content)
        if match:
            start_idx = match.start()
            
            # Check if there is a preceding extern "C"
            prefix = content[max(0, start_idx - 30):start_idx].strip()
            if prefix.endswith('extern "C"'):
                ext_idx = content.rfind('extern "C"', 0, start_idx)
                if ext_idx != -1:
                    start_idx = ext_idx
                    
            brace_idx = match.end() - 1
            brace_count = 1
            end_idx = -1
            for i in range(brace_idx + 1, len(content)):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
            if end_idx != -1:
                block = content[start_idx:end_idx]
                wrapped = f"\n#ifndef __EMSCRIPTEN__\n{block}\n#endif\n"
                content = content[:start_idx] + wrapped + content[end_idx:]
    return content


def preprocess_cpp_file(src_path, dst_path, is_main_file=False):
    if "Card_usb_audio_bridge.cpp" in src_path:
        content = """#include "pico_mocks.h"
#include "ComputerCard.h"

extern "C" {
    void set_thread_globals_usb_audio_bridge(CardGlobals* inst) {}
    void set_core1_thread_usb_audio_bridge(bool is_core1) {}
    void run_card_usb_audio_bridge() {}
}
"""
    else:
        with open(src_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # Clean out any existing definitions of these thread-local globals
        # (They will be re-added cleanly at the end of the main card file)
        content = re.sub(r'thread_local\s+CardGlobals\*\s+t_instance\s*(?:=\s*[^;]+)?;', '', content)
        content = re.sub(r'thread_local\s+bool\s+is_core1_thread\s*(?:=\s*[^;]+)?;', '', content)
        content = re.sub(r'thread_local\s+ComputerCard\*\s+ComputerCard::thisptr\s*(?:=\s*[^;]+)?;', '', content)
        
        # Strip duplicate USB callbacks for Emscripten
        content = strip_usb_callbacks(content)

    # Apply loop targeted preprocessing
    content = preprocess_main_loops(src_path, content)

    # Find the main function block: int main() { ... }
    # Under Emscripten, we allocate the card on the heap so it persists after main() exits.
    main_match = re.search(r'int\s+main\s*\([^)]*\)\s*\{', content)
    if main_match:
        start_idx = main_match.end()
        # Find matching closing brace
        brace_count = 1
        end_idx = -1
        for i in range(start_idx, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break
        if end_idx != -1:
            body = content[start_idx:end_idx]
            # Find variable calling .Run()
            run_match = re.search(r'(\b\w+\b)\.Run\s*\(\s*\)', body)
            if run_match:
                var_name = run_match.group(1)
                # Find declaration of var_name, e.g. "BirdCard bc;" or "mtws::MTWSApp app;"
                decl_pattern = r'(static\s+)?(\b[\w:]+\b)\s+' + var_name + r'\s*(\([^;]*\))?;'
                def repl(m):
                    is_static = m.group(1) if m.group(1) else ""
                    cls = m.group(2)
                    args = m.group(3) if m.group(3) else ""
                    return f"""#ifdef __EMSCRIPTEN__
    auto& {var_name} = *(new {cls}{args});
#else
    {is_static}{cls} {var_name}{args};
#endif"""
                if not re.search(r'#ifdef\s+__EMSCRIPTEN__.*?' + var_name, body, re.DOTALL):
                    new_body = re.sub(decl_pattern, repl, body, count=1)
                    content = content[:start_idx] + new_body + content[end_idx:]

    # Ensure parent directories exist
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    with open(dst_path, 'w', encoding='utf-8') as f:
        f.write(content)

def generate_bridge():
    out = []
    out.append('#include "pico_mocks.h"')
    out.append('#include "ComputerCard.h"')
    out.append('#include <emscripten.h>')
    out.append('')
    # Undefine struct member names that conflict with pico_mocks.h macros
    for m in ['g_knobs', 'g_switch', 'g_audio_in', 'g_cv_in', 'g_pulse_in', 'g_input_connected', 'g_audio_out', 'g_cv_out', 'g_pulse_out', 'g_led_brightness', 'g_cancellation_requested', 'g_fifo_1_to_0', 'g_fifo_0_to_1', 'g_core1_thread', 'g_synth_mutex', 'g_synth_cv', 'g_synth_need_render', 'g_flash_memory', 'g_midi_rx_packet_queue', 'g_midi_tx_byte_queue', 'g_serial_rx_byte_queue', 'g_serial_tx_byte_queue']:
        out.append(f'#undef {m}')
    out.append('')
    out.append('#ifdef __EMSCRIPTEN__')
    out.append('#include <functional>')
    out.append('std::function<void()> g_wasm_background_tick = nullptr;')
    out.append('std::function<void()> g_wasm_core1_tick = nullptr;')
    out.append('#endif')
    out.append('')
    out.append('// Active card globals')
    out.append('CardGlobals g_wasm_card_globals;')
    out.append('int g_active_wasm_card_idx = -1;')
    out.append('thread_local CardGlobals* t_instance = nullptr;')
    out.append('thread_local bool is_core1_thread = false;')
    out.append('thread_local bool g_core1_tick_active = false;')
    out.append('thread_local bool g_background_tick_active = false;')
    out.append('thread_local ComputerCard* ComputerCard::thisptr = nullptr;')
    out.append('')
    # Declare card exports for all 60 cards
    for c in CARDS:
        out.append(f'extern "C" {{')
        out.append(f'    void set_thread_globals_{c}(CardGlobals* inst);')
        out.append(f'    void set_core1_thread_{c}(bool is_core1);')
        out.append(f'    void run_card_{c}();')
        out.append(f'}}')
    
    out.append('')
    out.append('struct WasmCardFunctions {')
    out.append('    void (*set_thread_globals)(CardGlobals*);')
    out.append('    void (*set_core1_thread)(bool);')
    out.append('    void (*run_card)();')
    out.append('};')
    out.append('')
    out.append('WasmCardFunctions g_card_functions[] = {')
    for c in CARDS:
        out.append(f'    {{ set_thread_globals_{c}, set_core1_thread_{c}, run_card_{c} }},')
    out.append('};')
    out.append('')
    out.append('extern "C" {')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void init_card(int card_idx) {')
    out.append('    // Stop and delete current card if heap allocated')
    out.append('    ComputerCard* old_card = g_wasm_card_globals.card_ptr;')
    out.append('    if (old_card) {')
    out.append('        if (old_card->is_heap_allocated) {')
    out.append('            delete old_card;')
    out.append('        }')
    out.append('        g_wasm_card_globals.card_ptr = nullptr;')
    out.append('    }')
    out.append('    ')
    out.append('    // Reset all mock globals (queues, Expected sample rate, LED brightnesses, FIFO state, etc.)')
    out.append('    g_wasm_card_globals.reset();')
    out.append('    ')
    out.append('    g_wasm_background_tick = nullptr;')
    out.append('    g_wasm_core1_tick = nullptr;')
    out.append('    ')
    out.append('    g_active_wasm_card_idx = card_idx;')
    out.append('    ')
    out.append(f'    if (card_idx < 0 || card_idx >= {len(CARDS)}) return;')
    out.append('    ')
    out.append('    // Sync new card thread local globals')
    out.append('    g_card_functions[card_idx].set_thread_globals(&g_wasm_card_globals);')
    out.append('    g_card_functions[card_idx].set_core1_thread(false);')
    out.append('    ')
    out.append('    // Run card initialization (returns immediately because Run() doesn\'t loop under __EMSCRIPTEN__)')
    out.append('    g_card_functions[card_idx].run_card();')
    out.append('}')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void set_inputs(float knobMain, float knobX, float knobY, int switchZ, bool p1In, bool p2In, float audioIn1, float audioIn2, float cvIn1, float cvIn2) {')
    out.append('    g_wasm_card_globals.g_knobs[0] = knobMain;')
    out.append('    g_wasm_card_globals.g_knobs[1] = knobX;')
    out.append('    g_wasm_card_globals.g_knobs[2] = knobY;')
    out.append('    g_wasm_card_globals.g_switch = switchZ;')
    out.append('    g_wasm_card_globals.g_pulse_in[0] = p1In;')
    out.append('    g_wasm_card_globals.g_pulse_in[1] = p2In;')
    out.append('    g_wasm_card_globals.g_audio_in[0] = audioIn1;')
    out.append('    g_wasm_card_globals.g_audio_in[1] = audioIn2;')
    out.append('    g_wasm_card_globals.g_cv_in[0] = cvIn1;')
    out.append('    g_wasm_card_globals.g_cv_in[1] = cvIn2;')
    out.append('}')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void set_input_connected(bool audioIn1, bool audioIn2, bool cvIn1, bool cvIn2, bool p1In, bool p2In) {')
    out.append('    g_wasm_card_globals.g_input_connected[0] = audioIn1;')
    out.append('    g_wasm_card_globals.g_input_connected[1] = audioIn2;')
    out.append('    g_wasm_card_globals.g_input_connected[2] = cvIn1;')
    out.append('    g_wasm_card_globals.g_input_connected[3] = cvIn2;')
    out.append('    g_wasm_card_globals.g_input_connected[4] = p1In;')
    out.append('    g_wasm_card_globals.g_input_connected[5] = p2In;')
    out.append('}')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void set_host_sample_rate(double rate) {')
    out.append('    g_wasm_card_globals.host_sample_rate = rate;')
    out.append('}')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE double get_expected_sample_rate() {')
    out.append('    return g_wasm_card_globals.expected_sample_rate;')
    out.append('}')
    out.append('')
    out.append('')
    out.append('// Static buffer allocations for block processing')
    out.append('float g_wasm_in_L[128] = {0.0f};')
    out.append('float g_wasm_in_R[128] = {0.0f};')
    out.append('float g_wasm_cv_in1[128] = {0.0f};')
    out.append('float g_wasm_cv_in2[128] = {0.0f};')
    out.append('float g_wasm_pulse_in1[128] = {0.0f};')
    out.append('float g_wasm_pulse_in2[128] = {0.0f};')
    out.append('')
    out.append('float g_wasm_out_L[128] = {0.0f};')
    out.append('float g_wasm_out_R[128] = {0.0f};')
    out.append('float g_wasm_cv_out1[128] = {0.0f};')
    out.append('float g_wasm_cv_out2[128] = {0.0f};')
    out.append('float g_wasm_pulse_out1[128] = {0.0f};')
    out.append('float g_wasm_pulse_out2[128] = {0.0f};')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_in_L_ptr() { return g_wasm_in_L; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_in_R_ptr() { return g_wasm_in_R; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_cv_in1_ptr() { return g_wasm_cv_in1; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_cv_in2_ptr() { return g_wasm_cv_in2; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_pulse_in1_ptr() { return g_wasm_pulse_in1; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_pulse_in2_ptr() { return g_wasm_pulse_in2; }')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_out_L_ptr() { return g_wasm_out_L; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_out_R_ptr() { return g_wasm_out_R; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_cv_out1_ptr() { return g_wasm_cv_out1; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_cv_out2_ptr() { return g_wasm_cv_out2; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_pulse_out1_ptr() { return g_wasm_pulse_out1; }')
    out.append('EMSCRIPTEN_KEEPALIVE float* get_pulse_out2_ptr() { return g_wasm_pulse_out2; }')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void process_block(int count, float knobMain, float knobX, float knobY, int switchZ) {')
    out.append('    if (g_active_wasm_card_idx == -1) return;')
    out.append('    ')
    out.append('    // Sync thread-locals in case the calling thread changed')
    out.append('    t_instance = &g_wasm_card_globals;')
    out.append('    g_card_functions[g_active_wasm_card_idx].set_thread_globals(&g_wasm_card_globals);')
    out.append('    ')
    out.append('    ComputerCard* card = g_wasm_card_globals.card_ptr;')
    out.append('    if (!card || !g_wasm_card_globals.g_dsp_ready) {')
    out.append('        for (int i = 0; i < count; i++) {')
    out.append('            g_wasm_out_L[i] = 0.0f;')
    out.append('            g_wasm_out_R[i] = 0.0f;')
    out.append('            g_wasm_cv_out1[i] = 0.0f;')
    out.append('            g_wasm_cv_out2[i] = 0.0f;')
    out.append('            g_wasm_pulse_out1[i] = 0.0f;')
    out.append('            g_wasm_pulse_out2[i] = 0.0f;')
    out.append('        }')
    out.append('        return;')
    out.append('    }')
    out.append('    ')
    out.append('    for (int i = 0; i < count; i++) {')
    out.append('        g_wasm_card_globals.g_knobs[0] = knobMain;')
    out.append('        g_wasm_card_globals.g_knobs[1] = knobX;')
    out.append('        g_wasm_card_globals.g_knobs[2] = knobY;')
    out.append('        g_wasm_card_globals.g_switch = switchZ;')
    out.append('        g_wasm_card_globals.g_pulse_in[0] = (g_wasm_pulse_in1[i] > 0.15f);')
    out.append('        g_wasm_card_globals.g_pulse_in[1] = (g_wasm_pulse_in2[i] > 0.15f);')
    out.append('        ')
    out.append('        float inL_val = g_wasm_in_L[i] * 12.0f;')
    out.append('        g_wasm_card_globals.g_audio_in[0] = (inL_val > 6.0f) ? 6.0f : ((inL_val < -6.0f) ? -6.0f : inL_val);')
    out.append('        ')
    out.append('        float inR_val = g_wasm_in_R[i] * 12.0f;')
    out.append('        g_wasm_card_globals.g_audio_in[1] = (inR_val > 6.0f) ? 6.0f : ((inR_val < -6.0f) ? -6.0f : inR_val);')
    out.append('        ')
    out.append('        float cv1_val = g_wasm_cv_in1[i] * 12.0f;')
    out.append('        g_wasm_card_globals.g_cv_in[0] = (cv1_val > 6.0f) ? 6.0f : ((cv1_val < -6.0f) ? -6.0f : cv1_val);')
    out.append('        ')
    out.append('        float cv2_val = g_wasm_cv_in2[i] * 12.0f;')
    out.append('        g_wasm_card_globals.g_cv_in[1] = (cv2_val > 6.0f) ? 6.0f : ((cv2_val < -6.0f) ? -6.0f : cv2_val);')
    out.append('        ')
    out.append('        g_wasm_card_globals.dsp_phase += g_wasm_card_globals.expected_sample_rate / g_wasm_card_globals.host_sample_rate;')
    out.append('        while (g_wasm_card_globals.dsp_phase >= 1.0) {')
    out.append('            g_wasm_card_globals.virtual_time_accumulator += 1000000.0 / g_wasm_card_globals.expected_sample_rate;')
    out.append('            g_wasm_card_globals.virtual_time_us.store((uint64_t)g_wasm_card_globals.virtual_time_accumulator, std::memory_order_relaxed);')
    out.append('            card->update_inputs();')
    out.append('            card->ProcessSample();')
    out.append('            g_wasm_card_globals.dsp_phase -= 1.0;')
    out.append('        }')
    out.append('        ')
    out.append('        static int sample_count = 0;')
    out.append('        sample_count++;')
    out.append('        if (sample_count >= 48) {')
    out.append('            sample_count = 0;')
    out.append('            card->BackgroundLoop();')
    out.append('            if (g_wasm_background_tick) {')
    out.append('                try { g_wasm_background_tick(); } catch (const ThreadExitException&) {}')
    out.append('            }')
    out.append('            if (g_wasm_core1_tick) {')
    out.append('                if (!g_wasm_card_globals.g_core1_fifo_driven || !g_wasm_card_globals.g_fifo_0_to_1.empty()) {')
    out.append('                    is_core1_thread = true;')
    out.append('                    try { g_wasm_core1_tick(); } catch (const ThreadExitException&) {}')
    out.append('                    is_core1_thread = false;')
    out.append('                }')
    out.append('            }')
    out.append('        }')
    out.append('        ')
    out.append('        g_wasm_out_L[i] = g_wasm_card_globals.g_audio_out[0] / 12.0f;')
    out.append('        g_wasm_out_R[i] = g_wasm_card_globals.g_audio_out[1] / 12.0f;')
    out.append('        g_wasm_cv_out1[i] = g_wasm_card_globals.g_cv_out[0] / 12.0f;')
    out.append('        g_wasm_cv_out2[i] = g_wasm_card_globals.g_cv_out[1] / 12.0f;')
    out.append('        g_wasm_pulse_out1[i] = g_wasm_card_globals.g_pulse_out[0] ? 1.0f : 0.0f;')
    out.append('        g_wasm_pulse_out2[i] = g_wasm_card_globals.g_pulse_out[1] ? 1.0f : 0.0f;')
    out.append('    }')
    out.append('}')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void process_sample() {')
    out.append('    if (g_active_wasm_card_idx == -1) return;')
    out.append('    ')
    out.append('    // Sync thread-locals in case the calling thread changed')
    out.append('    t_instance = &g_wasm_card_globals;')
    out.append('    g_card_functions[g_active_wasm_card_idx].set_thread_globals(&g_wasm_card_globals);')
    out.append('    ')
    out.append('    ComputerCard* card = g_wasm_card_globals.card_ptr;')
    out.append('    if (card && g_wasm_card_globals.g_dsp_ready) {')
    out.append('        g_wasm_card_globals.dsp_phase += g_wasm_card_globals.expected_sample_rate / g_wasm_card_globals.host_sample_rate;')
    out.append('        ')
    out.append('        while (g_wasm_card_globals.dsp_phase >= 1.0) {')
    out.append('            g_wasm_card_globals.virtual_time_accumulator += 1000000.0 / g_wasm_card_globals.expected_sample_rate;')
    out.append('            g_wasm_card_globals.virtual_time_us.store((uint64_t)g_wasm_card_globals.virtual_time_accumulator, std::memory_order_relaxed);')
    out.append('            card->update_inputs();')
    out.append('            card->ProcessSample();')
    out.append('            g_wasm_card_globals.dsp_phase -= 1.0;')
    out.append('        }')
    out.append('        ')
    out.append('        // Cooperative time-slicing: Tick background loop every 48 samples (1ms)')
    out.append('        static int sample_count = 0;')
    out.append('        sample_count++;')
    out.append('        if (sample_count >= 48) {')
    out.append('            sample_count = 0;')
    out.append('            card->BackgroundLoop();')
    out.append('            if (g_wasm_background_tick) {')
    out.append('                try { g_wasm_background_tick(); } catch (const ThreadExitException&) {}')
    out.append('            }')
    out.append('            if (g_wasm_core1_tick) {')
    out.append('                if (!g_wasm_card_globals.g_core1_fifo_driven || !g_wasm_card_globals.g_fifo_0_to_1.empty()) {')
    out.append('                    is_core1_thread = true;')
    out.append('                    try { g_wasm_core1_tick(); } catch (const ThreadExitException&) {}')
    out.append('                    is_core1_thread = false;')
    out.append('                }')
    out.append('            }')
    out.append('        }')
    out.append('    }')
    out.append('}')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE float get_audio_out1() { return g_wasm_card_globals.g_audio_out[0]; }')
    out.append('EMSCRIPTEN_KEEPALIVE float get_audio_out2() { return g_wasm_card_globals.g_audio_out[1]; }')
    out.append('EMSCRIPTEN_KEEPALIVE float get_cv_out1() { return g_wasm_card_globals.g_cv_out[0]; }')
    out.append('EMSCRIPTEN_KEEPALIVE float get_cv_out2() { return g_wasm_card_globals.g_cv_out[1]; }')
    out.append('EMSCRIPTEN_KEEPALIVE bool get_pulse_out1() { return g_wasm_card_globals.g_pulse_out[0]; }')
    out.append('EMSCRIPTEN_KEEPALIVE bool get_pulse_out2() { return g_wasm_card_globals.g_pulse_out[1]; }')
    out.append('EMSCRIPTEN_KEEPALIVE float get_led_brightness(int index) {')
    out.append('    if (index >= 0 && index < 6) return g_wasm_card_globals.g_led_brightness[index];')
    out.append('    return 0.f;')
    out.append('}')
    out.append('EMSCRIPTEN_KEEPALIVE uint8_t* get_flash_ptr() { return g_wasm_card_globals.g_flash_memory_val; }')
    out.append('EMSCRIPTEN_KEEPALIVE int get_flash_size() { return PICO_FLASH_SIZE_BYTES; }')
    out.append('')
    out.append('EMSCRIPTEN_KEEPALIVE void send_midi_to_card(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {')
    out.append('    uint8_t pkt[4] = { b0, b1, b2, b3 };')
    out.append('    g_wasm_card_globals.g_midi_rx_packet_queue.push(pkt);')
    out.append('}')
    out.append('EMSCRIPTEN_KEEPALIVE int read_midi_from_card(uint8_t* out_bytes, int max_len) {')
    out.append('    uint8_t b;')
    out.append('    int count = 0;')
    out.append('    while (count < max_len && g_wasm_card_globals.g_midi_tx_byte_queue.pop(b)) {')
    out.append('        out_bytes[count++] = b;')
    out.append('    }')
    out.append('    return count;')
    out.append('}')
    out.append('EMSCRIPTEN_KEEPALIVE void send_serial_to_card(uint8_t* bytes, int len) {')
    out.append('    g_wasm_card_globals.g_serial_rx_byte_queue.push(bytes, len);')
    out.append('}')
    out.append('EMSCRIPTEN_KEEPALIVE int read_serial_from_card(uint8_t* out_bytes, int max_len) {')
    out.append('    uint8_t b;')
    out.append('    int count = 0;')
    out.append('    while (count < max_len && g_wasm_card_globals.g_serial_tx_byte_queue.pop(b)) {')
    out.append('        out_bytes[count++] = b;')
    out.append('    }')
    out.append('    return count;')
    out.append('}')
    out.append('EMSCRIPTEN_KEEPALIVE bool is_flash_dirty() {')
    out.append('    return g_wasm_card_globals.g_flash_dirty.load(std::memory_order_acquire);')
    out.append('}')
    out.append('EMSCRIPTEN_KEEPALIVE void clear_flash_dirty() {')
    out.append('    g_wasm_card_globals.g_flash_dirty.store(false, std::memory_order_release);')
    out.append('}')
    out.append('}')
    
    os.makedirs('src', exist_ok=True)
    with open('src/WasmCardBridge.cpp', 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print("Generated src/WasmCardBridge.cpp successfully.")

def parse_makefile_cards():
    makefile_cards_path = os.path.join(VCV_WORKSPACE_PATH, 'Makefile.cards')
    with open(makefile_cards_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    rules = {}
    current_target = None
    
    for line in lines:
        line_strip = line.strip()
        if not line_strip or line_strip.startswith('#'):
            continue
        
        if ':' in line and not line.startswith('\t'):
            parts = line.split(':')
            target = parts[0].strip()
            deps = parts[1].strip().split()
            current_target = target
            rules[target] = {
                'deps': deps,
                'commands': []
            }
        elif line.startswith('\t') and current_target:
            rules[current_target]['commands'].append(line.strip())
            
    return rules

def generate_makefile_wasm(rules):
    out = []
    out.append('# Auto-generated Makefile.wasm for WebAssembly compilation')
    out.append('')
    out.append('CC = emcc')
    out.append('CXX = em++')
    out.append('')
    
    # Common Emscripten compilation flags
    # We use -O3 for performance, Asyncify is disabled (standard sync compilation),
    # and export our bridge functions.
    em_flags = [
        '-O0',
        '-g',
        '-sMODULARIZE=1',
        '-sENVIRONMENT=web,worker',
        '-sDISABLE_EXCEPTION_CATCHING=0',
        '-sASSERTIONS=1',
        '-sEXPORTED_RUNTIME_METHODS=["ccall","cwrap","HEAPU8","HEAP32","HEAPF32"]',
        '-sEXPORTED_FUNCTIONS=["_init_card","_set_inputs","_set_input_connected","_set_host_sample_rate","_get_expected_sample_rate","_process_sample","_get_audio_out1","_get_audio_out2","_get_cv_out1","_get_cv_out2","_get_pulse_out1","_get_pulse_out2","_get_led_brightness","_get_flash_ptr","_get_flash_size","_send_midi_to_card","_read_midi_from_card","_send_serial_to_card","_read_serial_from_card","_malloc","_free","_process_block","_get_in_L_ptr","_get_in_R_ptr","_get_cv_in1_ptr","_get_cv_in2_ptr","_get_pulse_in1_ptr","_get_pulse_in2_ptr","_get_out_L_ptr","_get_out_R_ptr","_get_cv_out1_ptr","_get_cv_out2_ptr","_get_pulse_out1_ptr","_get_pulse_out2_ptr","_is_flash_dirty","_clear_flash_dirty"]',
        '-sALLOW_MEMORY_GROWTH=1',
        '-sTOTAL_MEMORY=33554432', # 32MB initial memory
        '-D__EMSCRIPTEN__=1',
        '-Isrc',
        f'-I{VCV_WORKSPACE_PATH}/src',
        '-Wno-narrowing',
        '-Wno-c++11-narrowing',
    ]
    
    out.append(f'WASM_FLAGS = {" ".join(em_flags)}')
    out.append('')
    
    # Generate list of object files
    objs = []
    objs.append('build_wasm/WasmCardBridge.o')
    objs.append('build_wasm/cards/CardRegistry.o')
    
    for target, info in rules.items():
        if not target.endswith('.$(CARD_LIB_EXT)'):
            continue
        card_id = target.split('libcard_')[1].split('.$(CARD_LIB_EXT)')[0]
        for dep in info['deps']:
            if dep.endswith('.cpp') or dep.endswith('.cc'):
                rel_path = dep.replace('src/', '')
                obj_path = f'build_wasm/{rel_path.replace(".cpp", ".o").replace(".cc", ".o")}'
                objs.append(obj_path)
                
    out.append('OBJECTS = \\')
    for obj in objs:
        out.append(f'\t{obj} \\')
    out.append('')
    
    out.append('all: ../js/cards/wasm/patchnotes_cards.js')
    out.append('')
    
    out.append('../js/cards/wasm/patchnotes_cards.js: $(OBJECTS)')
    out.append('\t@mkdir -p ../js/cards/wasm')
    out.append('\t$(CXX) $(WASM_FLAGS) --embed-file build_wasm/res@/res $(OBJECTS) -o ../js/cards/wasm/patchnotes_cards.js')
    out.append('')
    
    # Generic rule for WasmCardBridge
    out.append('build_wasm/WasmCardBridge.o: src/WasmCardBridge.cpp')
    out.append('\t@mkdir -p build_wasm')
    out.append('\t$(CXX) $(WASM_FLAGS) -c src/WasmCardBridge.cpp -o build_wasm/WasmCardBridge.o')
    out.append('')
    
    # Generic rule for CardRegistry
    out.append(f'build_wasm/cards/CardRegistry.o: {VCV_WORKSPACE_PATH}/src/cards/CardRegistry.cpp')
    out.append('\t@mkdir -p build_wasm/cards')
    out.append(f'\t$(CXX) $(WASM_FLAGS) -c {VCV_WORKSPACE_PATH}/src/cards/CardRegistry.cpp -o build_wasm/cards/CardRegistry.o')
    out.append('')
    
    # Individual compile rules for each card source file to apply unique renaming macros!
    for target, info in rules.items():
        if not target.endswith('.$(CARD_LIB_EXT)'):
            continue
        card_id = target.split('libcard_')[1].split('.$(CARD_LIB_EXT)')[0]
        
        # Extract includes from original commands
        import shlex
        includes = []
        for cmd in info['commands']:
            parts = shlex.split(cmd)
            for p in parts:
                if p.startswith('-I') or p.startswith('"-I'):
                    clean_p = p.strip('"')
                    inc_path = clean_p[2:]
                    if not os.path.isabs(inc_path):
                        new_inc = f"-I{VCV_WORKSPACE_PATH}/{inc_path}"
                    else:
                        new_inc = clean_p
                    if ' ' in new_inc:
                        includes.append(f'"{new_inc}"')
                    else:
                        includes.append(new_inc)
        
        # Add card-specific rename macros
        rename_defs = [
            f'-Dset_thread_globals=set_thread_globals_{card_id}',
            f'-Dset_core1_thread=set_core1_thread_{card_id}',
            f'-Drun_card=run_card_{card_id}',
            f'-Dcore1_entry=core1_entry_{card_id}',
            f'-Dtuh_midi_mount_cb=tuh_midi_mount_cb_{card_id}',
            f'-Dtuh_midi_umount_cb=tuh_midi_umount_cb_{card_id}',
            f'-Dtuh_midi_rx_cb=tuh_midi_rx_cb_{card_id}',
            f'-Dhandle_midi_message=handle_midi_message_{card_id}',
            f'-Dusb_rx_lockfree_init=usb_rx_lockfree_init_{card_id}',
            f'-Dusb_rx_lockfree_post=usb_rx_lockfree_post_{card_id}',
            f'-Dusb_rx_lockfree_get=usb_rx_lockfree_get_{card_id}',
            f'-Dusb_rx_lockfree_pending_count=usb_rx_lockfree_pending_count_{card_id}',
            f'-Dusb_rx_lockfree_drop_count=usb_rx_lockfree_drop_count_{card_id}',
            f'-Dusb_tx_lockfree_init=usb_tx_lockfree_init_{card_id}',
            f'-Dusb_tx_lockfree_post=usb_tx_lockfree_post_{card_id}',
            f'-Dusb_tx_lockfree_get=usb_tx_lockfree_get_{card_id}',
            f'-Dusb_tx_lockfree_pending_count=usb_tx_lockfree_pending_count_{card_id}',
            f'-Dusb_tx_lockfree_drop_count=usb_tx_lockfree_drop_count_{card_id}',
            f'-Dusb_lockfree_init=usb_lockfree_init_{card_id}',
            f'-Dg_command_mailbox=g_command_mailbox_{card_id}',
            f'-Dg_response_mailbox=g_response_mailbox_{card_id}',
            f'-Dmailbox_send_command=mailbox_send_command_{card_id}',
            f'-Dmailbox_get_response=mailbox_get_response_{card_id}',
            f'-Dmailbox_mark_response_sent=mailbox_mark_response_sent_{card_id}',
            f'-Dmailbox_get_command=mailbox_get_command_{card_id}',
            f'-Dmailbox_mark_command_processed=mailbox_mark_command_processed_{card_id}',
            f'-Dmailbox_send_response=mailbox_send_response_{card_id}',
            f'-Dmailbox_init=mailbox_init_{card_id}',
            f'-Dfastmath_lua_install=fastmath_lua_install_{card_id}',
        ]
        
        # Write compilation rules for each source dependency
        for dep in info['deps']:
            if dep.endswith('.cpp') or dep.endswith('.cc'):
                rel_path = dep.replace('src/', '')
                src_build_path = f'build_wasm/{rel_path}'
                obj_build_path = f'build_wasm/{rel_path.replace(".cpp", ".o").replace(".cc", ".o")}'
                
                out.append(f'{obj_build_path}: {src_build_path}')
                out.append(f'\t@mkdir -p $(dir {obj_build_path})')
                out.append(f'\t$(CXX) $(WASM_FLAGS) {" ".join(includes)} {" ".join(rename_defs)} -c {src_build_path} -o {obj_build_path}')
                out.append('')
                
    with open('Makefile.wasm', 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print("Generated Makefile.wasm successfully.")

def prepare_resources():
    print("Preparing WebAssembly card resources...")
    res_dest = "build_wasm/res"
    os.makedirs(res_dest, exist_ok=True)
    
    # 1. Copy wav/
    wav_src = os.path.join(VCV_WORKSPACE_PATH, "res/wav")
    wav_dst = os.path.join(res_dest, "wav")
    if os.path.exists(wav_src):
        shutil.rmtree(wav_dst, ignore_errors=True)
        shutil.copytree(wav_src, wav_dst)
        print("Copied wavetables.")
        
    # 2. Copy compulidean/
    comp_src = os.path.join(VCV_WORKSPACE_PATH, "res/compulidean")
    comp_dst = os.path.join(res_dest, "compulidean")
    if os.path.exists(comp_src):
        shutil.rmtree(comp_dst, ignore_errors=True)
        shutil.copytree(comp_src, comp_dst)
        print("Copied Compulidean samples.")
        
    # 3. Prepare backyard_rain/
    rain_src = os.path.join(VCV_WORKSPACE_PATH, "res/backyard_rain")
    rain_dst = os.path.join(res_dest, "backyard_rain")
    if os.path.exists(rain_src):
        shutil.rmtree(rain_dst, ignore_errors=True)
        os.makedirs(os.path.join(rain_dst, "stereo"), exist_ok=True)
        
        # Copy thunder files (monophonic)
        for f in ["backyard_thunder_a.wav", "backyard_thunder_b.wav", "backyard_thunder_c.wav"]:
            src_f = os.path.join(rain_src, f)
            if os.path.exists(src_f):
                shutil.copy(src_f, os.path.join(rain_dst, f))
                
        # Copy short loops as the main loops (renaming them)
        shutil.copy(
            os.path.join(rain_src, "stereo/backyard_rain_light_loop_short_stereo.wav"),
            os.path.join(rain_dst, "stereo/backyard_rain_light_loop_stereo.wav")
        )
        shutil.copy(
            os.path.join(rain_src, "stereo/backyard_rain_medium_loop_short_stereo.wav"),
            os.path.join(rain_dst, "stereo/backyard_rain_medium_loop_stereo.wav")
        )
        shutil.copy(
            os.path.join(rain_src, "stereo/backyard_rain_heavy_loop_short_stereo.wav"),
            os.path.join(rain_dst, "stereo/backyard_rain_heavy_loop_stereo.wav")
        )
        print("Copied Backyard Rain samples (using short loop optimizations).")

def copy_web_editors():
    print("Copying card web editors...")
    web_dest = "../js/cards/wasm/web"
    os.makedirs(web_dest, exist_ok=True)
    
    releases_dir = os.path.join(VCV_WORKSPACE_PATH, "deps/Workshop_Computer/releases")
    if not os.path.exists(releases_dir):
        print(f"Releases directory {releases_dir} not found. Skipping web editors copy.")
        return
        
    for entry in os.listdir(releases_dir):
        entry_path = os.path.join(releases_dir, entry)
        if not os.path.isdir(entry_path):
            continue
            
        parts = entry.split('_', 1)
        if len(parts) < 2:
            continue
        name = parts[1].lower()
        
        # Custom mapping dictionary
        mapping = {
            "simple_midi": "midi",
            "turing_machine": "turing",
            "byo_benjolin": "benjolin",
            "usb_audio": "usb_audio",
            "usb_audio_bridge": "usb_audio",
            "cirpy_wavetable": "cirpy",
            "backyard_rain": "rain",
            "computer_grids": "computer_grids",
            "cosmikc1zzl3": "cosmik_c1zzl3"
        }
        card_id = mapping.get(name, name)
        
        web_folder = os.path.join(entry_path, "web")
        if not os.path.isdir(web_folder):
            web_folder = os.path.join(entry_path, "editor")
        card_web_dest = os.path.join(web_dest, card_id)
        
        copied = False
        if os.path.isdir(web_folder):
            shutil.rmtree(card_web_dest, ignore_errors=True)
            shutil.copytree(web_folder, card_web_dest)
            copied = True
            print(f"Copied web folder for {card_id} to {card_web_dest}")
        else:
            # Check for any .html files in the main release folder
            html_files = [f for f in os.listdir(entry_path) if f.endswith(".html")]
            if html_files:
                os.makedirs(card_web_dest, exist_ok=True)
                for f in html_files:
                    src_file = os.path.join(entry_path, f)
                    shutil.copy(src_file, os.path.join(card_web_dest, f))
                copied = True
                print(f"Copied HTML file(s) for {card_id} to {card_web_dest}")
                
        # Check for matching res/web/<card_id> in Workshop_Computer_VCV
        res_web_folder = os.path.join(VCV_WORKSPACE_PATH, "res/web", card_id)
        if os.path.isdir(res_web_folder):
            shutil.rmtree(card_web_dest, ignore_errors=True)
            shutil.copytree(res_web_folder, card_web_dest)
            copied = True
            print(f"Copied res/web folder for {card_id} to {card_web_dest} (overriding release)")
                
        # If we copied anything, search for HTML files in the destination and inject the script tag
        if copied and os.path.exists(card_web_dest):
            for root, dirs, files in os.walk(card_web_dest):
                for f in files:
                    if f.endswith(".html"):
                        html_path = os.path.join(root, f)
                        with open(html_path, 'r', encoding='utf-8', errors='ignore') as html_f:
                            html_content = html_f.read()
                        
                        if "editor_bridge.js" not in html_content:
                            wasm_dest = "../js/cards/wasm"
                            rel_dir = os.path.relpath(wasm_dest, os.path.dirname(html_path))
                            bridge_src = os.path.join(rel_dir, "editor_bridge.js").replace('\\', '/')
                            
                            head_match = re.search(r'<head\b[^>]*>', html_content, re.IGNORECASE)
                            if head_match:
                                end_pos = head_match.end()
                                html_content = html_content[:end_pos] + f'\n<script src="{bridge_src}"></script>' + html_content[end_pos:]
                            else:
                                html_content = f'<script src="{bridge_src}"></script>\n' + html_content
                                
                            with open(html_path, 'w', encoding='utf-8') as html_f:
                                html_f.write(html_content)
                            print(f"Injected editor_bridge.js into {html_path}")

def main():
    print("Starting build preparation...")
    os.makedirs('build_wasm', exist_ok=True)
    
    # Prepare resources for embedding
    prepare_resources()
    
    # Copy web editors
    copy_web_editors()
    
    # 1. Preprocess each card file to make the stack instances static inside main()
    # and copy them to build_wasm/cards/
    rules = parse_makefile_cards()
    for target, info in rules.items():
        if not target.endswith('.$(CARD_LIB_EXT)'):
            continue
        card_id = target.split('libcard_')[1].split('.$(CARD_LIB_EXT)')[0]
        for dep in info['deps']:
            if dep.endswith('.cpp') or dep.endswith('.cc'):
                rel_path = dep.replace('src/', '')
                is_main = os.path.basename(dep) == f"Card_{card_id}.cpp"
                src_path = os.path.join(VCV_WORKSPACE_PATH, dep)
                preprocess_cpp_file(src_path, f'build_wasm/{rel_path}', is_main)
                
    print("Preprocessed all C++ card source files.")
    
    # 2. Generate src/WasmCardBridge.cpp
    generate_bridge()
    
    # 3. Generate Makefile.wasm
    generate_makefile_wasm(rules)
    
    print("Build preparation complete!")

if __name__ == '__main__':
    main()
