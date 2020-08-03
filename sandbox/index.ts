import { decl, css } from 'styletakeout.macro';
import { otherStyles } from './imported.js';

// TypeScript is only for intellisense
// TODO: Use the detailed config from stayknit
declare module 'styletakeout.macro' {
  // Use the type that works for you. The real value is in the JSON config
  type Hex = { _ : '' } & string
  interface Decl {
    content: ''
    primaryPinkAccent: Hex
    colors: {
      blue400: Hex
      blue500: Hex
    }
    multiline: ''
  }
}

const styles = css`
  padding: 5px;
  background-color: ${decl.colors.blue500};
  ${decl.multiline}
  /* Note that .lg and .md error since TS can't ensure they're defined */
  ${decl.sizes.sm}
`;

console.log(styles);
console.log(otherStyles);

// These are simplified into strings as expected
`m5 p5 ${css`vertical-align: middle`} align-center ${styles}`;
`m5 p5 ${css`vertical-align: middle`} align-center`;
`m5 p5 ${styles} ${css`vertical-align: middle`} align-center ${styles}`;
`${styles} ${css`vertical-align: middle`}`;
`${css`vertical-align: middle`}`;
`${css`vertical-align: middle`} hello`;
