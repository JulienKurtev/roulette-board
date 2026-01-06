# Documentation

---

## State Management

### `betsHistory` (Array)

- **Purpose:** Stores each individual bet placement
- **Structure:** `[{ chipValue: Number, cellLabel: String }, ...]`
- **Example:** `[{ chipValue: 1, cellLabel: "25" }, { chipValue: 5, cellLabel: "36" }]`
- **Usage:** Undo operations, state reconstruction, redrawing board

### `boardCells` (Object)

- **Purpose:** Keep total bets per cell and chip value
- **Structure:** `{ cellLabel: { chipValue: total } }`
- **Example:** `{ "25": { 1: 10, 2: 20 }, "36": { 5: 50 } }`
- **Usage:** Quick lookup of totals, display updates, doubling calculations

### `actionStack` (Array)

- **Purpose:** Tracks user actions for undo functionality
- **Structure:** `[{ action: "bet" | "double" }, ...]`
- **Example:** `[{ action: "bet" }, { action: "bet" }, { action: "double" }]`
- **Usage:** Determines what to undo (remove bet vs divide by 2)

### `chipSetRef` (Object)

- **Purpose:** DOM reference cache for chip set containers
- **Structure:** `{ "cellLabel-chipColor": HTMLElement }`
- **Example:** `{ "25-blue": <div.chip-set...>, "36-red": <div.chip-set...> }`
- **Usage:** Performance optimization — avoids repeated querySelector calls

### `stateSnapshot` (Object | null)

- **Purpose:** Saved state before clearing board
- **Structure:** `{ betsHistory: [], boardCells: {}, actionStack: [] }`
- **Usage:** Enables full restoration via undo after clear

### `isChipSelected` (Boolean)

- **Purpose:** Tracks if user has selected a chip
- **Usage:** Determines if click on cell should place bet

### `chipValue` (Number)

- **Purpose:** Currently selected chip value (1, 2, 5)
- **Usage:** Value to place when user clicks cell

---

## User Interactions

### Mouse Actions

1. **Click chip button**  
   → Selects chip, highlights button, changes cursor

2. **Click board cell (with chip selected)**  
   → Places bet, adds chip to visual stack, updates total

3. **Click outside board/chips**  
   → Deselects chip, resets cursor

4. **Click "Clear" button**  
   → Saves state, removes all chips (can be undone)

5. **Click "Undo" button**  
   → Reverses last action (bet, double, clear)

6. **Click "Double" button**  
   → Multiplies all bets by 2, updates displays

### Keyboard Actions

- **ESC**  
  → Deselects current chip

---

## Data Flow

### Placing A Bet

User selects chip  
↓  
`selectChip(chip)`  
↓  
**[Update: isChipSelected, chipValue, cursor]**  
↓  
User clicks cell  
↓  
`placeBet(chipValue, cellLabel)`  
↓  
**[Update: betsHistory, actionStack, boardCells]**  
↓  
`drawChipOnCell(chipValue, cellLabel)`  
↓  
**[Create/Update: DOM elements, chipSetRef cache]**

---

### Undo An Action

User clicks Undo (throttled)  
↓  
`prevBet()`  
↓  
Check `stateSnapshot` → Exists? → `restoreState()` → END  
↓ No  
Pop `actionStack`  
↓  
Check `action.type`:

- **"double"** → `handleDoubleData("/")` → Divide by 2 → END
- **"bet"** → Continue  
  ↓  
  Pop `lastBet`  
  ↓  
  **[Update: betsHistory, boardCells]**  
  ↓  
  `removeChip(lastBet)`  
  ↓  
  **[Update: DOM, chipSetRef]**

---

### Double Bets

User clicks Double  
↓  
`doubleBets()`  
↓  
`handleDoubleData("*")`  
↓  
For each cell → for each chipValue:

- **Multiply:** `boardCells[cell][chipValue] *= 2`
- **Update display** via `textContent`  
  ↓  
  **[Add: { action: "double" } to actionStack]**

---

### Clear Board

User clicks Clear  
↓  
`clearBets()`  
↓  
`saveState()` → Creates deep copy  
↓  
**[Reset: betsHistory, boardCells, actionStack, chipSetRef]**  
↓  
`removeChip("all")` → Removes all DOM elements  
↓  
(Later) user clicks Undo  
↓  
`restoreState()` → Rebuilds from snapshot
