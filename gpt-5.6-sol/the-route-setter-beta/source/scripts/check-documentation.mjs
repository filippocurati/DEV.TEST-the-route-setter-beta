import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(sourceRoot, '..');
const requiredDocuments = [
  'README.md',
  'docs/applicazione.md',
  'docs/test-automatici.md',
  'docs/checklist-fase-12.md',
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

const typescriptModule = await import(pathToFileURL(resolve(sourceRoot, 'frontend/node_modules/typescript/lib/typescript.js')).href);
const typescript = typescriptModule.default ?? typescriptModule;
const classFiles = [
  'frontend/src/catalog/sessionCatalog.ts',
  'frontend/src/catalog/holdDetailsModal.ts',
  'frontend/src/input/holdCommands.ts',
  'frontend/src/interaction/holdOverlay.ts',
  'frontend/src/physics/physicsWorld.ts',
];
for (const relativePath of classFiles) {
  const sourceText = await readFile(resolve(sourceRoot, relativePath), 'utf8');
  const sourceFile = typescript.createSourceFile(relativePath, sourceText, typescript.ScriptTarget.Latest, true);
  visit(sourceFile, relativePath, sourceText);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Documentazione completa: ${requiredDocuments.length} documenti, ${diagramCount} diagrammi e 5 requisiti DOC verificati.`);
}

function visit(node, relativePath, sourceText) {
  if ((typescript.isClassDeclaration(node) || typescript.isMethodDeclaration(node) || typescript.isConstructorDeclaration(node))
    && !hasJsDoc(node, sourceText)) {
    const position = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
    const name = node.name?.getText() ?? 'constructor';
    errors.push(`JSDoc mancante per ${name} in ${relativePath}:${position.line + 1}.`);
  }
  typescript.forEachChild(node, (child) => visit(child, relativePath, sourceText));
}

function hasJsDoc(node, sourceText) {
  const ranges = typescript.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];
  return ranges.some((range) => sourceText.slice(range.pos, range.end).startsWith('/**'));
}
