import { css, snip } from 'styletakeout.macro';

// snip`...` is great since TS enforces the type at write-time instead of
// waiting for compile-time. It'll even error on ${} that's not referencing
// another snip.

let varHello = snip`lightblue`;
const varPink = snip`pink ${varHello} pink`;

const multiline = snip`
  margin-top: 5px;
`;

const styles = css`
  padding: 5px;
  background-color: ${varPink};
  ${multiline}
`;
