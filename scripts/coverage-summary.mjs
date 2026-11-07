// Turns an lcov file into a Markdown coverage table for the GitHub Actions job summary.
// Usage: node scripts/coverage-summary.mjs coverage/lcov.info
import { readFileSync } from 'node:fs'

const path = process.argv[2] ?? 'coverage/lcov.info'

let lcov
try {
  lcov = readFileSync(path, 'utf8')
} catch {
  console.log('### Unit test coverage\n\nNo coverage report was produced. See the unit test step.')
  process.exit(0)
}

const files = []
let current
for (const line of lcov.split('\n')) {
  const [key, value] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)]
  if (key === 'SF') current = { file: value, LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 }
  else if (current && key in current && key !== 'file') current[key] = Number(value)
  else if (line === 'end_of_record' && current) {
    files.push(current)
    current = undefined
  }
}

const sum = (key) => files.reduce((total, f) => total + f[key], 0)
const pct = (hit, found) => (found === 0 ? '—' : `${((hit / found) * 100).toFixed(1)}%`)

const out = [
  '### Unit test coverage',
  '',
  '| | Lines | Branches | Functions |',
  '| --- | --- | --- | --- |',
  `| **All ${files.length} files** | ${pct(sum('LH'), sum('LF'))} | ${pct(sum('BRH'), sum('BRF'))} | ${pct(sum('FNH'), sum('FNF'))} |`,
  '',
  '<details><summary>Per file, lowest line coverage first</summary>',
  '',
  '| File | Lines | Branches | Functions |',
  '| --- | --- | --- | --- |',
  ...files
    .sort((a, b) => a.LH / (a.LF || 1) - b.LH / (b.LF || 1))
    .map((f) => `| \`${f.file}\` | ${pct(f.LH, f.LF)} | ${pct(f.BRH, f.BRF)} | ${pct(f.FNH, f.FNF)} |`),
  '',
  '</details>',
  '',
  'Counts only files the unit tests import, so untested screens and services do not appear.',
]
console.log(out.join('\n'))
