# TODO — Battleships

- [x] **Fix hint button overlapping settings panel** — the fixed hint toggle (top-right) and/or saved-maps toggle overlap the EA settings panel / drawers. Reposition or hide the toggle(s) while a panel is open.
- [x] **Fix hint overlapping EA win popup** — the `vsEa.eaWon` hint modal collides with the EA winning popup (`EAWinOverlay`). Sequence them or suppress one.
- [ ] **Fix EA last replay logic** — the "Watch Last Replay" (`vsEa.replayButton` / `EAReplayOverlay`) behaviour is buggy; investigate what it shows and when it's available.
- [x] **Remove EA last replay autoplay button** — drop the autoplay (play/pause) control from `EAReplayOverlay`.
- [ ] **Edit description texts** — review and revise copy across the Battleships UI (hints, mode descriptions, overlays, etc.).
- [x] **Probes after winning not registered**
- [x] **Ea continues counting "solved in x generations" even after being done**
- [x] **Let the player adjust settings more (from 0-100 not 50-80)**
