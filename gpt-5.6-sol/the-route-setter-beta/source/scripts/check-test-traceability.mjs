import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sourceRoot, '..');
const requirementsPath = resolve(projectRoot, 'sdd-specs/01-specifica-requisiti.md');
const matrixPath = resolve(projectRoot, 'sdd-specs/04-tracciabilita.md');
const manifestPath = resolve(sourceRoot, 'test-traceability.json');
const phaseRequirements = [1, 2, 3, 4, 5, 6, 7, 9, 10].map((number) => `REQ-TST-${String(number).padStart(3, '0')}`);

const [requirements, matrix, manifestText] = await Promise.all([
  readFile(requirementsPath, 'utf8'),
  readFile(matrixPath, 'utf8'),
  readFile(manifestPath, 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const declared = [...requirements.matchAll(/\*\*(REQ-[A-Z]+-\d{3})\b/g)].map((match) => match[1]);
const traced = expandRequirementReferences(matrix);
const errors = [];

for (const requirement of declared) {
  if (!traced.has(requirement)) errors.push(`${requirement} non compare nella matrice di tracciabilita.`);
}
for (const requirement of phaseRequirements) {
  const evidence = manifest[requirement];
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push(`${requirement} non ha evidenze automatiche.`);
    continue;
  }
  for (const relativePath of evidence) {
    try {
      await access(resolve(sourceRoot, relativePath));
    } catch {
      errors.push(`${requirement} fa riferimento a un percorso inesistente: ${relativePath}`);
    }
  }
}

if (Object.hasOwn(manifest, 'REQ-TST-008')) {
  errors.push('REQ-TST-008 e storico e non deve essere incluso nel gate normativo della fase 10.');
}
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${declared.length} requisiti presenti nella matrice; ${phaseRequirements.length} requisiti FASE 10 collegati a evidenze esistenti.`);
}

function expandRequirementReferences(markdown) {
  const result = new Set();
  for (const match of markdown.matchAll(/REQ-([A-Z]+)-(\d{3})(?:\.\.(?:REQ-[A-Z]+-)?(\d{3}))?/g)) {
    const [, domain, startText, endText] = match;
    const start = Number(startText);
    const end = Number(endText ?? startText);
    for (let number = start; number <= end; number += 1) {
      result.add(`REQ-${domain}-${String(number).padStart(3, '0')}`);
    }
  }
  return result;
}
