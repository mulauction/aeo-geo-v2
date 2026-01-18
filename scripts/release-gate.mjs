// scripts/release-gate.mjs
// CI release gate: PASS => exit 0, otherwise exit 1.
// Inputs:
// - CLI: --status=<VALUE> (highest priority)
// - ENV: RELEASE_STATUS
// Output:
// - Default: exactly one word to stdout: PASS|FAIL|INSUFFICIENT
// - Optional: --verbose prints "STATUS: <x> (exit=<code>)"

function parseArgs(argv) {
  const out = { status: null, verbose: false };
  for (const a of Array.isArray(argv) ? argv : []) {
    if (a === '--verbose') out.verbose = true;
    if (typeof a === 'string' && a.startsWith('--status=')) out.status = a.slice('--status='.length);
  }
  return out;
}

function normalizeStatus(input) {
  const s = String(input || '').trim().toUpperCase();
  if (s === 'PASS' || s === 'FAIL' || s === 'INSUFFICIENT') return s;
  return 'INSUFFICIENT';
}

try {
  const args = parseArgs(process.argv.slice(2));
  const raw = (args.status != null) ? args.status : process.env.RELEASE_STATUS;
  const status = normalizeStatus(raw);
  const exitCode = status === 'PASS' ? 0 : 1;

  if (args.verbose) {
    process.stdout.write(`STATUS: ${status} (exit=${exitCode})\n`);
  } else {
    process.stdout.write(`${status}\n`);
  }

  process.exit(exitCode);
} catch (_) {
  process.stdout.write('INSUFFICIENT\n');
  process.exit(1);
}

