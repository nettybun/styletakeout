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

// These are simplified into strings as expected
`m5 p5 ${css`vertical-align: middle`} align-center ${styles}`;
`m5 p5 ${css`vertical-align: middle`} align-center`;
`m5 p5 ${styles} ${css`vertical-align: middle`} align-center ${styles}`;
`${styles} ${css`vertical-align: middle`}`;
`${css`vertical-align: middle`}`;
`${css`vertical-align: middle`} hello`;
