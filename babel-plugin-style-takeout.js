const Stylis = require('@emotion/stylis');

// Preprocessor. Does nesting selectors like &:hover {}
// Used in `emotion` and `styled-components`
const preprocess = new Stylis();

// XXX: Trying to read `styled-components` Babel plugin source... oof
module.exports = function styleTakeout({ types: t }) {
  return {
    visitor: {},
  };
};
