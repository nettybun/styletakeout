const fs = require('fs');
const Stylis = require('@emotion/stylis');

// Preprocessor. Does nesting selectors like &:hover {}
// Used in `emotion` and `styled-components`
const preprocess = new Stylis();
const cssTakeoutTag = 'css';

function cssTakeout({ types: t }) {
  return {
    name: 'csstakeout',
    pre() {
      this.snippets = [];
    },
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
      fs.writeFile('style.css', this.cssSnippets.join('\n'));
    },
  };
}

module.exports = cssTakeout;
