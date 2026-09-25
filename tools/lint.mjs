// Lint the game as the browser sees it: every script listed in index.html, in order, as one program,
// so names shared between files count as defined and used. Reports findings against the real file and line.
import { ESLint } from 'eslint';
import globals from 'globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [...readFileSync(join(root, 'index.html'), 'utf8').matchAll(/src="(js\/[\w-]+\.js)"/g)].map(m => m[1]);
const map = [];
const text = files
  .map(f => {
    // the per-file 'use strict' directives are fine; blank them so they don't read as stray expressions
    const lines = readFileSync(join(root, f), 'utf8').replace(/^'use strict';$/m, '').split('\n');
    lines.forEach((_, i) => map.push([f, i + 1]));
    return lines.join('\n');
  })
  .join('\n');

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: {
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unused-vars': ['warn', { vars: 'all', args: 'none', caughtErrors: 'none' }],
      'no-unreachable': 'warn',
      'no-empty': 'warn',
      'no-self-assign': 'warn'
    }
  }
});
const [res] = await eslint.lintText(text, { filePath: join(root, 'flokk.js') });
for (const m of res.messages) {
  const [f, l] = map[m.line - 1] || ['?', m.line];
  console.log(`${f}:${l}  ${m.ruleId || 'parse'}  ${m.message}`);
}
console.log(res.messages.length ? `${res.messages.length} finding(s)` : 'lint clean');
process.exitCode = res.errorCount ? 1 : 0;
