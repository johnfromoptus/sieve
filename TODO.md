## Sieve TODO

### Bugs
- [ ] Tag filter AND logic: when multiple tags are selected, only show tracks that have ALL selected tags (current behaviour is OR — clicking a second tag doesn't narrow the results)

### Drag-and-Drop
- [ ] Drag-to-combine: drag a track onto a group header to add it to the group (custom collision detection)

### Search & Navigation (Playlist Editor)
- [ ] Search/filter within playlist: real-time filter rows by title, artist, or album
- [ ] Sort options: sort track list by title, artist, duration, or restore original Spotify order

### Track Actions
- [ ] "Remove from playlist" in right-click context menu (with confirmation dialog before deleting)

### Drafts & Publishing
- [ ] Draft saving: save current state locally without publishing to Spotify, so you can come back to it later
- [ ] Publish diff: show how many changes are pending (like a git diff count) before publishing
- [ ] Dirty state on Publish button: visually distinguish "no changes" vs "X unsaved changes" vs "synced"
- [ ] Auto-persist local edits (reorder, tags, groups) so navigating away and back doesn't lose work
- [ ] "Has unsaved changes" badge on playlist cards on the dashboard

### Undo / Redo
- [ ] Undo/redo for track reorder and tag/group operations — either Cmd+Z/Cmd+Shift+Z or a floating undo button on screen

### Navigation & Chrome
- [ ] Global top bar across all pages: "sieve" wordmark (links to dashboard) on the left; breadcrumb on playlist page (e.g. "Your playlists / testing"); Publish button moves from page header into the top bar right side; user avatar/logout on far right. Dashboard gets the same bar with "Import from Spotify" on the right instead of loose in the page body.

### Feedback & Polish
- [ ] Loading skeletons: replace "Loading..." text on dashboard and playlist page with skeleton rows
- [ ] Toast notifications for operations: tag created/assigned, group created, published successfully, errors
- [ ] Pointer cursor on all interactive elements: many clickable elements show the default cursor
- [ ] Track row drag affordance: clearer visual signal on hover that the row is draggable

### Dashboard
- [ ] Playlist card info: show track count and last published date on each card
- [ ] Delete playlist from the import/playlists selector screen (not from within the editor)
- [ ] Rename playlist inline (from within the editor header)
- [ ] Playlist stats row below the header: total runtime, track count per tag, track count per group

### Export / Portability
- [ ] Export playlist as plain text (one "Title – Artist" per line, copyable to clipboard)
  - Future: this same clipboard format could be the basis for importing a playlist from pasted text

### Keyboard Shortcuts (Low Priority)
- [ ] j/k or arrow keys to navigate rows, space/enter to select, basic power-user shortcuts

### Infrastructure
- [ ] Enforce HTTPS for dev (e.g. ngrok with stable URL or self-signed cert) and remove the SHA-256 fallback in `src/lib/pkce.ts` + `src/lib/sha256.ts`. Currently using localtunnel which generates a new URL on every restart.

### Spotify API Limitations (Dev Mode)
- [ ] Creating new playlists (from scratch or "publish as copy") returns 403 in dev mode. Works once app is approved for extended quota. "Overwrite original" works fine for imported playlists.
