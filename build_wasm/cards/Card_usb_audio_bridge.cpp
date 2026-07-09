#include "pico_mocks.h"
#include "ComputerCard.h"

extern "C" {
    void set_thread_globals_usb_audio_bridge(CardGlobals* inst) {}
    void set_core1_thread_usb_audio_bridge(bool is_core1) {}
    void run_card_usb_audio_bridge() {}
}
