This is a web app for the Werwolf Game.

The first functionality is a SOUNDBOARD.
The second functionality is playing Werewolf only on mobile (without a narrator).
This means that everyone get's his/her role via the application, then does their actions during the night and the voting during the day.

# Structure

There is the frontend (`frontend/`) and the backend (`backend/`).
Both are written with typescript.

# Development Setup

- **Backend Port:** 3000
- **Frontend Port:** 5173
- **Workflow:** A `werwolf_tmux.sh` script is available to set up a tmux session with panes for `npm run dev` in both folders.
- **Environment:** Backend uses `.env` for configuration (e.g., `ORIGIN` for CORS).
- **Module System:** Backend is configured as ESM (`"type": "module"`).

# Backend Architecture

The backend is a pure **Node.js `http` + `socket.io`** application. **No Express is used.**
No database is used; all games are stored in-memory.

## Core Components (`backend/src/`)

### 1. Entry Point (`index.ts`)
- **Responsibility:** Initializes the HTTP server and Socket.IO server.
- **Initialization:** Calls `socketService.init(io)` to set up the singleton.
- **Event Handling:** Sets up the `io.on('connection')` listener. It acts as the "Controller", receiving raw socket events (like `joinGame`) and delegating the business logic to `GameManager`.
- **Error Handling:** Wraps handler calls in a `handleErrors` helper to catch exceptions and send typed error messages back to the client via `socketService`.

### 2. Communication Layer (`socket.service.ts`)
- **Responsibility:** Singleton class that abstracts all outbound `Socket.IO` communication.
- **Pattern:** Replaces scattered `io.to().emit()` calls with semantic, typed methods.
- **Features:**
    - `notifyGameCreated`, `notifyPlayerJoined`
    - `notifyPhaseUpdate`, `notifyNextActiveRole`
    - Role-specific notifications: `notifySeerResult`, `notifyWerewolfVote`, etc.
    - Error notifications.

### 3. Business Logic (`logic/`)
- **`game.manager.ts`**: The central orchestrator.
    - Manages Game State (Lobby -> Setup -> Night -> Day).
    - Handles player joins, name changes, and voting.
    - Delegates specific role actions during the night to `role.handler.ts`.
    - **Note:** It does *not* take `io` as an argument anymore; it uses the `socketService` singleton for updates.
- **`role.handler.ts`**: Contains specific logic for each role (Seer, Witch, Cupid, etc.).
    - `WerewolfHandler`: Handles voting logic.
    - `SeerHandler`: Resolves looking at cards.
    - `nextRole(game)`: A utility function that determines the next role to wake up based on `ROLES` metadata and the current game state.

### 4. Data Storage (`store/`)
- **`game.store.ts`**: Singleton in-memory database (`Map<string, Game>`).

## Data Models
- **Enums:** String Enums are used for `Role` (e.g., `"WEREWOLF"`) and `Phase` (e.g., `"NIGHT"`) for better logging and serialization.
- **Player State:** Role-specific attributes (like "hasHealPotion" or "inLoveWith") are stored in `Player.attributes` to persist across rounds.

## Game Logic (State Machine)
The game follows a strict phase sequence:
1.  **LOBBY**: Players join via QR code/Socket.
2.  **SETUP**: Game Master selects roles.
3.  **DISTRIBUTION**: Roles are assigned.
4.  **NIGHT**: A sequence of sub-turns (Seer -> Wolves -> Witch -> ...).
    - The `Game` object tracks `activeNightRole` to know whose turn it is.
    - `role.handler.ts` manages the transition between roles using `nextRole`.
5.  **DAY**: Discussion and Voting.
    - Voting logic is handled in `GameManager.vote`.
    - Lnyching resolution triggers a return to **NIGHT**.
6.  **GAME_OVER**: Win condition met.

# Frontend Architecture

## Core Concepts

The frontend is built without a heavy framework (like React or Vue), relying on a custom, lightweight component system.

### 1. View Architecture ("Active View")
- **Interface:** All pages implement the `View` interface (`mount(container)`).
- **Self-Updating:** Views are "Active". They subscribe to the global store (`store.ts`) inside their `mount` method and handle their own DOM updates when the state changes.

### 2. Routing (`src/router.ts`)
- A simple Hash-based router (`#/`, `#/game/:id`).
- Handles the lifecycle of top-level views
- **StartPage:** (`src/pages/start.ts`) Entry point for creating/joining games.
- **GamePage:** (`src/pages/game.ts`) The main container for gameplay.

### 3. Game Page & Phase Management
The `GamePage` acts as a **Controller/Container** rather than a static page.
- **Structure:** It renders a persistent header (Game ID, Player Name/UUID) and a dynamic container (`#phase-view-container`).
- **Phase Switching:** It observes `state.phase`. When the phase changes, it dynamically swaps the sub-view in the container.
- **Sub-Views:** Located in `src/pages/phases/`.
    - `LobbyPhase` (`phases/lobby.ts`): UI for the waiting room.
    - `PlaceholderPhase` (`phases/placeholder.ts`): Generic view for unimplemented phases.
    - *Future phases (Night, Day, etc.) will be added here as separate classes.*

### 4. State Management (`src/store.ts`)
- A simple observable store pattern.
- Exports `getState()`, `setState(patch)`, and `subscribe(listener)`.
- Holds the entire `AppState` including `gameId`, `playerUUID`, `phase`, `players` list, etc.

### 5. Communication (`src/socket.service.ts`)
- A singleton `SocketService` wraps the `socket.io-client`.
- **Inbound:** Listens for server events (`gameCreated`, `phaseChange`) and updates the global Store via `setState`.
- **Outbound:** Provides methods (`createGame`, `joinGame`) for views to send actions to the server.

## Folder Structure (`frontend/src/`)
- **`router.ts`**: Navigation logic.
- **`store.ts`**: Global state.
- **`socket.service.ts`**: WebSocket communication.
- **`pages/`**:
    - **`start.ts`**: Landing page.
    - **`game.ts`**: Main Game Controller.
    - **`phases/`**: Sub-views for specific game phases.