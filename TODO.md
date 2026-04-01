## Sieve TODO

### UX Polish
- [x] Replace tag delete hover-X with right-click context menu
- [x] Maintain scroll position when toggling tag filters (currently snaps to top)
- [x] Move drag handle (grip bar) to the right side of tracks and groups (currently on the left)
- [x] Randomise tag colour when creating a tag via Enter without manually picking a colour
- [ ] Track colour bar: add a thin vertical bar to the left edge of album art per track. Invisible by default, outline appears on hover, clicking opens a colour picker tooltip to set the bar's fill+outline colour. Purely visual categorisation, independent of tags — not filterable.

### Track Tagging & Grouping (Inline)
- [ ] Inline tag creation in track tag popover: add a "New tag" form at the bottom of the per-track tag assignment popover. Creates the tag and immediately applies it to the track — no need to scroll to the top filter bar first.
- [ ] Inline group creation in track group menu: always show the FolderPlus icon (currently hidden when no groups exist). Add a "New group..." option at the bottom of the dropdown. Creates the group at the track's current position and assigns the track to it in one action.

### Multi-Select
- [ ] Click row body to select a track (deselects others). Ctrl/Cmd+click toggles individual tracks. Shift+click range-selects. Clicking tag icon, group icon, drag handle, or other buttons on a row does NOT trigger selection.
- [ ] Tag/group icon selection rules: clicking an icon on a SELECTED track operates on ALL selected tracks; clicking an icon on an UNSELECTED track operates on only that track (selection unchanged).
- [ ] Floating selection bar: appears at the bottom of the screen when 2+ tracks are selected, showing "N tracks selected" and a clear-selection button.
- [ ] Right-click context menu on track rows: shows "Assign tag" and "Add to group" options, opening the same inline popovers. Follows the selected/unselected rules above. Inline tag/group creation within the context menu is deferred — covered by the inline creation tasks above.

### Drag-and-Drop
- [ ] Drag-to-combine: drag a track onto a group header to add it to the group (custom collision detection)
- [x] Fix drag stickiness: switched to DragOverlay — dragged item now renders as floating clone under cursor
- [x] Fix group drag visual: DragOverlay renders group at full natural dimensions

### Infrastructure
- [ ] Enforce HTTPS for dev (e.g. ngrok with stable URL or self-signed cert) and remove the SHA-256 fallback in `src/lib/pkce.ts` + `src/lib/sha256.ts`. Currently using localtunnel which generates a new URL on every restart.

### Spotify API Limitations (Dev Mode)
- [ ] Creating new playlists (from scratch or "publish as copy") returns 403 in dev mode. Works once app is approved for extended quota. "Overwrite original" works fine for imported playlists.
