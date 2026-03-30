## Sieve TODO

### UX Polish
- [ ] Replace tag delete hover-X with right-click context menu
- [ ] Maintain scroll position when toggling tag filters (currently snaps to top)
- [ ] Move drag handle (grip bar) to the right side of tracks and groups (currently on the left)
- [ ] Randomise tag colour when creating a tag via Enter without manually picking a colour
- [ ] Track colour bar: add a thin vertical bar to the left edge of album art per track. Invisible by default, outline appears on hover, clicking opens a colour picker tooltip to set the bar's fill+outline colour. Purely visual categorisation, independent of tags — not filterable.

### Drag-and-Drop
- [ ] Drag-to-combine: drag a track onto a group header to add it to the group (custom collision detection)
- [ ] Fix drag stickiness: dragged song should be glued to the cursor, not lagging behind or getting stuck when passing other items. Likely need to switch from CSS.Transform to a DragOverlay approach.
- [ ] Fix group drag visual: dragging a group shows a squashed/compressed rendering. Use DragOverlay with a proper snapshot of the group at its original dimensions.

### Spotify API Limitations (Dev Mode)
- [ ] Creating new playlists (from scratch or "publish as copy") returns 403 in dev mode. Works once app is approved for extended quota. "Overwrite original" works fine for imported playlists.
