import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');

export async function loadFrontendModule(path, transform = (source) => source) {
  const source = await readFile(new URL(`../../frontend/src/${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(transform(source), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
