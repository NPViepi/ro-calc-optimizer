import { readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import * as ts from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';

const root = resolve(import.meta.dirname, '..');
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [resolve(directory, entry.name)] : []);
const names = ['src', 'worker', 'mcp'].flatMap(directory => files(resolve(root, directory)));
const api = new API({ cwd: root });
const snapshot = api.updateSnapshot({ openProjects: [resolve(root, 'tsconfig.source-checks.json')] });
const project = snapshot.getProject(resolve(root, 'tsconfig.source-checks.json'));
const { program, checker } = project;
let errors = 0;
function report(file, node, message) {
  const location = file.getLineAndCharacterOfPosition(node.getStart(file));
  console.error(`${relative(root, file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`); errors++;
}
for (const name of names) {
  const file = program.getSourceFile(name);
  const imports = new Map();
  const local = relative(root, name).replaceAll('\\', '/');
  const isolated = /^(src\/app\/core|src\/app\/i18n|worker|mcp)\//.test(local);
  function boundary(node, value) {
    if (/^src\/react\//.test(local) && /^(?:@angular\/|rxjs(?:\/|$)|zone\.js(?:\/|$)|tslib(?:\/|$))/.test(value)) report(file, node, `Removed framework import in React source: ${value}`);
    if (!isolated) return;
    if (/^(?:@angular\/|primeng(?:\/|$)|rxjs(?:\/|$)|react(?:\/|$)|react-dom(?:\/|$))/.test(value) || /(?:^|\/)layout\//.test(value)) report(file, node, `Framework/UI import is forbidden in ${local.split('/')[0]}: ${value}`);
  }
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      const declarations = [...(clause?.name ? [clause.name] : []), ...(bindings ? ts.isNamespaceImport(bindings) ? [bindings.name] : bindings.elements.map(element => element.name) : [])];
      for (const declaration of declarations) imports.set(checker.getSymbolAtLocation(declaration), { node: declaration, used: false });
      boundary(statement, statement.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) boundary(statement, statement.moduleSpecifier.text);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node)) {
      const symbol = ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent) : ts.isExportSpecifier(node.parent) ? checker.getExportSpecifierLocalTargetSymbol(node.parent) : checker.getSymbolAtLocation(node);
      const entry = imports.get(symbol); if (entry) entry.used = true;
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(file) === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) boundary(node, node.arguments[0].text);
    node.forEachChild(visit);
  }
  visit(file);
  for (const entry of imports.values()) if (!entry.used) report(file, entry.node, `Unused import: ${entry.node.text}`);
}
snapshot.dispose();
api.close();
if (errors) process.exitCode = 1;
else console.log(`Source checks passed (${names.length} TypeScript files; unused imports and framework boundaries).`);
