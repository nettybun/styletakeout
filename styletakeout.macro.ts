import { createMacro } from 'babel-plugin-macros';
import * as t from '@babel/types';
import { stripIndent } from 'common-tags';
import { compile, serialize, stringify } from 'stylis';
import cssBeautify from 'cssbeautify';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

import type { NodePath, PluginPass } from '@babel/core';
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
  classUseFolder: true,
  outputFile: 'build/takeout.css',
  beautify: {
    indent: '  ',
    openbrace: 'end-of-line',
    autosemicolon: true,
  },
  quiet: false,
  timing: false,
  stdoutPatch: true,
  stdoutSearchString: 'Successfully compiled',
};
// The macro function is called per file, but only the config is passed during
// its call... it's a waste of time to Object.assign _everytime_ so skip it.
let optsSet = false;

let updatesThisIteration = 0;
/** Map variable name to its value */
const snipBlocks = new Map<string, string>();

// File paths for classnames. Need to know which are taken and account for
// multiple passes of the same file when Babel is run as `--watch`

const cwd = process.cwd();
/** Map of full file paths to their shortname+N short form */
const mapPathToShortN = new Map<string, string>();
/** Map of shortname to current N counter; incremented each conflict */
const mapShortToN = new Map<string, number>();

/** Map of shortname+N to the CSS snippet */
const injectGlobalBlocks = new Map<string, string>();
/** Map of shortname+N to the CSS snippet */
const cssBlocks = new Map<string, string>();

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

const sourceLocation = (node: t.Node, state: PluginPass) => {
  if (!node.loc) {
    throw new Error('Node didn\'t have location info as "node.loc"');
  }
  // This is a bad variable name; it's not the only the name...
  const { filename: absPath } = state;
  const relPath = path.relative(cwd, absPath);

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

/** In ms for performance.now() */
let time = 0;
const styletakeoutMacro: MacroHandler = ({ references, state, config }) => {
  const t0 = performance.now();
  if (!optsSet) {
  Object.assign(opts, config);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  Object.assign(opts.beautify, config.beautify || {});
    optsSet = true;
  }

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

    // Remove the entire VariableDeclarator
    parentPath.parentPath.remove();
  });

  if (injectGlobal) injectGlobal.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    const loc = sourceLocation(node, state);
    const style = mergeTemplateExpression(node);
    const styleCompiled = serialize(compile(style), stringify);
    const stylePretty = opts.beautify === false
      ? styleCompiled
      : cssBeautify(styleCompiled, opts.beautify);

    injectGlobalBlocks.set(loc, `/* ${loc} */\n${stylePretty}`);
    updatesThisIteration++;
    parentPath.remove();
  });

  if (css) css.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    const loc = sourceLocation(node, state);
    const style = mergeTemplateExpression(node);

    const tag = `${opts.classPrefix}${loc}`;
    const tagSafe = tag.replace(/([.:+])/g, (_, match: string) => `\\${match}`);
    const styleCompiled = serialize(compile(`.${tagSafe} { ${style} }`), stringify);
    const stylePretty = opts.beautify === false
      ? styleCompiled
      : cssBeautify(styleCompiled, opts.beautify);

    cssBlocks.set(loc, stylePretty);
    updatesThisIteration++;
    parentPath.replaceWith(t.stringLiteral(tag));
  });
  const t1 = performance.now();
  time += t1 - t0;
  if (opts.timing) console.log();
};

let starting = true;
const writeStyles = () => {
  const t0 = performance.now();
  const updates = updatesThisIteration;
  const total = injectGlobalBlocks.size + cssBlocks.size;
  updatesThisIteration = 0;

  let styles = '';
  // eslint-disable-next-line prefer-template
  for (const style of injectGlobalBlocks.values()) styles += style + '\n';
  // eslint-disable-next-line prefer-template
  for (const style of cssBlocks.values()) styles += style + '\n';
  fs.writeFileSync(opts.outputFile, styles.replace(/}\n\n/g, '}\n'));

  if (opts.quiet) return;
  const t1 = performance.now();
  const ms = Math.round(time + (t1 - t0));

  if (starting) {
    console.log(`Moved ${total} CSS snippets to '${opts.outputFile}' with styletakeout.macro (${ms}ms)`);
    starting = false;
  } else {
    console.log(`Updated ${updates} of ${total} CSS snippets (${ms}ms)`);
  }
};

// export default createMacro(styletakeoutMacro);
export default createMacro(styletakeoutMacro, { configName: 'styletakeout' });
