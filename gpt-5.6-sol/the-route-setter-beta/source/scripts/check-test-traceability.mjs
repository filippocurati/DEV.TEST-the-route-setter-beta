import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sourceRoot, '..');
const requirementsPath = resolve(projectRoot, 'sdd-specs/01-specifica-requisiti.md');
const matrixPath = resolve(projectRoot, 'sdd-specs/04-tracciabilita.md');
const manifestPath = resolve(sourceRoot, 'test-traceability.json');

const [requirements, matrix, manifestText] = await Promise.all([
  readFile(requirementsPath, 'utf8'),
  readFile(matrixPath, 'utf8'),
  readFile(manifestPath, 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const declared = [...requirements.matchAll(/\*\*(REQ-[A-Z]+-\d{3})\b/g)].map((match) => match[1]);
const active = declared.filter(id => id !== 'REQ-TST-008');
const traced = expandRequirementReferences(matrix);
const errors = [];

for (const requirement of declared) {
  if (!traced.has(requirement)) errors.push(`${requirement} non compare nella matrice di tracciabilita.`);
}
for (const requirement of active) {
  if (!Object.hasOwn(manifest, requirement)) errors.push(`${requirement} non ha un record di evidenza.`);
}
for (const [requirement, evidence] of Object.entries(manifest)) {
  if (!declared.includes(requirement)) errors.push(`${requirement} nel manifest non e un ID dichiarato.`);
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push(`${requirement} non ha percorsi di evidenza.`);
    continue;
  }
  for (const relativePath of evidence) {
    if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
      errors.push(`${requirement} contiene un percorso di evidenza non valido.`);
      continue;
    }
    try {
      if (!(await stat(resolve(sourceRoot, relativePath))).isFile()) {
        errors.push(`${requirement} fa riferimento a un percorso che non e un file: ${relativePath}`);
      }
    } catch {
      errors.push(`${requirement} fa riferimento a un percorso inesistente: ${relativePath}`);
    }
  }
}

if (Object.hasOwn(manifest, 'REQ-TST-008')) {
  errors.push('REQ-TST-008 e storico e non deve essere incluso nel gate normativo della fase 10.');
}
const unrecorded = active.filter(id => !Object.hasOwn(manifest, id));
console.log(`Manifest evidenze: ${active.length - unrecorded.length}/${active.length} requisiti attivi con record; ${Object.keys(manifest).length} record controllati. Record mancanti, da mappare senza inferire conformita: ${unrecorded.join(', ') || 'nessuno'}. Ogni assenza attiva e bloccante.`);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${declared.length} ID dichiarati presenti nella matrice (${active.length} attivi, REQ-TST-008 storico); file presenti per tutti i ${Object.keys(manifest).length} record obbligatori. Controllo strutturale, non verifica di completamento o copertura delle asserzioni.`);
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
