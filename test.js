import { css, decl } from 'styletakeout.macro';

// decl`...` is great since TS enforces the type at write-time instead of
// waiting for compile-time. It'll even error on ${} that's not referencing
// another decl.

let varHello = decl`lightblue`;
const varPink = decl`pink ${varHello} pink`;

const multiline = decl`
  margin-top: 5px;
`;

const styles = css`
  padding: 5px;
  background-color: ${varPink};
  ${multiline}
`;

// These will get merged into a single string
// Implementation needs improvement...
const classname = `m5 p5 ${css`vertical-align: middle`} align-center`;
