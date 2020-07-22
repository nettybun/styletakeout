import { css, snip } from 'styletakeout.macro';

// snip`...` is great since TS enforces the type at write-time instead of
// waiting for compile-time. It'll even error on snip`string ${10}` under the
// basis of "Expected 1 arguments, but got N"

const varPink = snip`pink`;


css`
  padding: 5px;
  background-color: ${varPink};
`;
