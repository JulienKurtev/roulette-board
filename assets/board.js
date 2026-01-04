/**
  Documentation
  
  ============================================================================
  State Management
  ============================================================================
  
  betsHistory (Array)
    Purpose: Stores each individual bet placement
    Structure: [{ chipValue: Number, cellLabel: String }, ...]
    Example: [{ chipValue: 1, cellLabel: '25' }, { chipValue: 5, cellLabel: '36' }]
    Usage: Undo operations, state reconstruction, redrawing board
  
  boardCells (Object)
    Purpose: Keep total bets per cell and chip value
    Structure: { cellLabel: { chipValue: total } }
    Example: { '25': { 1: 10, 2: 20 }, '36': { 5: 50 } }
    Usage: Quick lookup of totals, display updates, doubling calculations
  
  actionStack (Array)
    Purpose: Tracks user actions for undo functionality
    Structure: [{ action: 'bet' | 'double' }, ...]
    Example: [{ action: 'bet' }, { action: 'bet' }, { action: 'double' }]
    Usage: Determines what to undo (remove bet vs divide by 2)
  
  chipSetRef (Object)
    Purpose: DOM reference cache for chip set containers
    Structure: { 'cellLabel-chipColor': HTMLElement }
    Example: { '25-blue': <div.chip-set.chip-set--blue>, '36-red': <div.chip-set.chip-set--red> }
    Usage: Performance optimization - avoids repeated querySelector calls
  
  stateSnapshot (Object | null)
    Purpose: Saved state before clearing board
    Structure: { betsHistory: [], boardCells: {}, actionStack: [] }
    Usage: Enables full restoration via undo after clear
  
  isChipSelected (Boolean)
    Purpose: Tracks if user has selected a chip
    Usage: Determines if click on cell should place bet
  
  chipValue (Number)
    Purpose: Currently selected chip value (1, 2, 5)
    Usage: Value to place when user clicks cell
  
  
  ============================================================================
  User Interactions:
  ============================================================================
  
  Mouse Actions:
    1. Click chip button
       → Selects chip, highlights button, changes cursor
    
    2. Click board cell (with chip selected)
       → Places bet, adds chip to visual stack, updates total
    
    3. Click outside board/chips
       → Deselects chip, resets cursor
    
    4. Click "Clear" button
       → Saves state, removes all chips (can be undone)
    
    5. Click "Undo" button
       → Reverses last action (bet, double, clear) 
    
    6. Click "Double" button
       → Multiplies all bets by 2, updates displays
  
  Keyboard Actions:
    - ESC key: Deselects current chip
  
  ============================================================================
  Data Flow:
  ============================================================================
  
  Placing A Bet:
    User Selects Chip
          ↓
    selectChip(chip)
          ↓
    [Update: isChipSelected, chipValue, cursor]
          ↓
    User Clicks Cell
          ↓
    placeBet(chipValue, cellLabel)
          ↓
    [Update: betsHistory, actionStack, boardCells]
          ↓
    drawChipOnCell(chipValue, cellLabel)
          ↓
    [Create/Update: DOM elements, chipSetRef cache]
  
  Undo An Action:
    User Clicks Undo (throttled)
          ↓
    prevBet()
          ↓
    Check stateSnapshot → Exists? → restoreState() → END
          ↓ No
    Pop actionStack
          ↓
    Check action.type:
    ├─ 'double' → handleDoubleData('/') → Divide by 2 → END
    └─ 'bet' → Continue
          ↓
    Pop lastBet
          ↓
    [Update: betsHistory, boardCells]
          ↓
    removeChip(lastBet)
          ↓
    [Update: DOM, chipSetRef]
  
  Double Bets:
    User Clicks Double
          ↓
    doubleBets()
          ↓
    handleDoubleData('*')
          ↓
    For each cell:
      For each chipValue:
        [Multiply: boardCells[cell][chipValue] = 2]
        [Update: Display via textContent]
          ↓
    [Add: { action: 'double' } to actionStack]
  
  Clear Board:
    User Clicks Clear
          ↓
    clearBets()
          ↓
    saveState() → Creates deep copy
          ↓
    [Reset: betsHistory, boardCells, actionStack, chipSetRef]
          ↓
    removeChip('all') → Removes all DOM elements
          ↓
    (Later) User Clicks Undo
          ↓
    restoreState() → Rebuilds from snapshot
  
   
	Table of Contents

	I.   Setup ----------------------------------------
	     1. DOM Elements ------------------------------
	     2. Variables ---------------------------------
	II.  Event Listeners ------------------------------
	     1. Button Events -----------------------------
	     2. Chip Selection ----------------------------
	     3. Board Interaction -------------------------
	     4. Keyboard Events ---------------------------
	III. Utility --------------------------------------
	     1. Get Chipset Ref Key -----------------------
	     2. Clean Classes -----------------------------
	     3. Throttle ----------------------------------
	IV.  UI -------------------------------------------
	     1. Change Cursor -----------------------------
	V.   State Snapshot -------------------------------
	     1. Save State --------------------------------
	     2. Restore State -----------------------------
	VI.  Chip Selection -------------------------------
	     1. Select Chip -------------------------------
	     2. Unselect Chip -----------------------------
	VII. Bet Operations -------------------------------
	     1. Place Bet ---------------------------------
	     2. Clear Bets --------------------------------
	     3. Undo Bet (prevBet) ------------------------
	     4. Double Bets -------------------------------
	     5. Handle Double Data ------------------------
	VIII. Chip Rendering ------------------------------
	     1. Draw Chip On Cell -------------------------
	     2. Remove Chip -------------------------------
	     3. Add Gap To Chip Stack ---------------------
	     4. Redraw All Chips --------------------------
 */

(function () {
  /* ------------------------------------------------------------ *\
	   I.   Setup
  \* ------------------------------------------------------------ */

  // DOM Elements
  const body = document.querySelector("body");
  const chipButtons = document.querySelectorAll(".bets__chip button");
  const clearButton = document.getElementById("clear");
  const prevButton = document.getElementById("prev");
  const doubleButton = document.getElementById("double");

  // Variables

  let isChipSelected = false,
    chipValue = 0,
    betsHistory = [],
    actionStack = [],
    boardCells = {},
    chipSetRef = {},
    stateSnapshot = null;

  const CHIP_VALUE_COLOR = {
    1: "blue",
    2: "yellow",
    5: "red",
  };

  /* ------------------------------------------------------------ *\
	   II.   Event Listeners
  \* ------------------------------------------------------------ */

  // Button events
  clearButton.addEventListener("click", clearBets);
  prevButton.addEventListener("click", throttle(prevBet, 150));
  doubleButton.addEventListener("click", doubleBets);

  //Chip Selection
  document.querySelector(".bets__chip").addEventListener("click", function (e) {
    const chipButton = e.target.closest("button");
    if (chipButton) selectChip(chipButton);
  });

  //Board Interactions
  //Place bet if user clicks inside cell with selected chip
  //Unselect chip when user click outside of the chip or cell element
  document.addEventListener("click", (e) => {
    const isChip = e.target.closest(".bets__chip button");
    const isBoardCell = e.target.closest(".cell");

    if (isChip) return;

    if (isChipSelected && isBoardCell) {
      const boardCellLabel = e.target.closest(".cell").dataset.value;

      placeBet(chipValue, boardCellLabel);
    }

    unselectChip();
  });

  //Keyboard Events
  // Unselect chip when user click esc key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") unselectChip();
  });

  /* ------------------------------------------------------------ *\
	   III.   Utilities
  \* ------------------------------------------------------------ */

  //Get chipset ref key
  function getChipSetKey(cellLabel, chipValue) {
    return `${cellLabel}-${CHIP_VALUE_COLOR[chipValue]}`;
  }

  //Clear CLasses
  function cleanClasses(elements, className) {
    elements.forEach((el) => {
      el.classList.remove(className);
    });
  }

  //Throttle clicks to prevent weird behaviour
  function throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  /* ------------------------------------------------------------ *\
	   IV.   UI
  \* ------------------------------------------------------------ */

  //Set Cursor for more intuative UI
  function setBodyCursor(chipValue) {
    body.classList.remove(
      "cursor",
      "cursor-blue",
      "cursor-yellow",
      "cursor-red"
    );
    if (chipValue) {
      body.classList.add("cursor", `cursor-${CHIP_VALUE_COLOR[chipValue]}`);
    }
  }

  /* ------------------------------------------------------------ *\
	   V.   State Snapshot
  \* ------------------------------------------------------------ */

  //Save current state to snapshot
  function saveState() {
    stateSnapshot = {
      betsHistory: betsHistory.map((bet) => ({ ...bet })),
      boardCells: Object.keys(boardCells).reduce((acc, key) => {
        acc[key] = { ...boardCells[key] };
        return acc;
      }, {}),
      actionStack: actionStack.map((action) => ({ ...action })),
    };
  }

  //Restore state from snapshot
  function restoreState() {
    if (!stateSnapshot) return false;

    betsHistory = stateSnapshot.betsHistory.map((bet) => ({ ...bet }));

    boardCells = Object.keys(stateSnapshot.boardCells).reduce((acc, key) => {
      acc[key] = { ...stateSnapshot.boardCells[key] };
      return acc;
    }, {});

    actionStack = stateSnapshot.actionStack.map((action) => ({ ...action }));

    redrawAllChips();

    stateSnapshot = null;

    return true;
  }

  /* ------------------------------------------------------------ *\
	   VI.   Chip Selection
  \* ------------------------------------------------------------ */

  //Select a chip
  function selectChip(chip) {
    cleanClasses(chipButtons, "selected");

    chip.classList.add("selected");

    isChipSelected = true;

    //Take the chip value and convert it to number type
    chipValue = +chip.dataset.value;

    setBodyCursor(chipValue);
  }

  //Unselect chip
  function unselectChip() {
    cleanClasses(chipButtons, "selected");
    isChipSelected = false;
    chipValue = 0;
    setBodyCursor(0);
  }

  /* ------------------------------------------------------------ *\
	   VII.   Bet Operations
  \* ------------------------------------------------------------ */

  function placeBet(chipValue, cellLabel) {
    betsHistory.push({
      chipValue,
      cellLabel,
    });

    actionStack.push({ action: "bet" });

    // Initialize cell object if it doesn't exist
    boardCells[cellLabel] = boardCells[cellLabel] || {};

    // Add or sum chip value
    boardCells[cellLabel][chipValue] =
      (boardCells[cellLabel][chipValue] || 0) + chipValue;

    drawChipOnCell(chipValue, cellLabel);
  }

  //Clear all bets
  function clearBets() {
    if (betsHistory.length === 0) return;

    saveState();

    betsHistory = [];
    boardCells = {};
    actionStack = [];
    chipSetRef = {};

    removeChip("all");
  }

  //Remove Last BEt and adjust the amount on the placed chip
  function prevBet() {
    // Restore from snapshot if available
    if (restoreState()) return;

    const lastAction = actionStack.pop();

    if (!lastAction) return;

    //Check if double was clicked and remove the double effect
    if (lastAction.action === "double") {
      handleDoubleData("/");
      return;
    }

    const lastbet = betsHistory.pop();
    const { cellLabel, chipValue } = lastbet;

    boardCells[cellLabel][chipValue] -= chipValue;

    // Clean up empty values
    if (boardCells[cellLabel][chipValue] === 0) {
      delete boardCells[cellLabel][chipValue];
    }

    if (Object.keys(boardCells[cellLabel]).length === 0) {
      delete boardCells[cellLabel];
    }

    removeChip(lastbet);
  }

  //Double the bets on the board
  function doubleBets() {
    if (betsHistory.length === 0) return;

    //Multiply
    handleDoubleData("*");
    actionStack.push({ action: "double" });
  }

  //Handle the double button data
  function handleDoubleData(expression) {
    //Go over board cells object to double or divide the existing chips
    for (let cell in boardCells) {
      for (let chipValue in boardCells[cell]) {
        if (expression === "/") {
          boardCells[cell][chipValue] = Math.floor(
            boardCells[cell][chipValue] / 2
          );
        } else {
          boardCells[cell][chipValue] *= 2;
        }

        // Update the chip display
        const key = getChipSetKey(cell, chipValue);
        const chipSetEl = chipSetRef[key];

        const lastChip = chipSetEl?.lastElementChild;

        if (lastChip) lastChip.textContent = boardCells[cell][chipValue];
      }
    }
  }

  /* ------------------------------------------------------------ *\
	   VIII.   Chip Rendering
  \* ------------------------------------------------------------ */
  //Draw the chip on the selected cell
  function drawChipOnCell(chipValue, cellLabel) {
    const chipSetRefKey = getChipSetKey(cellLabel, chipValue);

    // Get snapshotd chip set from ref or create one
    let chipSetEl = chipSetRef[chipSetRefKey];

    //Create new chip set if doesn't exist and append it
    if (!chipSetEl) {
      const selectedCell = document.querySelector(
        `[data-value="${cellLabel}"]`
      );
      const chipColor = CHIP_VALUE_COLOR[chipValue];

      chipSetEl = document.createElement("div");
      chipSetEl.classList.add("chip-set", `chip-set--${chipColor}`);
      selectedCell.append(chipSetEl);

      // Store the reference
      chipSetRef[chipSetRefKey] = chipSetEl;
    }

    //Create new chip html element
    const newChip = document.createElement("div");
    newChip.classList.add("small-chip");

    newChip.textContent = boardCells[cellLabel][chipValue];

    //Add Gap and append chip
    addGapToChipInStack(newChip, chipSetEl);
    chipSetEl.append(newChip);
  }

  //Remove chip from the board cells
  function removeChip(chipInfo) {
    //remove all the chips
    if (chipInfo === "all") {
      document.querySelectorAll(".chip-set").forEach((el) => el.remove());
      return;
    }

    //remove last placed chip

    const key = getChipSetKey(chipInfo.cellLabel, chipInfo.chipValue);
    const chipSet = chipSetRef[key];

    if (!chipSet) return;

    chipSet.lastElementChild?.remove();

    //if chip set is empty, remove it
    if (chipSet.children.length === 0) {
      chipSet.remove();
      delete chipSetRef[key];
      return;
    }

    // update new top chip to show current total
    const lastChip = chipSet.lastElementChild;
    if (lastChip) {
      const total = boardCells[chipInfo.cellLabel]?.[chipInfo.chipValue] ?? 0;
      lastChip.textContent = total;
    }
  }

  //Add gap on the chip in the current stack
  function addGapToChipInStack(chip, chipSetEl) {
    const chipSetCount = chipSetEl.children.length;
    chip.style.setProperty("--chip-top", `${chipSetCount}px`);
  }

  //Redraw all chips on the board
  function redrawAllChips() {
    // Rebuild stacks chip  in the exact order bets were placed
    for (const bet of betsHistory) {
      const { cellLabel, chipValue } = bet;

      drawChipOnCell(chipValue, cellLabel);
    }

    // After stacks is rebuild, make sure the top chip shows the total amount if doubles were applied
    const lastAction = actionStack[actionStack.length - 1];

    if (lastAction.action === "double") {
      for (const cellLabel in boardCells) {
        for (const chipValue in boardCells[cellLabel]) {
          const key = getChipSetKey(cellLabel, chipValue);
          const chipSetEl = chipSetRef[key];

          const lastChip = chipSetEl?.lastElementChild;
          if (lastChip) lastChip.textContent = boardCells[cellLabel][chipValue];
        }
      }
    }
  }
})();
