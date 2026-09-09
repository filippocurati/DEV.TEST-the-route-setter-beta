import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('richiede tutti i record attivi e file reali senza inferire conformita', async t => {
  const root = await mkdtemp(join(tmpdir(), 'route-traceability-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'source/scripts'), { recursive: true });
  await mkdir(join(root, 'sdd-specs'));
  const script = join(root, 'source/scripts/check-test-traceability.mjs');
  await copyFile(join(dirname(fileURLToPath(import.meta.url)), 'check-test-traceability.mjs'), script);
  const mandatory = [
    ...[1, 2, 3, 4, 5, 6, 7, 9, 10].map(number => `REQ-TST-${String(number).padStart(3, '0')}`),
    ...[1, 2, 3, 4, 5, 6].map(number => `REQ-PRF-00${number}`),
    ...[1, 2, 3, 4, 5].map(number => `REQ-DOC-00${number}`),
  ];
  const declared = [...mandatory, 'REQ-API-001', 'REQ-TST-008'];
  await writeFile(join(root, 'sdd-specs/01-specifica-requisiti.md'), declared.map(id => `**${id}**`).join('\n'));
  await writeFile(join(root, 'sdd-specs/04-tracciabilita.md'), declared.join('\n'));
  await writeFile(join(root, 'source/evidence.json'), '{}');
  const manifest = Object.fromEntries(mandatory.map(id => [id, ['evidence.json']]));
  const run = async () => {
    await writeFile(join(root, 'source/test-traceability.json'), JSON.stringify(manifest));
    return spawnSync(process.execPath, [script], { encoding: 'utf8' });
  };
  const partial = await run();
  assert.equal(partial.status, 1, partial.stdout);
  assert.match(partial.stderr, /REQ-API-001 non ha un record di evidenza/);
  assert.match(partial.stdout, /20\/21 requisiti attivi/);
  assert.match(partial.stdout, /da mappare senza inferire conformita: REQ-API-001/);
  for (const evidence of [['absent.json'], ['scripts'], [], [null], ['']]) {
    manifest['REQ-API-001'] = evidence;
    const invalid = await run();
    assert.equal(invalid.status, 1, invalid.stdout);
    assert.match(invalid.stderr, /REQ-API-001/);
    if (evidence[0] === 'scripts') assert.match(invalid.stderr, /non e un file: scripts/);
  }
  manifest['REQ-API-001'] = ['evidence.json'];
  const complete = await run();
  assert.equal(complete.status, 0, complete.stderr);
  assert.match(complete.stdout, /21\/21 requisiti attivi/);
  manifest['REQ-UNKNOWN-001'] = ['evidence.json'];
  const unknown = await run();
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /REQ-UNKNOWN-001 nel manifest non e un ID dichiarato/);
  delete manifest['REQ-UNKNOWN-001'];
  manifest['REQ-TST-008'] = ['evidence.json'];
  const historical = await run();
  assert.equal(historical.status, 1);
  assert.match(historical.stderr, /REQ-TST-008 e storico/);
  delete manifest['REQ-TST-008'];
  delete manifest['REQ-DOC-001'];
  const missing = await run();
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /REQ-DOC-001 non ha un record di evidenza/);
});
