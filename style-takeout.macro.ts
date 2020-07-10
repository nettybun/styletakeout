import { createMacro } from 'babel-plugin-macros';
import fs from 'fs';

import type { MacroHandler } from 'babel-plugin-macros';
import type { PluginObj } from '@babel/core';
import type * as Types from '@babel/types';

// Preprocessor. Does nesting selectors like &:hover {}
// Used in `emotion` and `styled-components`

const cssTakeoutTag = 'css';
const snippets: string[] = [];

// There's no way to do work after all files are processed. Babel operates one
// file at a time so there's no global state or functions. The only way to
// collectively write to a CSS file is `fs.appendFile`

// https://github.com/michalkvasnicak/babel-plugin-css-modules-transform/blob/master/src/utils/extractCssFile.js
// https://github.com/jaredLunde/minify-css.macro/blob/master/src/macro.ts

const styleTakeoutMacro: MacroHandler = ({ references }) => {

};

type Exports = {
  css: (statics: TemplateStringsArray, ...variables: string[]) => string;
  injectGlobal: (statics: TemplateStringsArray, ...variables: string[]) => void;
};

// Since `createMacro` is typed as `() => any`...
const { css, injectGlobal } = createMacro(styleTakeoutMacro) as Exports;
export { css, injectGlobal };

const cssTakeout = ({ types: t }: { types: typeof Types }): PluginObj =>
  ({
    name: 'csstakeout',
    visitor: {
      TaggedTemplateExpression(path, state) {
        const tag = path.node.tag.name;
        if (tag !== cssTakeoutTag) return;

        const { loc } = path.container.openingElement;
        const name = ''; // TODO: Filename or if "index" then directory name
        const className = `${name}${loc.start.line}:${loc.start.column}`;
        const statics = path.node.quasi.quasis.map(e => e.value.raw);
        const expr = path.node.quasi.expressions;

        // TODO: Stylis work
        // this.snippets.push(preprocess(`.${className}`, rules));
      },
    },
    post() {
      // Leave as async
      fs.appendFile('style.css', snippets.join('\n'), () => {});
    },
  });

module.exports = cssTakeout;
