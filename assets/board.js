/**  
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

  // Button eventss
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
    } else {
      unselectChip();
    }
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

  // Disable double tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    function (event) {
      const now = Date.now();
      if (now - lastTouchEnd <= 100) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    false,
  );

  /* ------------------------------------------------------------ *\
	   IV.   UI
  \* ------------------------------------------------------------ */

  //Set Cursor for more intuative UI
  function setBodyCursor(chipValue) {
    body.classList.remove(
      "cursor",
      "cursor-blue",
      "cursor-yellow",
      "cursor-red",
    );
    if (chipValue) {
      body.classList.remove("initial");
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
            boardCells[cell][chipValue] / 2,
          );
        } else {
          boardCells[cell][chipValue] *= 2;
        }

        // Update the chip display
        const key = getChipSetKey(cell, chipValue);
        const chipSetEl = chipSetRef[key];

        const lastChip = chipSetEl?.lastElementChild;

        if (lastChip) {
          lastChip.textContent = boardCells[cell][chipValue];
          lastChip.setAttribute("title", boardCells[cell][chipValue]);
        }
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
        `[data-value="${cellLabel}"]`,
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
    newChip.setAttribute("title", boardCells[cellLabel][chipValue]);

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
    const selectedCell = chipSetEl.closest(".cell");

    let cellHeight = selectedCell.offsetHeight;

    if (selectedCell.classList.contains("cell--green")) cellHeight -= 15;

    chip.style.setProperty(
      "--chip-top",
      `${Math.min(chipSetCount, cellHeight - 25)}px`,
    );
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
