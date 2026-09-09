import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const module = await import(pathToFileURL(resolve(sourceRoot, 'frontend/node_modules/typescript/lib/typescript.js')).href);
const ts = module.default ?? module;

/** Scopre solo sorgenti applicativi TypeScript, senza seguire link o includere dichiarazioni ambientali. */
export async function discoverTypeScriptFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await discoverTypeScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(path);
  }
  return files.sort();
}

/** Conta dichiarazioni AST, non commenti: ogni overload o firma di metodo costituisce una voce distinta. */
export function inspectDocumentation(sourceText, path) {
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);
  const missing = [];
  let declarations = 0;
  let documented = 0;
  function visit(node) {
    const inScope = ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
      || ts.isInterfaceDeclaration(node) || ts.isConstructorDeclaration(node)
      || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)
      || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
    if (inScope) {
      declarations += 1;
      const hasDescription = node.jsDoc?.some(doc => typeof doc.comment === 'string'
        ? doc.comment.trim().length > 0
        : doc.comment?.some(part => part.text?.trim().length > 0));
      if (hasDescription) documented += 1;
      else {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        missing.push({ name: node.name?.getText(source) ?? 'constructor', line: position.line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { declarations, documented, missing };
}

/** Include nell'inventario anche i file senza dichiarazioni, senza alterare il conteggio dei simboli. */
export async function checkFrontendDocumentation(root) {
  const results = [];
  for (const path of await discoverTypeScriptFiles(root)) {
    results.push({ path: relative(root, path).split(sep).join('/'),
      ...inspectDocumentation(await readFile(path, 'utf8'), path) });
  }
  return results;
}
