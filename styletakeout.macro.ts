import { createMacro } from 'babel-plugin-macros';
import * as t from '@babel/types';
import { stripIndent } from 'common-tags';
import { compile, serialize, stringify } from 'stylis';
import cssBeautify from 'cssbeautify';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

import type { NodePath } from '@babel/core';
import type { MacroHandler } from 'babel-plugin-macros';

type ConfigOptions = {
  /** Prefix for all CSS classes: i.e `css-` will yield `css-file.tsx:32:16` */
  classPrefix: string,
  /** If the file is `index`, use the folder name only */
  classUseFolder: boolean,
  /** Relative path to output file. Defaults to `./build/takeout.css` */
  outputFile: string,
  // PR DefinitelyTyped#46190 - @types/cssbeautify didn't export 🙄
  /** Options for `cssbeautify` package or `false` to skip formatting */
  beautify: false | Parameters<typeof cssBeautify>[1],
  /** Remove declarations (decl``) statements or convert them to strings */
  removeDecl: boolean,
  /** Log to the console */
  quiet: boolean,
  /** Log ms per file */
  timing: boolean,
  /** Support update-on-save by patching `process.stdout.write()` to know when Babel has compiled */
  stdoutPatch: boolean,
  /** String to look for with `indexOf()`. Defaults to @babel/cli's "Sucessfully compiled ..." */
  stdoutSearchString: string,
}

declare module 'babel-plugin-macros' {
  interface References {
    decl?: NodePath[]
    injectGlobal?: NodePath[]
    css?: NodePath[]
  }
  interface MacroParams {
    config: Partial<ConfigOptions>
  }
}

// Default config and then becomes resolved config at runtime
const opts: ConfigOptions = {
  classPrefix: 'css-',
  classUseFolder: true,
  outputFile: 'build/takeout.css',
  beautify: {
    indent: '  ',
    openbrace: 'end-of-line',
    autosemicolon: true,
  },
  removeDecl: true,
  quiet: false,
  timing: false,
  stdoutPatch: true,
  stdoutSearchString: 'Successfully compiled',
};

// Globals

// Timer in ms for performance.now()
let compileTime = 0;
// Macro is called per file but it's a waste of time to Object.assign everytime
let optsSet = false;
// Active file path used for adding information to stack traces in theirError()
let activeFile: string;

// These only apply for multiple invocations such as with `babel --watch`
let runningBabelCLI = false;
let updateCount = 0;
let initialStyleWrite = true;
let mapPathSize = 0;

// Maps

/** Map of full file paths to their shortname+N short form */
const mapPathToShortN = new Map<string, string>();
/** Map of shortname to current N counter; incremented each conflict */
const mapShortToN = new Map<string, number>();

/** Map variable name to its value */
const declBlocks = new Map<string, string>();
/** Map of shortname+N to the CSS snippet */
const injectGlobalBlocks = new Map<string, string>();
/** Map of shortname+N to the CSS snippet */
const cssBlocks = new Map<string, string>();

// Need to know when Babel is done compilation. Patch process.stdout to search
// for @babel/cli. If stdout never emits a sign of running in @babel/cli then
// process.exit will be used as a fallback; which is clearly after compilation.
process.on('exit', () => !runningBabelCLI && writeStyles());

// Can't `process.stdout.on('data', ...` because it's a Writeable stream
const stdoutWrite = process.stdout.write;
// @ts-ignore Typescript can't wrap overloaded functions
process.stdout.write = (...args: Parameters<typeof process.stdout.write>) => {
  if (opts.stdoutPatch) {
    const [bufferString] = args;
    const string = bufferString.toString();
    if (string.startsWith(opts.stdoutSearchString)) {
      runningBabelCLI = true;
      // If this was `writeStyles()` and it threw an error, the stdout pipe
      // would be left broken so nothing would write; not even the error
      process.nextTick(writeStyles);
    }
  }
  return stdoutWrite.apply(process.stdout, args);
};

const theirError = (msg: string, loc?: t.SourceLocation | null) => {
  if (loc) activeFile += `:${loc.start.line}:${loc.start.column}`;
  const toModify = new Error(`${msg} (${activeFile})`);
  // XXX: Even _reading_ `.stack` breaks upstream try/catch?
  // toModify.stack = toModify.stack.split('\n').slice(0, 3).join('\n');
  throw toModify;
};

const mergeTemplateExpression = (node: t.Node): string => {
  if (!t.isTaggedTemplateExpression(node))
    throw theirError(
      `Macro can only be a tagged template. Found "${node.type}".`, node.loc);

  let string = '';
  const { quasis, expressions } = node.quasi;
  for (let i = 0; i < expressions.length; i++) {
    const exp = expressions[i];
    let variableName;

    if (t.isIdentifier(exp))
      variableName = exp.name;
    if (t.isMemberExpression(exp) && t.isIdentifier(exp.property))
      variableName = exp.property.name;

    if (typeof variableName === 'undefined')
      throw theirError(
        'CSS can only reference decl`` variables in ${} blocks.', exp.loc);

    if (!declBlocks.has(variableName))
      throw theirError(
        `\${${variableName}} is not a defined decl\`\` variable.`, exp.loc);

    string += quasis[i].value.raw;
    string += declBlocks.get(variableName) as string;
  }
  // There's always one more `quasis` than `expressions`
  string += quasis[quasis.length - 1].value.raw;
  return stripIndent(string);
};

const sourceLocation = (node: t.Node, relPath: string) => {
  if (!node.loc) {
    throw new Error('Babel node didn\'t have location info as "node.loc"');
  }
  let name: string;
  const prevShortName = mapPathToShortN.get(relPath);
  if (prevShortName) {
    name = prevShortName;
  } else {
    name = path.basename(relPath);
    // Optionally remove 'index.js'
    if (name.startsWith('index.') && opts.classUseFolder) {
      name = path.basename(relPath.substring(0, relPath.length - name.length));
    }
    // Get next +N
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const n = mapShortToN.get(name) || 0;
    mapShortToN.set(name, n + 1);
    name += `+${n}`;
    mapPathToShortN.set(relPath, name);
  }
  // This is a `loc` location: "shortname+N:L:C"
  return `${name}:${node.loc.start.line}:${node.loc.start.column}`;
};

const styletakeoutMacro: MacroHandler = ({ references, state, config }) => {
  const t0 = performance.now();
  if (!optsSet) {
    Object.assign(opts, config);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    Object.assign(opts.beautify, config.beautify || {});
    optsSet = true;
  }

  const { decl, injectGlobal, css } = references;
  // This is a bad variable name; it's not the only the name...
  const { filename: absPath } = state;
  // Set global for sourceError
  activeFile = absPath;
  const relPath = path.relative(process.cwd(), absPath);

  // Process declarations _first_ before they're used
  const isId = t.isIdentifier;
  if (decl) decl.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node, parent } = parentPath;
    let variableName;

    // const/let/var x = decl``
    if (t.isVariableDeclarator(parent) && isId(parent.id))
      variableName = parent.id.name;

    // const obj = { ... x: decl`` }
    if (t.isObjectProperty(parent) && isId(parent.key))
      variableName = parent.key.name;

    if (t.isAssignmentExpression(parent)) {
      // x = decl``
      if (isId(parent.left))
        variableName = parent.left.name;
      // obj.x = decl``
      if (t.isMemberExpression(parent.left) && isId(parent.left.property))
        variableName = parent.left.property.name;
    }
    if (typeof variableName === 'undefined') {
      throw theirError(
        'Macro decl`` must be an assignment like "x = decl``" or "x: decl``".', node.loc);
    }
    // This variable name won't be unique for the entire codebase so rename it
    // const parentId = parent.id as t.Identifier;
    // const id = parentPath.scope.generateUidIdentifierBasedOnNode(parentId);
    // parentPath.scope.rename(parentId.name, id.name);

    const snippet = mergeTemplateExpression(node);
    declBlocks.set(variableName, snippet);
    updateCount++;
    // TODO: This might not be practical...
    // opts.removeDecl
    //   ? parentPath.parentPath.remove()
    //   : parentPath.replaceWith(t.stringLiteral(snippet));
  });

  if (injectGlobal) injectGlobal.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    const loc = sourceLocation(node, relPath);
    const style = mergeTemplateExpression(node);
    const styleCompiled = serialize(compile(style), stringify);
    const stylePretty = opts.beautify === false
      ? styleCompiled
      : cssBeautify(styleCompiled, opts.beautify);

    injectGlobalBlocks.set(loc, `/* ${loc} */\n${stylePretty}`);
    updateCount++;
    parentPath.remove();
  });

  const templateParentNodes: NodePath<t.TemplateLiteral>[] = [];
  if (css) css.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    const loc = sourceLocation(node, relPath);
    const style = mergeTemplateExpression(node);

    const tag = `${opts.classPrefix}${loc}`;
    const tagSafe = tag.replace(/([.:+])/g, (_, match: string) => `\\${match}`);
    const styleCompiled = serialize(compile(`.${tagSafe} { ${style} }`), stringify);
    const stylePretty = opts.beautify === false
      ? styleCompiled
      : cssBeautify(styleCompiled, opts.beautify);

    cssBlocks.set(loc, stylePretty);
    updateCount++;

    if (t.isTemplateLiteral(parentPath.parentPath.node)) {
      templateParentNodes.push(parentPath.parentPath as NodePath<t.TemplateLiteral>);
    }
    parentPath.replaceWith(t.stringLiteral(tag));
  });

  if (templateParentNodes.length > 0) templateParentNodes.forEach(path => {
    const { node } = path;
    const { quasis, expressions } = node;
    for (let i = 0; i < expressions.length;) {
      if (t.isStringLiteral(expressions[i])) {
        const { value } = expressions[i] as t.StringLiteral;
        const merged = quasis[i].value.raw + value + quasis[i + 1].value.raw;
        quasis[i + 1].value.raw = merged;
        quasis.splice(i, 1);
        expressions.splice(i, 1);
      } else {
        i++;
      }
    }
    if (quasis.length === 0) {
      path.replaceWith(t.stringLiteral(quasis[0].value.raw));
    }
  });

  const t1 = performance.now();
  compileTime += t1 - t0;
  if (opts.timing) console.log('⏱ ', relPath, `${(t1 - t0).toFixed(1)}ms`);
};

// Lowkey pluralize
const p = (s: string, n: number) => n === 1 ? s : `${s}s`;

const writeStyles = () => {
  const t0 = performance.now();
  const updates = updateCount;
  const total = injectGlobalBlocks.size + cssBlocks.size;
  updateCount = 0;

  let styles = '';
  // eslint-disable-next-line prefer-template
  for (const style of injectGlobalBlocks.values()) styles += style + '\n';
  // eslint-disable-next-line prefer-template
  for (const style of cssBlocks.values()) styles += style + '\n';
  fs.writeFileSync(opts.outputFile, styles.replace(/}\n\n/g, '}\n'));

  // This map is append only so also increases in size during a `--watch`
  const { size: fileCount } = mapPathToShortN;
  const fileCountNew = fileCount - mapPathSize;
  if (fileCountNew > 0) {
    mapPathSize = fileCount;
    const mapping = [];
    for (const [path, shortN] of mapPathToShortN.entries()) {
      mapping.push(`  "${shortN}": "${path}"`);
    }
    fs.writeFileSync(`${opts.outputFile}.json`, `{\n${mapping.join(',\n')}\n}`);
  }

  if (opts.quiet) return;
  const t1 = performance.now();
  const ms = Math.round(compileTime + (t1 - t0));
  compileTime = 0;

  if (initialStyleWrite) {
    console.log(`Moved ${total} CSS ${p('snippet', total)} from ${fileCount} ${
      p('file', fileCount)} to '${opts.outputFile}' with styletakeout.macro (${ms}ms)`);
    initialStyleWrite = false;
  } else {
    if (fileCountNew > 0) {
      console.log(`Tracking ${fileCountNew} new ${p('file', fileCountNew)} that have CSS snippets`);
    }
    if (updates) {
      console.log(`Updated ${updates} of ${total} CSS ${p('snippet', total)} (${ms}ms)`);
    }
  }
};

export default createMacro(styletakeoutMacro, { configName: 'styletakeout' });
