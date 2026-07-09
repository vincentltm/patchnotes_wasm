#include "pico_mocks.h"
#include "ComputerCard.h"
#include <emscripten.h>

#undef g_knobs
#undef g_switch
#undef g_audio_in
#undef g_cv_in
#undef g_pulse_in
#undef g_input_connected
#undef g_audio_out
#undef g_cv_out
#undef g_pulse_out
#undef g_led_brightness
#undef g_cancellation_requested
#undef g_fifo_1_to_0
#undef g_fifo_0_to_1
#undef g_core1_thread
#undef g_synth_mutex
#undef g_synth_cv
#undef g_synth_need_render
#undef g_flash_memory
#undef g_midi_rx_packet_queue
#undef g_midi_tx_byte_queue
#undef g_serial_rx_byte_queue
#undef g_serial_tx_byte_queue

#ifdef __EMSCRIPTEN__
#include <functional>
std::function<void()> g_wasm_background_tick = nullptr;
std::function<void()> g_wasm_core1_tick = nullptr;
#endif

// Active card globals
CardGlobals g_wasm_card_globals;
int g_active_wasm_card_idx = -1;
thread_local CardGlobals* t_instance = nullptr;
thread_local bool is_core1_thread = false;
thread_local bool g_core1_tick_active = false;
thread_local bool g_background_tick_active = false;
thread_local ComputerCard* ComputerCard::thisptr = nullptr;

extern "C" {
    void set_thread_globals_simple_midi(CardGlobals* inst);
    void set_core1_thread_simple_midi(bool is_core1);
    void run_card_simple_midi();
}
extern "C" {
    void set_thread_globals_turing_machine(CardGlobals* inst);
    void set_core1_thread_turing_machine(bool is_core1);
    void run_card_turing_machine();
}
extern "C" {
    void set_thread_globals_byo_benjolin(CardGlobals* inst);
    void set_core1_thread_byo_benjolin(bool is_core1);
    void run_card_byo_benjolin();
}
extern "C" {
    void set_thread_globals_chord_blimey(CardGlobals* inst);
    void set_core1_thread_chord_blimey(bool is_core1);
    void run_card_chord_blimey();
}
extern "C" {
    void set_thread_globals_usb_audio_bridge(CardGlobals* inst);
    void set_core1_thread_usb_audio_bridge(bool is_core1);
    void run_card_usb_audio_bridge();
}
extern "C" {
    void set_thread_globals_bumpers(CardGlobals* inst);
    void set_core1_thread_bumpers(bool is_core1);
    void run_card_bumpers();
}
extern "C" {
    void set_thread_globals_bytebeat(CardGlobals* inst);
    void set_core1_thread_bytebeat(bool is_core1);
    void run_card_bytebeat();
}
extern "C" {
    void set_thread_globals_divcom(CardGlobals* inst);
    void set_core1_thread_divcom(bool is_core1);
    void run_card_divcom();
}
extern "C" {
    void set_thread_globals_twists(CardGlobals* inst);
    void set_core1_thread_twists(bool is_core1);
    void run_card_twists();
}
extern "C" {
    void set_thread_globals_goldfish(CardGlobals* inst);
    void set_core1_thread_goldfish(bool is_core1);
    void run_card_goldfish();
}
extern "C" {
    void set_thread_globals_am_coupler(CardGlobals* inst);
    void set_core1_thread_am_coupler(bool is_core1);
    void run_card_am_coupler();
}
extern "C" {
    void set_thread_globals_noisebox(CardGlobals* inst);
    void set_core1_thread_noisebox(bool is_core1);
    void run_card_noisebox();
}
extern "C" {
    void set_thread_globals_cvmod(CardGlobals* inst);
    void set_core1_thread_cvmod(bool is_core1);
    void run_card_cvmod();
}
extern "C" {
    void set_thread_globals_mlrws(CardGlobals* inst);
    void set_core1_thread_mlrws(bool is_core1);
    void run_card_mlrws();
}
extern "C" {
    void set_thread_globals_chord_organ(CardGlobals* inst);
    void set_core1_thread_chord_organ(bool is_core1);
    void run_card_chord_organ();
}
extern "C" {
    void set_thread_globals_reverb(CardGlobals* inst);
    void set_core1_thread_reverb(bool is_core1);
    void run_card_reverb();
}
extern "C" {
    void set_thread_globals_resonator(CardGlobals* inst);
    void set_core1_thread_resonator(bool is_core1);
    void run_card_resonator();
}
extern "C" {
    void set_thread_globals_sheep(CardGlobals* inst);
    void set_core1_thread_sheep(bool is_core1);
    void run_card_sheep();
}
extern "C" {
    void set_thread_globals_slowmod(CardGlobals* inst);
    void set_core1_thread_slowmod(bool is_core1);
    void run_card_slowmod();
}
extern "C" {
    void set_thread_globals_crafted_volts(CardGlobals* inst);
    void set_core1_thread_crafted_volts(bool is_core1);
    void run_card_crafted_volts();
}
extern "C" {
    void set_thread_globals_utility_pair(CardGlobals* inst);
    void set_core1_thread_utility_pair(bool is_core1);
    void run_card_utility_pair();
}
extern "C" {
    void set_thread_globals_siren(CardGlobals* inst);
    void set_core1_thread_siren(bool is_core1);
    void run_card_siren();
}
extern "C" {
    void set_thread_globals_eighties_bass(CardGlobals* inst);
    void set_core1_thread_eighties_bass(bool is_core1);
    void run_card_eighties_bass();
}
extern "C" {
    void set_thread_globals_cirpy_wavetable(CardGlobals* inst);
    void set_core1_thread_cirpy_wavetable(bool is_core1);
    void run_card_cirpy_wavetable();
}
extern "C" {
    void set_thread_globals_esp(CardGlobals* inst);
    void set_core1_thread_esp(bool is_core1);
    void run_card_esp();
}
extern "C" {
    void set_thread_globals_vink(CardGlobals* inst);
    void set_core1_thread_vink(bool is_core1);
    void run_card_vink();
}
extern "C" {
    void set_thread_globals_drumdrum(CardGlobals* inst);
    void set_core1_thread_drumdrum(bool is_core1);
    void run_card_drumdrum();
}
extern "C" {
    void set_thread_globals_dual_quant(CardGlobals* inst);
    void set_core1_thread_dual_quant(bool is_core1);
    void run_card_dual_quant();
}
extern "C" {
    void set_thread_globals_freq_shift(CardGlobals* inst);
    void set_core1_thread_freq_shift(bool is_core1);
    void run_card_freq_shift();
}
extern "C" {
    void set_thread_globals_compulidean(CardGlobals* inst);
    void set_core1_thread_compulidean(bool is_core1);
    void run_card_compulidean();
}
extern "C" {
    void set_thread_globals_od(CardGlobals* inst);
    void set_core1_thread_od(bool is_core1);
    void run_card_od();
}
extern "C" {
    void set_thread_globals_knots(CardGlobals* inst);
    void set_core1_thread_knots(bool is_core1);
    void run_card_knots();
}
extern "C" {
    void set_thread_globals_blackbird(CardGlobals* inst);
    void set_core1_thread_blackbird(bool is_core1);
    void run_card_blackbird();
}
extern "C" {
    void set_thread_globals_backyard_rain(CardGlobals* inst);
    void set_core1_thread_backyard_rain(bool is_core1);
    void run_card_backyard_rain();
}
extern "C" {
    void set_thread_globals_birds(CardGlobals* inst);
    void set_core1_thread_birds(bool is_core1);
    void run_card_birds();
}
extern "C" {
    void set_thread_globals_bends(CardGlobals* inst);
    void set_core1_thread_bends(bool is_core1);
    void run_card_bends();
}
extern "C" {
    void set_thread_globals_rompler(CardGlobals* inst);
    void set_core1_thread_rompler(bool is_core1);
    void run_card_rompler();
}
extern "C" {
    void set_thread_globals_nzt(CardGlobals* inst);
    void set_core1_thread_nzt(bool is_core1);
    void run_card_nzt();
}
extern "C" {
    void set_thread_globals_modes(CardGlobals* inst);
    void set_core1_thread_modes(bool is_core1);
    void run_card_modes();
}
extern "C" {
    void set_thread_globals_flux(CardGlobals* inst);
    void set_core1_thread_flux(bool is_core1);
    void run_card_flux();
}
extern "C" {
    void set_thread_globals_grains(CardGlobals* inst);
    void set_core1_thread_grains(bool is_core1);
    void run_card_grains();
}
extern "C" {
    void set_thread_globals_glitter(CardGlobals* inst);
    void set_core1_thread_glitter(bool is_core1);
    void run_card_glitter();
}
extern "C" {
    void set_thread_globals_tapegrade(CardGlobals* inst);
    void set_core1_thread_tapegrade(bool is_core1);
    void run_card_tapegrade();
}
extern "C" {
    void set_thread_globals_fifths(CardGlobals* inst);
    void set_core1_thread_fifths(bool is_core1);
    void run_card_fifths();
}
extern "C" {
    void set_thread_globals_krell(CardGlobals* inst);
    void set_core1_thread_krell(bool is_core1);
    void run_card_krell();
}
extern "C" {
    void set_thread_globals_glitch(CardGlobals* inst);
    void set_core1_thread_glitch(bool is_core1);
    void run_card_glitch();
}
extern "C" {
    void set_thread_globals_lochovibes(CardGlobals* inst);
    void set_core1_thread_lochovibes(bool is_core1);
    void run_card_lochovibes();
}
extern "C" {
    void set_thread_globals_bitphase(CardGlobals* inst);
    void set_core1_thread_bitphase(bool is_core1);
    void run_card_bitphase();
}
extern "C" {
    void set_thread_globals_markov(CardGlobals* inst);
    void set_core1_thread_markov(bool is_core1);
    void run_card_markov();
}
extern "C" {
    void set_thread_globals_voices_of_sid(CardGlobals* inst);
    void set_core1_thread_voices_of_sid(bool is_core1);
    void run_card_voices_of_sid();
}
extern "C" {
    void set_thread_globals_stretchcore(CardGlobals* inst);
    void set_core1_thread_stretchcore(bool is_core1);
    void run_card_stretchcore();
}
extern "C" {
    void set_thread_globals_trace(CardGlobals* inst);
    void set_core1_thread_trace(bool is_core1);
    void run_card_trace();
}
extern "C" {
    void set_thread_globals_degenerator(CardGlobals* inst);
    void set_core1_thread_degenerator(bool is_core1);
    void run_card_degenerator();
}
extern "C" {
    void set_thread_globals_motorik(CardGlobals* inst);
    void set_core1_thread_motorik(bool is_core1);
    void run_card_motorik();
}
extern "C" {
    void set_thread_globals_wild_pebble(CardGlobals* inst);
    void set_core1_thread_wild_pebble(bool is_core1);
    void run_card_wild_pebble();
}
extern "C" {
    void set_thread_globals_talker(CardGlobals* inst);
    void set_core1_thread_talker(bool is_core1);
    void run_card_talker();
}
extern "C" {
    void set_thread_globals_computer_grids(CardGlobals* inst);
    void set_core1_thread_computer_grids(bool is_core1);
    void run_card_computer_grids();
}
extern "C" {
    void set_thread_globals_tesserae(CardGlobals* inst);
    void set_core1_thread_tesserae(bool is_core1);
    void run_card_tesserae();
}
extern "C" {
    void set_thread_globals_duo_midi(CardGlobals* inst);
    void set_core1_thread_duo_midi(bool is_core1);
    void run_card_duo_midi();
}
extern "C" {
    void set_thread_globals_toolbox(CardGlobals* inst);
    void set_core1_thread_toolbox(bool is_core1);
    void run_card_toolbox();
}
extern "C" {
    void set_thread_globals_clockwork(CardGlobals* inst);
    void set_core1_thread_clockwork(bool is_core1);
    void run_card_clockwork();
}
extern "C" {
    void set_thread_globals_castle_process(CardGlobals* inst);
    void set_core1_thread_castle_process(bool is_core1);
    void run_card_castle_process();
}
extern "C" {
    void set_thread_globals_west_coast_lpg(CardGlobals* inst);
    void set_core1_thread_west_coast_lpg(bool is_core1);
    void run_card_west_coast_lpg();
}
extern "C" {
    void set_thread_globals_origami(CardGlobals* inst);
    void set_core1_thread_origami(bool is_core1);
    void run_card_origami();
}
extern "C" {
    void set_thread_globals_cosmik_c1zzl3(CardGlobals* inst);
    void set_core1_thread_cosmik_c1zzl3(bool is_core1);
    void run_card_cosmik_c1zzl3();
}
extern "C" {
    void set_thread_globals_fr330hfr33(CardGlobals* inst);
    void set_core1_thread_fr330hfr33(bool is_core1);
    void run_card_fr330hfr33();
}
extern "C" {
    void set_thread_globals_pantograph(CardGlobals* inst);
    void set_core1_thread_pantograph(bool is_core1);
    void run_card_pantograph();
}
extern "C" {
    void set_thread_globals_chorgan(CardGlobals* inst);
    void set_core1_thread_chorgan(bool is_core1);
    void run_card_chorgan();
}
extern "C" {
    void set_thread_globals_turing_matrix(CardGlobals* inst);
    void set_core1_thread_turing_matrix(bool is_core1);
    void run_card_turing_matrix();
}
extern "C" {
    void set_thread_globals_offair2(CardGlobals* inst);
    void set_core1_thread_offair2(bool is_core1);
    void run_card_offair2();
}
extern "C" {
    void set_thread_globals_cathode(CardGlobals* inst);
    void set_core1_thread_cathode(bool is_core1);
    void run_card_cathode();
}

struct WasmCardFunctions {
    void (*set_thread_globals)(CardGlobals*);
    void (*set_core1_thread)(bool);
    void (*run_card)();
};

WasmCardFunctions g_card_functions[] = {
    { set_thread_globals_simple_midi, set_core1_thread_simple_midi, run_card_simple_midi },
    { set_thread_globals_turing_machine, set_core1_thread_turing_machine, run_card_turing_machine },
    { set_thread_globals_byo_benjolin, set_core1_thread_byo_benjolin, run_card_byo_benjolin },
    { set_thread_globals_chord_blimey, set_core1_thread_chord_blimey, run_card_chord_blimey },
    { set_thread_globals_usb_audio_bridge, set_core1_thread_usb_audio_bridge, run_card_usb_audio_bridge },
    { set_thread_globals_bumpers, set_core1_thread_bumpers, run_card_bumpers },
    { set_thread_globals_bytebeat, set_core1_thread_bytebeat, run_card_bytebeat },
    { set_thread_globals_divcom, set_core1_thread_divcom, run_card_divcom },
    { set_thread_globals_twists, set_core1_thread_twists, run_card_twists },
    { set_thread_globals_goldfish, set_core1_thread_goldfish, run_card_goldfish },
    { set_thread_globals_am_coupler, set_core1_thread_am_coupler, run_card_am_coupler },
    { set_thread_globals_noisebox, set_core1_thread_noisebox, run_card_noisebox },
    { set_thread_globals_cvmod, set_core1_thread_cvmod, run_card_cvmod },
    { set_thread_globals_mlrws, set_core1_thread_mlrws, run_card_mlrws },
    { set_thread_globals_chord_organ, set_core1_thread_chord_organ, run_card_chord_organ },
    { set_thread_globals_reverb, set_core1_thread_reverb, run_card_reverb },
    { set_thread_globals_resonator, set_core1_thread_resonator, run_card_resonator },
    { set_thread_globals_sheep, set_core1_thread_sheep, run_card_sheep },
    { set_thread_globals_slowmod, set_core1_thread_slowmod, run_card_slowmod },
    { set_thread_globals_crafted_volts, set_core1_thread_crafted_volts, run_card_crafted_volts },
    { set_thread_globals_utility_pair, set_core1_thread_utility_pair, run_card_utility_pair },
    { set_thread_globals_siren, set_core1_thread_siren, run_card_siren },
    { set_thread_globals_eighties_bass, set_core1_thread_eighties_bass, run_card_eighties_bass },
    { set_thread_globals_cirpy_wavetable, set_core1_thread_cirpy_wavetable, run_card_cirpy_wavetable },
    { set_thread_globals_esp, set_core1_thread_esp, run_card_esp },
    { set_thread_globals_vink, set_core1_thread_vink, run_card_vink },
    { set_thread_globals_drumdrum, set_core1_thread_drumdrum, run_card_drumdrum },
    { set_thread_globals_dual_quant, set_core1_thread_dual_quant, run_card_dual_quant },
    { set_thread_globals_freq_shift, set_core1_thread_freq_shift, run_card_freq_shift },
    { set_thread_globals_compulidean, set_core1_thread_compulidean, run_card_compulidean },
    { set_thread_globals_od, set_core1_thread_od, run_card_od },
    { set_thread_globals_knots, set_core1_thread_knots, run_card_knots },
    { set_thread_globals_blackbird, set_core1_thread_blackbird, run_card_blackbird },
    { set_thread_globals_backyard_rain, set_core1_thread_backyard_rain, run_card_backyard_rain },
    { set_thread_globals_birds, set_core1_thread_birds, run_card_birds },
    { set_thread_globals_bends, set_core1_thread_bends, run_card_bends },
    { set_thread_globals_rompler, set_core1_thread_rompler, run_card_rompler },
    { set_thread_globals_nzt, set_core1_thread_nzt, run_card_nzt },
    { set_thread_globals_modes, set_core1_thread_modes, run_card_modes },
    { set_thread_globals_flux, set_core1_thread_flux, run_card_flux },
    { set_thread_globals_grains, set_core1_thread_grains, run_card_grains },
    { set_thread_globals_glitter, set_core1_thread_glitter, run_card_glitter },
    { set_thread_globals_tapegrade, set_core1_thread_tapegrade, run_card_tapegrade },
    { set_thread_globals_fifths, set_core1_thread_fifths, run_card_fifths },
    { set_thread_globals_krell, set_core1_thread_krell, run_card_krell },
    { set_thread_globals_glitch, set_core1_thread_glitch, run_card_glitch },
    { set_thread_globals_lochovibes, set_core1_thread_lochovibes, run_card_lochovibes },
    { set_thread_globals_bitphase, set_core1_thread_bitphase, run_card_bitphase },
    { set_thread_globals_markov, set_core1_thread_markov, run_card_markov },
    { set_thread_globals_voices_of_sid, set_core1_thread_voices_of_sid, run_card_voices_of_sid },
    { set_thread_globals_stretchcore, set_core1_thread_stretchcore, run_card_stretchcore },
    { set_thread_globals_trace, set_core1_thread_trace, run_card_trace },
    { set_thread_globals_degenerator, set_core1_thread_degenerator, run_card_degenerator },
    { set_thread_globals_motorik, set_core1_thread_motorik, run_card_motorik },
    { set_thread_globals_wild_pebble, set_core1_thread_wild_pebble, run_card_wild_pebble },
    { set_thread_globals_talker, set_core1_thread_talker, run_card_talker },
    { set_thread_globals_computer_grids, set_core1_thread_computer_grids, run_card_computer_grids },
    { set_thread_globals_tesserae, set_core1_thread_tesserae, run_card_tesserae },
    { set_thread_globals_duo_midi, set_core1_thread_duo_midi, run_card_duo_midi },
    { set_thread_globals_toolbox, set_core1_thread_toolbox, run_card_toolbox },
    { set_thread_globals_clockwork, set_core1_thread_clockwork, run_card_clockwork },
    { set_thread_globals_castle_process, set_core1_thread_castle_process, run_card_castle_process },
    { set_thread_globals_west_coast_lpg, set_core1_thread_west_coast_lpg, run_card_west_coast_lpg },
    { set_thread_globals_origami, set_core1_thread_origami, run_card_origami },
    { set_thread_globals_cosmik_c1zzl3, set_core1_thread_cosmik_c1zzl3, run_card_cosmik_c1zzl3 },
    { set_thread_globals_fr330hfr33, set_core1_thread_fr330hfr33, run_card_fr330hfr33 },
    { set_thread_globals_pantograph, set_core1_thread_pantograph, run_card_pantograph },
    { set_thread_globals_chorgan, set_core1_thread_chorgan, run_card_chorgan },
    { set_thread_globals_turing_matrix, set_core1_thread_turing_matrix, run_card_turing_matrix },
    { set_thread_globals_offair2, set_core1_thread_offair2, run_card_offair2 },
    { set_thread_globals_cathode, set_core1_thread_cathode, run_card_cathode },
};

extern "C" {

EMSCRIPTEN_KEEPALIVE void init_card(int card_idx) {
    // Stop and delete current card if heap allocated
    ComputerCard* old_card = g_wasm_card_globals.card_ptr;
    if (old_card) {
        if (old_card->is_heap_allocated) {
            delete old_card;
        }
        g_wasm_card_globals.card_ptr = nullptr;
    }
    
    // Reset all mock globals (queues, Expected sample rate, LED brightnesses, FIFO state, etc.)
    g_wasm_card_globals.reset();
    
    g_wasm_background_tick = nullptr;
    g_wasm_core1_tick = nullptr;
    
    g_active_wasm_card_idx = card_idx;
    
    if (card_idx < 0 || card_idx >= 60) return;
    
    // Sync new card thread local globals
    g_card_functions[card_idx].set_thread_globals(&g_wasm_card_globals);
    g_card_functions[card_idx].set_core1_thread(false);
    
    // Run card initialization (returns immediately because Run() doesn't loop under __EMSCRIPTEN__)
    g_card_functions[card_idx].run_card();
}

EMSCRIPTEN_KEEPALIVE void set_inputs(float knobMain, float knobX, float knobY, int switchZ, bool p1In, bool p2In, float audioIn1, float audioIn2, float cvIn1, float cvIn2) {
    g_wasm_card_globals.g_knobs[0] = knobMain;
    g_wasm_card_globals.g_knobs[1] = knobX;
    g_wasm_card_globals.g_knobs[2] = knobY;
    g_wasm_card_globals.g_switch = switchZ;
    g_wasm_card_globals.g_pulse_in[0] = p1In;
    g_wasm_card_globals.g_pulse_in[1] = p2In;
    g_wasm_card_globals.g_audio_in[0] = audioIn1;
    g_wasm_card_globals.g_audio_in[1] = audioIn2;
    g_wasm_card_globals.g_cv_in[0] = cvIn1;
    g_wasm_card_globals.g_cv_in[1] = cvIn2;
}

EMSCRIPTEN_KEEPALIVE void set_input_connected(bool audioIn1, bool audioIn2, bool cvIn1, bool cvIn2, bool p1In, bool p2In) {
    g_wasm_card_globals.g_input_connected[0] = audioIn1;
    g_wasm_card_globals.g_input_connected[1] = audioIn2;
    g_wasm_card_globals.g_input_connected[2] = cvIn1;
    g_wasm_card_globals.g_input_connected[3] = cvIn2;
    g_wasm_card_globals.g_input_connected[4] = p1In;
    g_wasm_card_globals.g_input_connected[5] = p2In;
}

EMSCRIPTEN_KEEPALIVE void set_host_sample_rate(double rate) {
    g_wasm_card_globals.host_sample_rate = rate;
}

EMSCRIPTEN_KEEPALIVE double get_expected_sample_rate() {
    return g_wasm_card_globals.expected_sample_rate;
}


// Static buffer allocations for block processing
float g_wasm_in_L[128] = {0.0f};
float g_wasm_in_R[128] = {0.0f};
float g_wasm_cv_in1[128] = {0.0f};
float g_wasm_cv_in2[128] = {0.0f};
float g_wasm_pulse_in1[128] = {0.0f};
float g_wasm_pulse_in2[128] = {0.0f};

float g_wasm_out_L[128] = {0.0f};
float g_wasm_out_R[128] = {0.0f};
float g_wasm_cv_out1[128] = {0.0f};
float g_wasm_cv_out2[128] = {0.0f};
float g_wasm_pulse_out1[128] = {0.0f};
float g_wasm_pulse_out2[128] = {0.0f};

EMSCRIPTEN_KEEPALIVE float* get_in_L_ptr() { return g_wasm_in_L; }
EMSCRIPTEN_KEEPALIVE float* get_in_R_ptr() { return g_wasm_in_R; }
EMSCRIPTEN_KEEPALIVE float* get_cv_in1_ptr() { return g_wasm_cv_in1; }
EMSCRIPTEN_KEEPALIVE float* get_cv_in2_ptr() { return g_wasm_cv_in2; }
EMSCRIPTEN_KEEPALIVE float* get_pulse_in1_ptr() { return g_wasm_pulse_in1; }
EMSCRIPTEN_KEEPALIVE float* get_pulse_in2_ptr() { return g_wasm_pulse_in2; }

EMSCRIPTEN_KEEPALIVE float* get_out_L_ptr() { return g_wasm_out_L; }
EMSCRIPTEN_KEEPALIVE float* get_out_R_ptr() { return g_wasm_out_R; }
EMSCRIPTEN_KEEPALIVE float* get_cv_out1_ptr() { return g_wasm_cv_out1; }
EMSCRIPTEN_KEEPALIVE float* get_cv_out2_ptr() { return g_wasm_cv_out2; }
EMSCRIPTEN_KEEPALIVE float* get_pulse_out1_ptr() { return g_wasm_pulse_out1; }
EMSCRIPTEN_KEEPALIVE float* get_pulse_out2_ptr() { return g_wasm_pulse_out2; }

EMSCRIPTEN_KEEPALIVE void process_block(int count, float knobMain, float knobX, float knobY, int switchZ) {
    if (g_active_wasm_card_idx == -1) return;
    
    // Sync thread-locals in case the calling thread changed
    t_instance = &g_wasm_card_globals;
    g_card_functions[g_active_wasm_card_idx].set_thread_globals(&g_wasm_card_globals);
    
    ComputerCard* card = g_wasm_card_globals.card_ptr;
    if (!card || !g_wasm_card_globals.g_dsp_ready) {
        for (int i = 0; i < count; i++) {
            g_wasm_out_L[i] = 0.0f;
            g_wasm_out_R[i] = 0.0f;
            g_wasm_cv_out1[i] = 0.0f;
            g_wasm_cv_out2[i] = 0.0f;
            g_wasm_pulse_out1[i] = 0.0f;
            g_wasm_pulse_out2[i] = 0.0f;
        }
        return;
    }
    
    for (int i = 0; i < count; i++) {
        g_wasm_card_globals.g_knobs[0] = knobMain;
        g_wasm_card_globals.g_knobs[1] = knobX;
        g_wasm_card_globals.g_knobs[2] = knobY;
        g_wasm_card_globals.g_switch = switchZ;
        g_wasm_card_globals.g_pulse_in[0] = (g_wasm_pulse_in1[i] > 0.15f);
        g_wasm_card_globals.g_pulse_in[1] = (g_wasm_pulse_in2[i] > 0.15f);
        
        float inL_val = g_wasm_in_L[i] * 12.0f;
        g_wasm_card_globals.g_audio_in[0] = (inL_val > 6.0f) ? 6.0f : ((inL_val < -6.0f) ? -6.0f : inL_val);
        
        float inR_val = g_wasm_in_R[i] * 12.0f;
        g_wasm_card_globals.g_audio_in[1] = (inR_val > 6.0f) ? 6.0f : ((inR_val < -6.0f) ? -6.0f : inR_val);
        
        float cv1_val = g_wasm_cv_in1[i] * 12.0f;
        g_wasm_card_globals.g_cv_in[0] = (cv1_val > 6.0f) ? 6.0f : ((cv1_val < -6.0f) ? -6.0f : cv1_val);
        
        float cv2_val = g_wasm_cv_in2[i] * 12.0f;
        g_wasm_card_globals.g_cv_in[1] = (cv2_val > 6.0f) ? 6.0f : ((cv2_val < -6.0f) ? -6.0f : cv2_val);
        
        g_wasm_card_globals.dsp_phase += g_wasm_card_globals.expected_sample_rate / g_wasm_card_globals.host_sample_rate;
        while (g_wasm_card_globals.dsp_phase >= 1.0) {
            g_wasm_card_globals.virtual_time_accumulator += 1000000.0 / g_wasm_card_globals.expected_sample_rate;
            g_wasm_card_globals.virtual_time_us.store((uint64_t)g_wasm_card_globals.virtual_time_accumulator, std::memory_order_relaxed);
            card->update_inputs();
            card->ProcessSample();
            g_wasm_card_globals.dsp_phase -= 1.0;
        }
        
        static int sample_count = 0;
        sample_count++;
        if (sample_count >= 48) {
            sample_count = 0;
            card->BackgroundLoop();
            if (g_wasm_background_tick) {
                try { g_wasm_background_tick(); } catch (const ThreadExitException&) {}
            }
            if (g_wasm_core1_tick) {
                if (!g_wasm_card_globals.g_core1_fifo_driven || !g_wasm_card_globals.g_fifo_0_to_1.empty()) {
                    is_core1_thread = true;
                    try { g_wasm_core1_tick(); } catch (const ThreadExitException&) {}
                    is_core1_thread = false;
                }
            }
        }
        
        g_wasm_out_L[i] = g_wasm_card_globals.g_audio_out[0] / 12.0f;
        g_wasm_out_R[i] = g_wasm_card_globals.g_audio_out[1] / 12.0f;
        g_wasm_cv_out1[i] = g_wasm_card_globals.g_cv_out[0] / 12.0f;
        g_wasm_cv_out2[i] = g_wasm_card_globals.g_cv_out[1] / 12.0f;
        g_wasm_pulse_out1[i] = g_wasm_card_globals.g_pulse_out[0] ? 1.0f : 0.0f;
        g_wasm_pulse_out2[i] = g_wasm_card_globals.g_pulse_out[1] ? 1.0f : 0.0f;
    }
}

EMSCRIPTEN_KEEPALIVE void process_sample() {
    if (g_active_wasm_card_idx == -1) return;
    
    // Sync thread-locals in case the calling thread changed
    t_instance = &g_wasm_card_globals;
    g_card_functions[g_active_wasm_card_idx].set_thread_globals(&g_wasm_card_globals);
    
    ComputerCard* card = g_wasm_card_globals.card_ptr;
    if (card && g_wasm_card_globals.g_dsp_ready) {
        g_wasm_card_globals.dsp_phase += g_wasm_card_globals.expected_sample_rate / g_wasm_card_globals.host_sample_rate;
        
        while (g_wasm_card_globals.dsp_phase >= 1.0) {
            g_wasm_card_globals.virtual_time_accumulator += 1000000.0 / g_wasm_card_globals.expected_sample_rate;
            g_wasm_card_globals.virtual_time_us.store((uint64_t)g_wasm_card_globals.virtual_time_accumulator, std::memory_order_relaxed);
            card->update_inputs();
            card->ProcessSample();
            g_wasm_card_globals.dsp_phase -= 1.0;
        }
        
        // Cooperative time-slicing: Tick background loop every 48 samples (1ms)
        static int sample_count = 0;
        sample_count++;
        if (sample_count >= 48) {
            sample_count = 0;
            card->BackgroundLoop();
            if (g_wasm_background_tick) {
                try { g_wasm_background_tick(); } catch (const ThreadExitException&) {}
            }
            if (g_wasm_core1_tick) {
                if (!g_wasm_card_globals.g_core1_fifo_driven || !g_wasm_card_globals.g_fifo_0_to_1.empty()) {
                    is_core1_thread = true;
                    try { g_wasm_core1_tick(); } catch (const ThreadExitException&) {}
                    is_core1_thread = false;
                }
            }
        }
    }
}

EMSCRIPTEN_KEEPALIVE float get_audio_out1() { return g_wasm_card_globals.g_audio_out[0]; }
EMSCRIPTEN_KEEPALIVE float get_audio_out2() { return g_wasm_card_globals.g_audio_out[1]; }
EMSCRIPTEN_KEEPALIVE float get_cv_out1() { return g_wasm_card_globals.g_cv_out[0]; }
EMSCRIPTEN_KEEPALIVE float get_cv_out2() { return g_wasm_card_globals.g_cv_out[1]; }
EMSCRIPTEN_KEEPALIVE bool get_pulse_out1() { return g_wasm_card_globals.g_pulse_out[0]; }
EMSCRIPTEN_KEEPALIVE bool get_pulse_out2() { return g_wasm_card_globals.g_pulse_out[1]; }
EMSCRIPTEN_KEEPALIVE float get_led_brightness(int index) {
    if (index >= 0 && index < 6) return g_wasm_card_globals.g_led_brightness[index];
    return 0.f;
}
EMSCRIPTEN_KEEPALIVE uint8_t* get_flash_ptr() { return g_wasm_card_globals.g_flash_memory_val; }
EMSCRIPTEN_KEEPALIVE int get_flash_size() { return PICO_FLASH_SIZE_BYTES; }

EMSCRIPTEN_KEEPALIVE void send_midi_to_card(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
    uint8_t pkt[4] = { b0, b1, b2, b3 };
    g_wasm_card_globals.g_midi_rx_packet_queue.push(pkt);
}
EMSCRIPTEN_KEEPALIVE int read_midi_from_card(uint8_t* out_bytes, int max_len) {
    uint8_t b;
    int count = 0;
    while (count < max_len && g_wasm_card_globals.g_midi_tx_byte_queue.pop(b)) {
        out_bytes[count++] = b;
    }
    return count;
}
EMSCRIPTEN_KEEPALIVE void send_serial_to_card(uint8_t* bytes, int len) {
    g_wasm_card_globals.g_serial_rx_byte_queue.push(bytes, len);
}
EMSCRIPTEN_KEEPALIVE int read_serial_from_card(uint8_t* out_bytes, int max_len) {
    uint8_t b;
    int count = 0;
    while (count < max_len && g_wasm_card_globals.g_serial_tx_byte_queue.pop(b)) {
        out_bytes[count++] = b;
    }
    return count;
}
EMSCRIPTEN_KEEPALIVE bool is_flash_dirty() {
    return g_wasm_card_globals.g_flash_dirty.load(std::memory_order_acquire);
}
EMSCRIPTEN_KEEPALIVE void clear_flash_dirty() {
    g_wasm_card_globals.g_flash_dirty.store(false, std::memory_order_release);
}
}