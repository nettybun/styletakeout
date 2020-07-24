import { createMacro } from 'babel-plugin-macros';
import * as t from '@babel/types';
import { stripIndent } from 'common-tags';
import { compile, serialize, stringify } from 'stylis';
import cssBeautify from 'cssbeautify';
import fs from 'fs';
import path from 'path';

import type { NodePath, PluginPass } from '@babel/core';
import type { MacroHandler } from 'babel-plugin-macros';

type ConfigOptions = {
  /** Prefix for all CSS classes: i.e `css-` will yield `css-file.tsx:32:16` */
  classPrefix: string,
  /** If the file is `index`, use the folder name only */
  classRemoveFolderIndex: boolean,
  /** Relative path to output file. Defaults to `./build/takeout.css` */
  outputFile: string,
  // PR DefinitelyTyped#46190 - @types/cssbeautify didn't export 🙄
  /** Options for `cssbeautify` package or `false` to skip formatting */
  beautify: false | Parameters<typeof cssBeautify>[1],
  /** Log to the console */
  quiet: boolean,
  /** Support update-on-save by patching `process.stdout.write()` to know when Babel has compiled */
  stdoutPatch: boolean,
  /** String to look for with `indexOf()`. Defaults to @babel/cli's "Sucessfully compiled ..." */
  stdoutSearchString: string,
}

declare module 'babel-plugin-macros' {
  interface References {
    snip?: NodePath[]
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
  classRemoveFolderIndex: true,
  outputFile: 'build/takeout.css',
  beautify: {
    indent: '  ',
    openbrace: 'end-of-line',
    autosemicolon: true,
  },
  quiet: false,
  stdoutPatch: true,
  stdoutSearchString: 'Successfully compiled',
};

let updatesThisIteration = 0;
/** Map variable name to its value */
const snipBlocks = new Map<string, string>();

// File paths for classnames need to as short as possible but still unique. It
// may seem like collecting all full paths and then comparing on write/exit
// would be good, but by then the AST has been serialized. Instead, conflicting
// short paths must be made longer as the algorithm is running

/** Map of shortest unique path to the remaining path segments (dynamic) */
const uniquePaths = new Map<string, string[]>();

type InjectGlobalBlock = { pos: string, css: string }
type CSSBlock = { pos: string, css: string, parentPath: NodePath }
/** Map of shortest unique paths to Snippet[] */
const injectGlobalBlocks = new Map<string, InjectGlobalBlock[]>();
/** Map of shortest unique paths to Snippet[] */
const cssBlocks = new Map<string, CSSBlock[]>();

// Need to know when Babel is done compilation. Patch process.stdout to search
// for @babel/cli. If stdout never emits a sign of running in @babel/cli then
// process.exit will be used as a fallback; which is clearly after compilation.
let runningBabelCLI = false;
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

const mergeTemplateExpression = (node: t.Node): string => {
  if (!t.isTaggedTemplateExpression(node))
    throw new Error(`Macro can only be a tagged template. Found "${node.type}".`);

  let string = '';
  const { quasis, expressions } = node.quasi;
  for (let i = 0; i < expressions.length; i++) {
    const exp = expressions[i];

    if (!t.isIdentifier(exp))
      throw new Error('CSS can only reference snip`` variables in ${} blocks.');

    if (!snipBlocks.has(exp.name))
      throw new Error(`\${${exp.name}} is not a defined snip\`\` variable.`);

    string += quasis[i].value.raw;
    string += snipBlocks.get(exp.name) as string;
  }
  // There's always one more `quasis` than `expressions`
  string += quasis[quasis.length - 1].value.raw;
  return stripIndent(string);
};

const sourcePos = (node: t.Node) => {
  if (!node.loc) {
    throw new Error('Node didn\'t have location info as "node.loc"');
  }
  const { line, column } = node.loc.start;
  return `${line}:${column}`;
};

const reconcileFilePaths = (state: PluginPass) => {
  // This is a bad name for a variable. It's the full absolute path
  const { filename: absPath } = state;

  // Relative from project root
  const relPath = path.relative(__dirname, absPath);
  console.log('Translated', absPath, 'to', relPath);
  const ourPathSplit = relPath.split(path.sep);
  console.log('Segment path:', ourPathSplit);
  // Optionally remove 'index.js'
  if (opts.classRemoveFolderIndex) {
    const filename = ourPathSplit[ourPathSplit.length - 1];
    if (filename.startsWith('index.')) ourPathSplit.pop();
  }
  let ourPath = ourPathSplit.pop() as string;
  console.log(`uniquePaths trying to add ${ourPath}`);
  // Is there a conflict?
  if (uniquePaths.has(ourPath)) {
    console.log(`uniquePath conflict for ${ourPath}`);
    const theirPathSplit = uniquePaths.get(ourPath) as string[];
    uniquePaths.delete(ourPath);

    const injectGlobalBlocksToMove = injectGlobalBlocks.get(ourPath);
    if (injectGlobalBlocksToMove) injectGlobalBlocks.delete(ourPath);
    const cssBlocksToMove = cssBlocks.get(ourPath);
    if (cssBlocksToMove) cssBlocks.delete(ourPath);

    // Load their css`` blocks for updating parentPaths
    let theirPath = ourPath;
    // Choose a new conflict-free path for both ours and theirs
    while (ourPath === theirPath) {
      if (ourPathSplit.length === 0 || theirPathSplit.length === 0) {
        throw new Error(`Unable to resolve conflict beyond "${ourPath}" and "${theirPath}"`);
      }
      ourPath = path.join(ourPathSplit.pop() as string, ourPath);
      theirPath = path.join(theirPathSplit.pop() as string, theirPath);
    }

    if (cssBlocksToMove) cssBlocksToMove.forEach(block => {
      const newClassName = className(theirPath, block.pos);
      console.log('Update parentPath to be', newClassName);
      console.log(block.parentPath);
      block.parentPath.replaceWith(t.stringLiteral(newClassName));
      console.log(block.parentPath);
    });
    console.log(`uniquePaths conflict resolved to ${theirPath}`);
    uniquePaths.set(theirPath, theirPathSplit);

    if (injectGlobalBlocksToMove)
      injectGlobalBlocks.set(theirPath, injectGlobalBlocksToMove);
    if (cssBlocksToMove)
      cssBlocks.set(theirPath, cssBlocksToMove);
  }
  console.log(`uniquePaths add ${ourPath}`);
  uniquePaths.set(ourPath, ourPathSplit);
  return ourPath;
};

const className = (filePath: string, pos: string) =>
  `${opts.classPrefix}${filePath}:${pos}`;

const styletakeoutMacro: MacroHandler = ({ references, state, config }) => {
  Object.assign(opts, config);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  Object.assign(opts.beautify, config.beautify || {});

  const { snip, injectGlobal, css } = references;

  // Process snippets _first_ before they're used
  if (snip) snip.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    if (!t.isVariableDeclarator(parentPath.parent)) {
      throw new Error('Macro snip`` can only be in the form "const/let/var x = snip`...`".');
    }
    // This variable name won't be unique for the entire codebase so rename it
    const parentId = parentPath.parent.id as t.Identifier;
    const id = parentPath.scope.generateUidIdentifierBasedOnNode(parentId);
    parentPath.scope.rename(parentId.name, id.name);

    const snippet = mergeTemplateExpression(node);
    snipBlocks.set(id.name, snippet);
    updatesThisIteration++;

    // TODO: Actually only do this if there are no references after removing the
    // css`` and injectglobal`` handling

    // Remove the entire VariableDeclarator
    parentPath.parentPath.remove();
  });

  // Update the map of shortest file paths only if doing work
  if (!injectGlobal && !css) return;
  const shortestFilePath = reconcileFilePaths(state);

  if (injectGlobal) {
    let snippets = injectGlobalBlocks.get(shortestFilePath);
    if (!snippets) {
      injectGlobalBlocks.set(shortestFilePath, snippets = []);
    }
    injectGlobal.forEach(referencePath => {
      const { parentPath } = referencePath;
      const { node } = parentPath;
      const pos = sourcePos(node);
      const style = mergeTemplateExpression(node);
      const styleCompiled = serialize(compile(style), stringify);
      const stylePretty = opts.beautify === false
        ? styleCompiled
        : cssBeautify(styleCompiled, opts.beautify);
      (snippets as InjectGlobalBlock[]).push({ pos, css: stylePretty });
      updatesThisIteration++;
      parentPath.remove();
    });
  }

  if (css) {
    let snippets = cssBlocks.get(shortestFilePath);
    if (!snippets) {
      cssBlocks.set(shortestFilePath, snippets = []);
    }
    css.forEach(referencePath => {
      const { parentPath } = referencePath;
      const { node } = parentPath;
      const pos = sourcePos(node);
      const style = mergeTemplateExpression(node);
      const styleCompiled = serialize(compile(`.LOC { ${style} }`), stringify);
      const stylePretty = opts.beautify === false
        ? styleCompiled
        : cssBeautify(styleCompiled, opts.beautify);
      (snippets as CSSBlock[]).push({ pos, css: stylePretty, parentPath });
      updatesThisIteration++;
      parentPath.replaceWith(t.stringLiteral(className(shortestFilePath, pos)));
    });
  }
};

const serializeGlobalBlocks = (blocks: Map<string, InjectGlobalBlock[]>) => {
  let blob = '';
  for (const [filePath, block] of blocks.entries()) {
    for (const { pos, css } of block) {
      // eslint-disable-next-line prefer-template
      blob += `/* ${filePath}:${pos} */\n` + css + '\n';
    }
  }
  return blob;
};

const serializerClassBlocks = (blocks: Map<string, CSSBlock[]>) => {
  let blob = '';
  for (const [filePath, block] of blocks.entries()) {
    for (const { pos, css } of block) {
      const tag = className(filePath, pos);
      const safe = tag.replace(/([.:/])/g, (_, match: string) => `\\${match}`);
      // eslint-disable-next-line prefer-template
      blob += css.replace(/LOC/g, safe) + '\n';
    }
  }
  return blob;
};

let starting = true;
const writeStyles = () => {
  const updates = updatesThisIteration;
  const total = injectGlobalBlocks.size + cssBlocks.size;
  updatesThisIteration = 0;

  fs.writeFileSync(
    opts.outputFile,
    serializeGlobalBlocks(injectGlobalBlocks).replace(/}\n\n/g, '}\n')
  );
  fs.appendFileSync(
    opts.outputFile,
    serializerClassBlocks(cssBlocks).replace(/}\n\n/g, '}\n')
  );

  if (opts.quiet) return;

  if (starting) {
    console.log(`Moved ${total} CSS snippets to '${opts.outputFile}' with styletakeout.macro`);
    starting = false;
  } else {
    console.log(`Updated ${updates} of ${total} CSS snippets`);
  }
};

// export default createMacro(styletakeoutMacro);
export default createMacro(styletakeoutMacro, { configName: 'styletakeout' });
