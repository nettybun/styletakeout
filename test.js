import { css, snip } from 'styletakeout.macro'

// I think snip() makes more sense than snip`...` since TS can enforce the type
// at write-time instead of waiting for compile-time.

// Uhhhh.... no? Because TS will say snip(funcReturnsString()) is OK - it's not
const varPink = snip('pink');

// So. snip`pink`. Then throw if there are any expressions at all.

css`
  padding: 5px;
  background-color: ${varPink};
`
