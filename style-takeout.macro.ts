import { createMacro } from 'babel-plugin-macros';
import * as t from '@babel/types';
import { stripIndent } from 'common-tags';
// @ts-ignore PR is open to support types but nothing yet
import { compile, serialize, stringify } from 'stylis';
import cssBeautify from 'cssbeautify';
import fs from 'fs';
import path from 'path';

import type { PluginPass } from '@babel/core';
import type { MacroHandler } from 'babel-plugin-macros';

/** CSS classes start with this: i.e `css-index.tsx#32:16` */
const classPrefix = 'css-';
const outFile = 'serve/takeout.css';
// They didn't export their `Options` object 🙄
const beautifyOptions: Parameters<typeof cssBeautify>[1] = {
  indent: '  ',
  openbrace: 'end-of-line',
  autosemicolon: true,
};

let snippetIterUpdates = 0;
const injectGlobalSnippets = new Map<string, string>();
const cssSnippets = new Map<string, string>();

// Need to know when Babel is done compilation. Patch process.stdout to search
// for @babel/cli. If stdout never emits a sign of running in @babel/cli then
// process.exit will be used as a fallback; which is clearly after compilation.
let runningBabelCLI = false;
process.on('exit', () => !runningBabelCLI && writeStyles());

// Can't `process.stdout.on('data', ...` because it's a Writeable stream
const stdoutWrite = process.stdout.write;
// @ts-ignore Typescript's never heard of wrapping overloaded functions before
process.stdout.write = (...args: Parameters<typeof process.stdout.write>) => {
  const [bufferString] = args;
  const string = bufferString.toString();
  if (string && string.startsWith('Successfully compiled')) {
    runningBabelCLI = true;
    writeStyles();
  }
  return stdoutWrite.apply(process.stdout, args);
};

const mergeTemplateExpression = (node: t.Node): string => {
  if (!t.isTaggedTemplateExpression(node)) {
    throw new Error(`Macro must be used as a tagged template and not "${node.type}"`);
  }
  let string = '';
  const { quasis, expressions } = node.quasi;
  for (let i = 0; i < expressions.length; i++) {
    string += quasis[i].value.raw;
    string += expressions[i];
  }
  // There's always one more `quasis` than `expressions`
  string += quasis[quasis.length - 1].value.raw;
  return stripIndent(string);
};

const sourceLocation = (node: t.Node, state: PluginPass) => {
  if (!node.loc) {
    throw new Error('Node didn\'t have location info as "node.loc"');
  }
  const { filename } = state;
  const { line, column } = node.loc.start;
  return `${path.basename(filename)}#${line}:${column}`;
};

const styleTakeoutMacro: MacroHandler = ({ references, state }) => {
  const { injectGlobal, css } = references;

  if (injectGlobal) injectGlobal.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    const loc = sourceLocation(node, state);
    const styles = mergeTemplateExpression(node);
    const stylesCompiled = serialize(compile(styles), stringify);
    const stylesPretty = cssBeautify(stylesCompiled, beautifyOptions);

    injectGlobalSnippets.set(loc, `/* ${loc} */\n${stylesPretty}`);
    snippetIterUpdates++;
    parentPath.remove();
  });

  if (css) css.forEach(referencePath => {
    const { parentPath } = referencePath;
    const { node } = parentPath;
    const loc = sourceLocation(node, state);
    const styles = mergeTemplateExpression(node);

    const tag = `${classPrefix}${loc}`;
    const tagSafe = tag.replace(/([.#:])/g, (_, match) => `\\${match}`);
    const stylesCompiled = serialize(compile(`.${tagSafe} { ${styles} }`), stringify);
    const stylesPretty = cssBeautify(stylesCompiled, beautifyOptions);

    cssSnippets.set(loc, stylesPretty);
    snippetIterUpdates++;
    parentPath.replaceWith(t.stringLiteral(tag));
  });
};

const toBlob = (x: Map<string, string>) => {
  let blob = '';
  // eslint-disable-next-line prefer-template
  for (const style of x.values()) blob += style + '\n';
  blob += '\n';
  return blob;
};

let starting = true;
const writeStyles = () => {
  const updates = snippetIterUpdates;
  const total = injectGlobalSnippets.size + cssSnippets.size;
  snippetIterUpdates = 0;

  fs.writeFileSync(outFile, toBlob(injectGlobalSnippets));
  fs.appendFileSync(outFile, toBlob(cssSnippets));

  if (starting) {
    console.log(`Style Takeout: Moved ${total} CSS snippets to '${outFile}'`);
    starting = false;
  } else {
    console.log(`Style Takeout: Updated ${updates} of ${total} CSS snippets`);
  }
};

export default createMacro(styleTakeoutMacro);
