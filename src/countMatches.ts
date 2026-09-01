import { EditorState } from '@codemirror/state';
import { SearchQuery } from '@codemirror/search';

export interface MatchCount {
	/** Total number of matches in the document, capped at `limit`. */
	total: number;
	/** 1-based index of the match at/before the cursor, or 0 if none. */
	current: number;
	/** True when counting stopped early because `limit` was reached. */
	capped: boolean;
}

export const EMPTY_COUNT: MatchCount = { total: 0, current: 0, capped: false };

/**
 * Counts every match for `query` in the document.
 *
 * CodeMirror's search extension only computes highlights for the viewport, so
 * there is no built-in way to ask for a total. The approach here is the one
 * recommended by CodeMirror's maintainer: run the query's own cursor over the
 * whole document and tally the results.
 *
 * `limit` bounds the work on very large notes. Once it is hit we stop scanning
 * and report `capped`, which the UI renders as "999+".
 */
export function countMatches(state: EditorState, query: SearchQuery, limit = 999): MatchCount {
	if (!query || !query.valid) return EMPTY_COUNT;

	// The selection anchor is where the *previous* match landed, since findNext
	// selects the match it moves to. Using `from` keeps "current" stable while
	// the user cycles forwards and backwards through results.
	const selectionFrom = state.selection.main.from;

	const cursor = query.getCursor(state);
	let total = 0;
	let current = 0;

	// getCursor() returns a bare Iterator, not an Iterable, so it cannot be
	// driven with for...of.
	let step = cursor.next();
	while (!step.done) {
		total++;

		// The first match starting at or after the cursor is the active one.
		if (current === 0 && step.value.from >= selectionFrom) {
			current = total;
		}

		if (total >= limit) {
			return { total, current, capped: true };
		}

		step = cursor.next();
	}

	// Cursor sits past the last match: searching again wraps to the first one.
	if (current === 0 && total > 0) current = 1;

	return { total, current, capped: false };
}

/** Formats a count the way the old CodeMirror 5 panel did. */
export function formatCount(count: MatchCount): string {
	if (count.total === 0) return 'No results';
	const total = count.capped ? `${count.total}+` : `${count.total}`;
	return `${count.current}/${total}`;
}
