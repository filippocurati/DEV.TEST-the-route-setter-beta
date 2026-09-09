import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkFrontendDocumentation, inspectDocumentation } from './documentation-scope.mjs';

test('conta firme, classi, costruttori, metodi privati, accessori e funzioni locali', () => {
  const result = inspectDocumentation(`
/** Contratto del servizio. */ interface Service {
  /** Esegue il lavoro. */ run(): void;
}
/** Implementazione locale. */ class Worker {
  /** Collega le dipendenze. */ constructor() {}
  /** Esegue il lavoro interno. */ private run() {}
  /** Espone lo stato. */ get ready() { return true; }
  /** Aggiorna lo stato. */ set ready(value: boolean) {}
}
/** Avvia il lavoro. */ function start() {
  /** Completa il lavoro locale. */ function finish() {}
}
/** Firma testuale. */ function overload(value: string): void;
/** Firma numerica. */ function overload(value: number): void;
/** Implementazione comune. */ function overload(value: unknown) {}
const object = {
  /** Gestisce il comando. */
  run() {}
};
`, 'sample.ts');
  assert.deepEqual(result, { declarations: 13, documented: 13, missing: [] });
});

test('rifiuta commenti ordinari, vuoti, di altri nodi o con soli tag', () => {
  const result = inspectDocumentation(`// Ordinario
function ordinary() {}
/** */ function empty() {}
/** @param value Dato. */ function tags(value: unknown) {}
/** Descrive la variabile, non la funzione. */ const value = 1;
function unrelated() {}
interface Contract { run(): void; }
class Worker { constructor() {} private run() {} }
`, 'missing.ts');
  assert.equal(result.documented, 0);
  assert.equal(result.declarations, 9);
  assert.deepEqual(result.missing.map(item => item.name),
    ['ordinary', 'empty', 'tags', 'unrelated', 'Contract', 'run', 'Worker', 'constructor', 'run']);
  assert.equal(result.missing[0].line, 2);
});

test('esclude arrow, espressioni funzione e dichiarazioni anonime', () => {
  const result = inspectDocumentation(`
const arrow = () => {};
const namedExpression = function named() {};
const anonymous = function() {};
export default function() {}
`, 'expressions.ts');
  assert.deepEqual(result, { declarations: 0, documented: 0, missing: [] });
});

test('scopre nuove sottocartelle, esclude d.ts e test esterni e mantiene i file senza dichiarazioni', async t => {
  const root = await mkdtemp(join(tmpdir(), 'route-docs-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/new/deep'), { recursive: true });
  await mkdir(join(root, 'tests'));
  await writeFile(join(root, 'src/new/deep/added.ts'), 'function missing() {}');
  await writeFile(join(root, 'src/env.d.ts'), 'declare function ignored(): void;');
  await writeFile(join(root, 'src/data.ts'), 'export const value = 1;');
  await writeFile(join(root, 'src/ignored.js'), 'function ignored() {}');
  await writeFile(join(root, 'tests/example.test.ts'), 'function testHelper() {}');
  const results = await checkFrontendDocumentation(join(root, 'src'));
  assert.deepEqual(results.map(file => file.path), ['data.ts', 'new/deep/added.ts']);
  assert.equal(results[0].declarations, 0);
  assert.deepEqual(results[1].missing, [{ name: 'missing', line: 1 }]);
});

test('il gate CLI restituisce 0 con descrizioni e 1 con dichiarazioni nuove non documentate', async t => {
  const root = await mkdtemp(join(tmpdir(), 'route-docs-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scripts = dirname(fileURLToPath(import.meta.url));
  for (const directory of ['source/scripts', 'source/frontend/src/new', 'source/frontend/node_modules', 'docs', 'sdd-specs']) {
    await mkdir(join(root, directory), { recursive: true });
  }
  for (const name of ['check-documentation.mjs', 'documentation-scope.mjs']) {
    await copyFile(join(scripts, name), join(root, 'source/scripts', name));
  }
  await symlink(resolve(scripts, '../frontend/node_modules/typescript'),
    join(root, 'source/frontend/node_modules/typescript'), process.platform === 'win32' ? 'junction' : 'dir');
  const documents = ['README.md', 'docs/applicazione.md', 'docs/test-automatici.md', 'docs/checklist-fase-12.md',
    'sdd-specs/00-costituzione.md', 'sdd-specs/01-specifica-requisiti.md', 'sdd-specs/02-design-tecnico.md',
    'sdd-specs/03-piano-implementazione.md', 'sdd-specs/04-tracciabilita.md',
    'sdd-specs/05-open-decisions-guidate.md', 'sdd-specs/06-stato-versione-v0.0.1.md'];
  const sections = ['Architettura', 'Struttura Dei Sorgenti', 'API', 'Lifecycle Della Presa', 'Flusso UI',
    'Responsabilit\u00e0 Backend E Frontend', 'Avvio Live', 'Avvio Debug', 'Backend',
    'Frontend Unit E Fisica Headless', 'End-To-End', 'Gate Aggregato', 'Benchmark Fase 11'];
  const markdown = sections.map(section => `## ${section}`).join('\n')
    + '\n' + '```mermaid\ngraph TD\n```\n'.repeat(6)
    + [1, 2, 3, 4, 5].map(number => `REQ-DOC-00${number}`).join('\n');
  for (const document of documents) await writeFile(join(root, document), markdown);
  const path = join(root, 'source/frontend/src/new/entry.ts');
  const run = () => spawnSync(process.execPath, [join(root, 'source/scripts/check-documentation.mjs')], { encoding: 'utf8' });
  await writeFile(path, '/** Avvia il modulo. */ export function start() {}');
  const passed = run();
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /1\/1 dichiarazioni/);
  await writeFile(path, 'export function start() {}');
  const failed = run();
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stdout, /0\/1 dichiarazioni/);
  assert.match(failed.stderr, /JSDoc mancante per start in frontend\/src\/new\/entry.ts:1/);
  await rm(path);
  const empty = run();
  assert.equal(empty.status, 1, empty.stderr);
  assert.match(empty.stderr, /ambito JSDoc vuoto/);
});
