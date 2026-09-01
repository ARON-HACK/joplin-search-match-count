const { EditorState } = require('@codemirror/state');
const { SearchQuery } = require('@codemirror/search');
const { countMatches, formatCount } = require('../dist-test/countMatches');

let pass = 0, fail = 0;
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n    got  ${g}\n    want ${w}`); }
}

const doc = 'args parse_args\nargs.verbose\nnothing here\nARGS upper';
const mk = (cursor) => EditorState.create({ doc, selection: { anchor: cursor } });

// 1. Basic count, cursor at start
let c = countMatches(mk(0), new SearchQuery({ search: 'args' }));
check('case-insensitive total', c.total, 4);
check('current at doc start', c.current, 1);

// 2. Case sensitive excludes ARGS
c = countMatches(mk(0), new SearchQuery({ search: 'args', caseSensitive: true }));
check('case-sensitive total', c.total, 3);

// 3. Cursor mid-document advances "current"
c = countMatches(mk(16), new SearchQuery({ search: 'args' }));
check('current mid-doc', c.current, 3);

// 4. Cursor past last match wraps to 1
c = countMatches(mk(doc.length), new SearchQuery({ search: 'args' }));
check('wraps past end', c.current, 1);
check('total unchanged when wrapped', c.total, 4);

// 5. No matches
c = countMatches(mk(0), new SearchQuery({ search: 'zzzz' }));
check('no matches', { t: c.total, cur: c.current }, { t: 0, cur: 0 });
check('format no results', formatCount(c), 'No results');

// 6. Invalid regex must not throw
c = countMatches(mk(0), new SearchQuery({ search: '[[[', regexp: true }));
check('invalid regex safe', c.total, 0);

// 7. Regex mode
c = countMatches(mk(0), new SearchQuery({ search: 'arg[s]', regexp: true }));
check('regex total', c.total, 4);

// 8. wholeWord excludes parse_args and args.verbose? (args. is word-bounded)
c = countMatches(mk(0), new SearchQuery({ search: 'args', wholeWord: true }));
console.log(`  INFO wholeWord total = ${c.total}`);

// 9. Cap behaviour
const big = EditorState.create({ doc: 'x'.repeat(5000) });
c = countMatches(big, new SearchQuery({ search: 'x' }), 999);
check('capped total', c.total, 999);
check('capped flag', c.capped, true);
check('format capped', formatCount(c), '1/999+');

// 10. Formatting
check('format normal', formatCount({ total: 17, current: 3, capped: false }), '3/17');

// 11. Empty search string
c = countMatches(mk(0), new SearchQuery({ search: '' }));
check('empty query', c.total, 0);

// 12. Perf on a large realistic note
const line = 'the quick brown fox jumps over the lazy dog and the fox runs\n';
const perfState = EditorState.create({ doc: line.repeat(20000) }); // ~1.2MB
const t0 = Date.now();
const pc = countMatches(perfState, new SearchQuery({ search: 'the' }), 999);
const ms = Date.now() - t0;
console.log(`  PERF 1.2MB doc, capped scan: ${ms}ms (total=${pc.total}, capped=${pc.capped})`);

const t1 = Date.now();
countMatches(perfState, new SearchQuery({ search: 'the' }), Infinity);
console.log(`  PERF 1.2MB doc, UNCAPPED scan: ${Date.now() - t1}ms`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
