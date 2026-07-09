// =========================================================================
// 3. CARD REGISTRY & STATE MANAGEMENT
// =========================================================================

// NOTE: 'AVAILABLE_CARDS' is now populated automatically in globals.js 
// by the individual card files as they load.

function swapComputerCard(typeIdOrName) {
    // 0. Safety Check for Empty Library
    if (!window.AVAILABLE_CARDS || window.AVAILABLE_CARDS.length === 0) {
        console.warn("Card Library is empty. Cannot swap.");
        // Ensure UI reflects "No Card" if we somehow got here
        const labelEl = document.getElementById('activeCardLabel');
        if (labelEl) labelEl.textContent = "No Card";
        return;
    }

    // 1. Resolve Definition
    let cardDef = AVAILABLE_CARDS.find(c => c.id === typeIdOrName || c.name === typeIdOrName);

    // Fallback logic
    if (!cardDef) {
        if (typeIdOrName === 'none') cardDef = AVAILABLE_CARDS.find(c => c.id === 'none');
        // If no match, leave slot empty rather than defaulting to a card
        else cardDef = AVAILABLE_CARDS.find(c => c.id === 'none') || AVAILABLE_CARDS[0];
    }

    // Double check we actually found something (edge case: library only has 1 broken item)
    if (!cardDef) return;

    window.activeComputerCardId = cardDef.id;

    // 2. Unmount Old
    if (activeComputerCard) {
        if (activeComputerCard.unmount) activeComputerCard.unmount();
        activeComputerCard = null;
    }

    // 3. Mount New
    // FIX: Allow instantiation even if audio is off so cards can still mount UI/labels
    if (cardDef && typeof cardDef.class === 'function') {
        try {
            // Pass null for ctx/io if not available
            const ctx = (typeof audioCtx !== 'undefined') ? audioCtx : null;
            const io = (typeof audioNodes !== 'undefined') ? audioNodes['Computer_IO'] : null;

            activeComputerCard = new cardDef.class(ctx, io);
            activeComputerCard.name = cardDef.name;
            activeComputerCard.mount();
        } catch (err) {
            console.error(`Failed to mount card ${cardDef.name}:`, err);
            // Fallback to dummy if instantiation crashes
            activeComputerCard = {
                name: cardDef.name,
                fake: true,
                update: () => { }
            };
        }
    } else {
        // Dummy placeholder if loading fails or it's a "virtual" card with no audio class yet
        activeComputerCard = {
            name: cardDef ? cardDef.name : "Error",
            fake: true,
            update: () => { }
        };
    }

    // 4. Update Visuals
    const tooltipEl = document.getElementById('activeCardTooltip');
    if (tooltipEl) {
        let html = `<strong>${cardDef.name}</strong> [Firmware ${cardDef.num}]<br><em style="color:#a1a1aa">${cardDef.category || ""}</em><hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:4px 0">${cardDef.desc}`;
        let credits = [];
        if (cardDef.creator) credits.push(`Original card: ${cardDef.creator}`);
        if (cardDef.license) credits.push(`License: ${cardDef.license}`);
        if (cardDef.repository) credits.push(`<a href="${cardDef.repository}" target="_blank" style="color:#60a5fa;text-decoration:underline;">Source Code</a>`);
        if (credits.length > 0) {
            html += `<hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"><div style="font-size:11px;color:#a1a1aa;line-height:1.4">${credits.join(" &bull; ")}</div>`;
        }
        tooltipEl.innerHTML = html;
    }

    updateCardVisuals(cardDef);

    // Flash Effect
    const labelContainer = document.getElementById('activeCardLabelContainer');
    const digitEl = document.getElementById('activeCardDigits');
    if (labelContainer && cardDef.id !== 'none') {
        labelContainer.style.opacity = 0;
        if (digitEl) digitEl.style.opacity = 0;
        setTimeout(() => {
            labelContainer.style.opacity = 1;
            if (digitEl) digitEl.style.opacity = 0.9;
        }, 50);
    }

    if (typeof renderComponentLabels === 'function') renderComponentLabels();

    // Check historyIndex to ensure we are initialized before saving state
    if (typeof historyIndex !== 'undefined' && historyIndex >= 0) saveState();
}

function cycleNextCard() {
    if (!window.AVAILABLE_CARDS || window.AVAILABLE_CARDS.length === 0) return;

    const labelEl = document.getElementById('activeCardLabel');
    const currentName = labelEl ? labelEl.textContent : 'No Card';

    let currentIdx = AVAILABLE_CARDS.findIndex(c => c.name === currentName);

    // If current card isn't found (or is "No Card"), start from -1 so next is 0
    if (currentIdx === -1) currentIdx = AVAILABLE_CARDS.length - 1;

    const nextIdx = (currentIdx + 1) % AVAILABLE_CARDS.length;
    swapComputerCard(AVAILABLE_CARDS[nextIdx].id);
}

// =========================================================================
// 4. UI: CARD SELECTOR
// =========================================================================

let showOnlyImplemented = true; // Default to showing only working cards

function initCardSelector() {
    if (document.getElementById('cardSelectorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'cardSelectorModal';
    modal.innerHTML = `
        <div class="card-modal-content">
            <div class="card-modal-header">
                <span class="card-modal-title">PROGRAM LIBRARY</span>
                
                <div class="card-modal-controls">
                     <label class="toggle-label">
                        <input type="checkbox" id="cardFilterToggle" ${showOnlyImplemented ? 'checked' : ''}>
                        <span class="toggle-text">Virtual Cards Only</span>
                    </label>
                    <button class="card-modal-close" id="closeCardModal">&times;</button>
                </div>
            </div>
            <div id="cardGrid" class="card-grid"></div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close Button
    const closeBtn = document.getElementById('closeCardModal');
    closeBtn.addEventListener('click', closeCardSelector);
    closeBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        closeCardSelector();
    });

    // Toggle Checkbox
    document.getElementById('cardFilterToggle').addEventListener('change', (e) => {
        showOnlyImplemented = e.target.checked;
        renderCardGrid();
    });

    // Backdrop Click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCardSelector();
    });
}

function closeCardSelector() {
    const modal = document.getElementById('cardSelectorModal');
    if (modal) modal.classList.remove('open');
}

function renderCardGrid() {
    const grid = document.getElementById('cardGrid');
    grid.innerHTML = '';

    if (!window.AVAILABLE_CARDS || window.AVAILABLE_CARDS.length === 0) {
        grid.innerHTML = '<div style="color:#aaa; padding:20px; text-align:center;">Library is empty.</div>';
        return;
    }

    let currentId = 'none';
    if (activeComputerCard) {
        const found = AVAILABLE_CARDS.find(c => c.name === activeComputerCard.name);
        if (found) currentId = found.id;
    }

    // Filter Logic
    const cardsToShow = AVAILABLE_CARDS.filter(card => {
        if (card.id === 'none') return true; // Always show "No Card"
        if (showOnlyImplemented) return card.hasImplementation;
        return true;
    });

    if (cardsToShow.length === 0) {
        grid.innerHTML = '<div style="color:#aaa; padding:20px;">No web-audio cards available yet. Uncheck "Virtual Cards Only" to see full library.</div>';
        return;
    }

    cardsToShow.forEach(card => {
        const el = document.createElement('div');
        el.className = 'mini-card';
        if (card.id === currentId) el.classList.add('active-card');

        // Visual distinction for Dummy cards
        if (!card.hasImplementation && card.id !== 'none') {
            el.classList.add('dummy-card');
        }

        el.innerHTML = `
            <div class="mc-header">
                <span class="mc-num">${card.num}</span>
                ${card.hasImplementation ? '<span class="mc-badge">AUDIO</span>' : ''}
            </div>
            <div>
                <div class="mc-label">${card.name}</div>
                <div class="mc-desc">${card.desc ? card.desc.split('\n')[0] : ''}</div> 
            </div>
        `;

        // Handle both Click and Touch for selection
        const selectAction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectCardFromMenu(card.id);
        };

        el.addEventListener('click', selectAction);
        el.addEventListener('touchend', selectAction);

        grid.appendChild(el);
    });
}

function openCardSelector() {
    initCardSelector();
    renderCardGrid();
    document.getElementById('cardSelectorModal').classList.add('open');
}

function selectCardFromMenu(cardId) {
    const slot = document.querySelector('.card-slot-container');
    closeCardSelector();

    if (slot) {
        slot.classList.add('insert');
        setTimeout(() => {
            swapComputerCard(cardId);
            slot.classList.remove('insert');
            slot.classList.add('eject');

            const cardEl = slot.querySelector('.program-card');
            if (cardEl) cardEl.style.opacity = '1';

            setTimeout(() => slot.classList.remove('eject'), 150);
        }, 150);
    } else {
        swapComputerCard(cardId);
    }
}

// =========================================================================
// 5. UI: SLOT RENDERING
// =========================================================================

function updateCardVisuals(cardDef) {
    const cardEl = document.querySelector('.program-card');
    if (!cardEl) return;

    if (!cardDef || cardDef.id === 'none') {
        cardEl.style.display = 'block';
        cardEl.style.opacity = '1';
        cardEl.style.backgroundImage = "url(images/card_blank.svg)";
        cardEl.classList.remove('svg-prebaked');
        
        const labelContainer = document.getElementById('activeCardLabelContainer');
        if (labelContainer) labelContainer.innerHTML = '';
        
        const digitEl = document.getElementById('activeCardDigits');
        if (digitEl) digitEl.textContent = '';
        
        const logo = cardEl.querySelector('.card-decoration');
        if (logo) logo.style.display = 'none';

        const labelEl = document.getElementById('activeCardLabel');
        if (labelEl) labelEl.textContent = 'No Card';

        return;
    }

    cardEl.style.display = 'block';
    cardEl.style.opacity = '1';

    const logo = cardEl.querySelector('.card-decoration');
    if (logo) logo.style.display = 'block';

    // 1. Determine background SVG
    let bgUrl = 'images/card_blank.svg';
    let isPrebaked = false;

    if (cardDef.id === 'turing' || cardDef.id === 'turing_machine') {
        bgUrl = 'images/card_turing.svg';
        isPrebaked = true;
    } else if (cardDef.id === 'reverb') {
        bgUrl = 'images/card_reverb.svg';
        isPrebaked = true;
    } else if (cardDef.id === 'midi' || cardDef.id === 'simple_midi') {
        bgUrl = 'images/card_midi.svg';
        isPrebaked = true;
    }

    cardEl.style.backgroundImage = `url(${bgUrl})`;
    if (isPrebaked) {
        cardEl.classList.add('svg-prebaked');
    } else {
        cardEl.classList.remove('svg-prebaked');
    }

    // 2. Update Digits
    const digitEl = document.getElementById('activeCardDigits');
    if (digitEl) {
        digitEl.textContent = cardDef.num;
    }

    // 3. Update hidden label for DOM lookups (preserves compatibility)
    const labelEl = document.getElementById('activeCardLabel');
    if (labelEl) {
        labelEl.textContent = cardDef.name;
    }

    // 4. Update Label Container (split into rotated vertical words)
    const labelContainer = document.getElementById('activeCardLabelContainer');
    if (labelContainer) {
        labelContainer.innerHTML = '';
        
        let nameText = cardDef.name;
        if (cardDef.id === 'utility_pair' && activeComputerCard && !activeComputerCard.fake) {
            const UTILITIES_SHORT = [
                "Attn","Bern","Crsh","Chrd","Chor","C.Div","Cross","CVMx",
                "Dly","Eucl","Gltc","K-S","LPG","Max","Qnt","S&H",
                "Slp","LFO","Saw","T185","VCA","VCO","Fold","W.Cmp"
            ];
            const l = activeComputerCard.utilityIndexL;
            const r = activeComputerCard.utilityIndexR;
            if (l >= 0 && l < 24 && r >= 0 && r < 24) {
                nameText = UTILITIES_SHORT[l] + " " + UTILITIES_SHORT[r];
            }
        }

        // Split name into 2 lines at the space closest to the middle of the string
        let line1 = nameText.toUpperCase();
        let line2 = "";
        const spaces = [];
        for (let i = 0; i < line1.length; i++) {
            if (line1[i] === ' ') spaces.push(i);
        }
        if (spaces.length > 0) {
            let bestSpace = spaces[0];
            let minDiff = Math.abs(bestSpace - (line1.length - 1 - bestSpace));
            for (let i = 1; i < spaces.length; i++) {
                const diff = Math.abs(spaces[i] - (line1.length - 1 - spaces[i]));
                if (diff < minDiff) {
                    minDiff = diff;
                    bestSpace = spaces[i];
                }
            }
            line1 = nameText.toUpperCase().substring(0, bestSpace);
            line2 = nameText.toUpperCase().substring(bestSpace + 1);
        }

        const lines = line2 ? [line1, line2] : [line1];
        labelContainer.className = `card-label-container words-${lines.length}`;
        lines.forEach((word, idx) => {
            const wordEl = document.createElement('div');
            wordEl.className = `card-word card-word-${idx}`;
            wordEl.textContent = word;

            // Calculate font size using VCV's exact algorithm:
            let fs = 11.0; // in SVG units (where card width is 32)
            const approx_w = word.length * fs * 0.7;
            if (approx_w > 38.0) {
                fs = 38.0 / (word.length * 0.7);
            }
            if (fs < 5.0) fs = 5.0;

            // Convert to cqw (percentage of card width: fs / 32 * 100)
            const fsCqw = (fs / 32.0) * 100.0;
            wordEl.style.fontSize = `${fsCqw}cqw`;

            labelContainer.appendChild(wordEl);
        });
    }
}

function renderCardSlot() {
    const container = document.getElementById('synthContainer');
    const old = document.getElementById('computerCardSlot');
    if (old) old.remove();

    const slot = document.createElement('div');
    slot.className = 'card-slot-container';
    slot.id = 'computerCardSlot';
    slot.title = "Click to open card library";

    const tooltip = document.createElement('div');
    tooltip.className = 'card-tooltip';
    tooltip.id = 'activeCardTooltip';

    const card = document.createElement('div');
    card.className = 'program-card';
    card.style.pointerEvents = 'none';

    // Initial State
    let targetId = 'none';

    if (activeComputerCard) {
        // Try to find the active card in the library
        const found = (window.AVAILABLE_CARDS || []).find(c => c.name === activeComputerCard.name);
        if (found) targetId = found.id;
    } else if (typeof history !== 'undefined' && history[historyIndex] && history[historyIndex].activeCardId) {
        targetId = history[historyIndex].activeCardId;
    }

    const def = (window.AVAILABLE_CARDS || []).find(c => c.id === targetId);

    // Build DOM
    const labelContainer = document.createElement('div');
    labelContainer.className = 'card-label-container';
    labelContainer.id = 'activeCardLabelContainer';

    const hiddenLabel = document.createElement('div');
    hiddenLabel.id = 'activeCardLabel';
    hiddenLabel.style.display = 'none';

    const logo = document.createElement('div');
    logo.className = 'card-decoration';
    logo.innerHTML = "Music<br>Thing<br>Modular";

    const digits = document.createElement('div');
    digits.className = 'card-digits';
    digits.id = 'activeCardDigits';

    card.appendChild(labelContainer);
    card.appendChild(hiddenLabel);
    card.appendChild(logo);
    card.appendChild(digits);
    slot.appendChild(card);

    let descText = "";
    if (def) {
        descText = `<strong>${def.name}</strong> [Firmware ${def.num}]<br><em style="color:#a1a1aa">${def.category || ""}</em><hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:4px 0">${def.desc}`;
        let credits = [];
        if (def.creator) credits.push(`Original card: ${def.creator}`);
        if (def.license) credits.push(`License: ${def.license}`);
        if (def.repository) credits.push(`<a href="${def.repository}" target="_blank" style="color:#60a5fa;text-decoration:underline;">Source Code</a>`);
        if (credits.length > 0) {
            descText += `<hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"><div style="font-size:11px;color:#a1a1aa;line-height:1.4">${credits.join(" &bull; ")}</div>`;
        }
    }
    tooltip.innerHTML = descText;
    slot.appendChild(tooltip);

    // Create button container for easier positioning
    const btnContainer = document.createElement('div');
    btnContainer.className = 'card-btn-container';
    btnContainer.id = 'cardBtnContainer';
    slot.appendChild(btnContainer);

    // Add a dedicated Menu/Library button for easier mobile access
    const libBtn = document.createElement('div');
    libBtn.className = 'card-lib-btn';
    libBtn.textContent = 'LIBRARY';
    btnContainer.appendChild(libBtn);
    libBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCardSelector();
    });
    libBtn.addEventListener('touchstart', (e) => {
        // Stop propagation so it doesn't trigger the slot's touchstart cycle logic
        e.stopPropagation();
        openCardSelector();
    }, { passive: false });

    // --- INTERACTION LOGIC ---

    const handleOpenLibrary = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        openCardSelector();
    };

    // Add listeners for both Mouse and Touch
    slot.addEventListener('mousedown', (e) => {
        if (e.button === 0) handleOpenLibrary(e);
    });

    // Touch: tap opens the library
    slot.addEventListener('touchend', (e) => {
        handleOpenLibrary(e);
    });

    // Right Click (Still supported for desktop)
    slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCardSelector();
    });

    // Remove any existing reset button first
    const oldReset = document.getElementById('computerResetBtn');
    if (oldReset) oldReset.remove();

    // Create physical reset button
    const resetBtn = document.createElement('div');
    resetBtn.className = 'computer-reset-btn';
    resetBtn.id = 'computerResetBtn';
    resetBtn.title = "Reset Program Card (reboots VM & preserves flash)";

    const handleReset = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (window.activeComputerCardId && window.activeComputerCardId !== 'none') {
            // Trigger visual eject/insert animation on the slot
            slot.classList.add('eject');
            
            // Call the card's reset method or re-swap it
            if (activeComputerCard && typeof activeComputerCard.reset === 'function') {
                activeComputerCard.reset();
            } else {
                swapComputerCard(window.activeComputerCardId);
            }

            setTimeout(() => {
                slot.classList.remove('eject');
                slot.classList.add('insert');
                setTimeout(() => slot.classList.remove('insert'), 150);
            }, 150);
        }
    };

    resetBtn.addEventListener('mousedown', (e) => {
        if (e.button === 0) handleReset(e);
    });
    resetBtn.addEventListener('touchstart', handleReset, { passive: false });

    container.appendChild(slot);
    container.appendChild(resetBtn);

    if (typeof updateInterfaceScaling === 'function') updateInterfaceScaling();
}