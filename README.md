# Joplin Search Match Count

Restores the search match counter — `3/17` — in Joplin's Markdown editor search panel.

## Why

Joplin's "search in current note" used to show a tally of matches. It disappeared
around **v3.2.12**, when Joplin migrated from CodeMirror 5 to CodeMirror 6: the
stock CodeMirror 6 search UI has no counter, and Joplin adopted it as-is.

The gap is still open — there is a
[forum request](https://discourse.joplinapp.org/t/restore-match-count-for-search-in-current-note/44864)
from April 2025, and nothing in the desktop changelog through v3.7.x restores it.
The only workaround offered is reverting to the legacy CodeMirror 5 editor.

This plugin adds the counter back to the *existing* panel, so `Ctrl+F` keeps
working exactly as it does now — just with the number you're missing.

## Install

**From the `.jpl`:** build it (below), then in Joplin go to
*Tools → Options → Plugins → gear icon → Install from file* and pick
`publish/com.aronwu.search-match-count.jpl`.

**For development:** *Tools → Options → Plugins → Advanced* and add this
repository's path to *Development plugins*.

## Build

```bash
npm install
npm run dist     # builds dist/ and publish/<id>.jpl
npm test         # runs the counting logic against real CodeMirror
```

## How it works

CodeMirror 6 only computes search highlights for the **viewport**, so there is no
built-in total to read — the information genuinely does not exist until someone
scans for it. This plugin uses the approach
[recommended by CodeMirror's maintainer](https://discuss.codemirror.net/t/getting-search-matches-count/6628):
run `SearchQuery.getCursor()` over the document and tally the results.

That scan is the whole cost of the feature, so it is kept cheap:

- **Debounced** by 150ms, so typing a query does not rescan on every keystroke.
- **Capped** at 999 matches, displayed as `999+`. On a 1.2MB note this is the
  difference between **2ms** and **81ms** per scan.
- **Skipped** entirely unless the query, document length, or selection changed,
  and while the search panel is closed.

The counter is inserted next to the panel's navigation buttons rather than
appended at the end, which would push it onto a second row when the replace
field is visible. It carries `aria-live="polite"` so screen readers announce
updated counts without focus leaving the search field.

On the legacy CodeMirror 5 editor the plugin does nothing — that editor still has
its own counter.

## Scope

This covers the match counter only. Scrollbar tick marks showing where matches
sit in the document (as VS Code does) are a separate feature: CodeMirror 5's
`annotateScrollbar` was never ported to v6, and per CodeMirror's maintainer it
needs a custom overlay along the editor's right edge rather than real scrollbar
annotation.

## License

MIT
