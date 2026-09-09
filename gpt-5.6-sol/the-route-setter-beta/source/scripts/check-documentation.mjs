import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFrontendDocumentation } from './documentation-scope.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sourceRoot, '..');
const requiredDocuments = [
  'README.md',
  'docs/applicazione.md',
  'docs/test-automatici.md',
  'docs/checklist-fase-12.md',
  'sdd-specs/00-costituzione.md',
  'sdd-specs/01-specifica-requisiti.md',
  'sdd-specs/02-design-tecnico.md',
  'sdd-specs/03-piano-implementazione.md',
  'sdd-specs/04-tracciabilita.md',
  'sdd-specs/05-open-decisions-guidate.md',
  'sdd-specs/06-stato-versione-v0.0.1.md',
];
const errors = [];

for (const path of requiredDocuments) {
  try {
    await access(resolve(projectRoot, path));
  } catch {
    errors.push(`Documento obbligatorio mancante: ${path}`);
  }
}

const application = await readFile(resolve(projectRoot, 'docs/applicazione.md'), 'utf8');
const tests = await readFile(resolve(projectRoot, 'docs/test-automatici.md'), 'utf8');
const checklist = await readFile(resolve(projectRoot, 'docs/checklist-fase-12.md'), 'utf8');
const diagramCount = [...application.matchAll(/```mermaid\s/g)].length;
if (diagramCount < 6) errors.push(`Diagrammi Mermaid insufficienti: ${diagramCount}/6.`);

for (const section of ['Architettura', 'Struttura Dei Sorgenti', 'API', 'Lifecycle Della Presa', 'Flusso UI', 'Responsabilità Backend E Frontend', 'Avvio Live', 'Avvio Debug']) {
  if (!application.includes(`## ${section}`)) errors.push(`Sezione applicativa mancante: ${section}`);
}
for (const section of ['Backend', 'Frontend Unit E Fisica Headless', 'End-To-End', 'Gate Aggregato', 'Benchmark Fase 11']) {
  if (!tests.includes(`## ${section}`)) errors.push(`Sezione test mancante: ${section}`);
}
for (let number = 1; number <= 5; number += 1) {
  const requirement = `REQ-DOC-${String(number).padStart(3, '0')}`;
  if (!checklist.includes(requirement)) errors.push(`Checklist priva di ${requirement}.`);
}

for (const documentPath of requiredDocuments) {
  const absolutePath = resolve(projectRoot, documentPath);
  const markdown = await readFile(absolutePath, 'utf8');
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|#)/.test(target)) continue;
    try {
      await access(resolve(dirname(absolutePath), target));
    } catch {
      errors.push(`Link locale inesistente in ${documentPath}: ${target}`);
    }
  }
}

const frontend = await checkFrontendDocumentation(resolve(sourceRoot, 'frontend/src'));
if (frontend.length === 0) errors.push('Nessun sorgente TypeScript applicativo scoperto: ambito JSDoc vuoto.');
const declarations = frontend.reduce((total, file) => total + file.declarations, 0);
const documented = frontend.reduce((total, file) => total + file.documented, 0);
for (const file of frontend) {
  for (const missing of file.missing) {
    errors.push(`JSDoc mancante per ${missing.name} in frontend/src/${file.path}:${missing.line}.`);
  }
}
console.log(`JSDoc frontend: ${documented}/${declarations} dichiarazioni documentate in ${frontend.length} file .ts applicativi (esclusi .d.ts e test esterni a src). Funzioni dichiarate con nome, classi con nome, interfacce, costruttori, metodi/firme e accessori; escluse arrow e function expression. Ogni firma conta separatamente. Presenza di descrizioni, non verifica della lingua o della qualita semantica. XML backend escluso dal gate automatico.`);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Controlli documentali strutturali superati: ${requiredDocuments.length} documenti, ${diagramCount} diagrammi, riferimenti DOC e JSDoc in tutti i ${frontend.length} file scoperti. Non certificano conformita semantica o completezza applicativa.`);
}
