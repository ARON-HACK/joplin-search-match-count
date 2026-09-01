import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { getSearchQuery, searchPanelOpen } from '@codemirror/search';
import { countMatches, formatCount, EMPTY_COUNT, MatchCount } from './countMatches';

/** Debounce before recounting, so typing a query does not scan on every keystroke. */
const RECOUNT_DELAY_MS = 150;

/** Upper bound on matches counted per scan. */
const MATCH_LIMIT = 999;

/**
 * Adds a match counter to CodeMirror's search panel.
 *
 * Joplin lost this readout when it moved from CodeMirror 5 to CodeMirror 6,
 * whose stock search UI has no counter. Rather than replace the panel, this
 * appends a label into the existing one so it stays native.
 */
const matchCountPlugin = ViewPlugin.fromClass(class {
	private label: HTMLElement | null = null;
	private timer: number | null = null;
	private count: MatchCount = EMPTY_COUNT;

	// Scans are skipped unless something relevant changed.
	private lastQuery = '';
	private lastDocVersion = -1;
	private lastSelection = -1;

	constructor(private view: EditorView) {
		this.sync(view);
	}

	update(update: ViewUpdate) {
		this.sync(update.view, update.docChanged || update.selectionSet);
	}

	destroy() {
		this.clearTimer();
		this.label?.remove();
		this.label = null;
	}

	private clearTimer() {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private sync(view: EditorView, mayHaveChanged = true) {
		const panel = view.dom.querySelector('.cm-panel.cm-search') as HTMLElement | null;

		// Panel closed: drop the label so it is rebuilt fresh next time.
		if (!panel || !searchPanelOpen(view.state)) {
			this.clearTimer();
			this.label?.remove();
			this.label = null;
			this.lastQuery = '';
			return;
		}

		if (!this.label || !this.label.isConnected) {
			this.label = document.createElement('span');
			this.label.className = 'cm-search-match-count';
			// Announce updates without stealing focus from the search field.
			this.label.setAttribute('aria-live', 'polite');

			// Sit next to the navigation buttons rather than at the very end,
			// which would push the label below the wrapped "replace" row.
			const nextButton = panel.querySelector('button[name="next"]');
			if (nextButton?.parentNode) {
				nextButton.parentNode.insertBefore(this.label, nextButton);
			} else {
				panel.appendChild(this.label);
			}
			this.render();
		}

		if (!mayHaveChanged) return;

		const query = getSearchQuery(view.state);
		const docVersion = view.state.doc.length;
		const selection = view.state.selection.main.from;

		if (query.search === this.lastQuery &&
			docVersion === this.lastDocVersion &&
			selection === this.lastSelection) {
			return;
		}

		// A changed query invalidates the total, so blank it rather than leave a
		// stale number visible during the debounce.
		if (query.search !== this.lastQuery) {
			this.count = EMPTY_COUNT;
			this.render();
		}

		this.lastQuery = query.search;
		this.lastDocVersion = docVersion;
		this.lastSelection = selection;

		this.scheduleRecount();
	}

	private scheduleRecount() {
		this.clearTimer();
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.recount();
		}, RECOUNT_DELAY_MS);
	}

	private recount() {
		const query = getSearchQuery(this.view.state);
		this.count = query.valid
			? countMatches(this.view.state, query, MATCH_LIMIT)
			: EMPTY_COUNT;
		this.render();
	}

	private render() {
		if (!this.label) return;
		const query = getSearchQuery(this.view.state);
		// An empty field is not "no results", it is simply nothing to report.
		this.label.textContent = query.search ? formatCount(this.count) : '';
	}
});

export default (_context: { contentScriptId: string, postMessage: any }) => {
	return {
		plugin: (codeMirrorWrapper: any) => {
			// cm6 is undefined on the legacy CodeMirror 5 editor, which still has
			// its own built-in counter and needs nothing from us.
			if (!codeMirrorWrapper.cm6) return;
			codeMirrorWrapper.addExtension([matchCountPlugin]);
		},
		assets: () => [{ name: 'style.css' }],
	};
};
