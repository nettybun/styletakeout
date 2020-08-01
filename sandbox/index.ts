import { css, decl, d } from 'styletakeout.macro';
import { otherStyles } from './imported.js';

// Up to you on whether you want to use `:?`. You'll get a compile error if you
// forgot to define something, so it's only for intellisense
declare module 'styletakeout.macro' {
  interface KnownDecl {
    // No import for `Decl`~!
    hello?: Decl
    pink?: Decl
    colors: {
      blue400?: Decl
      blue500?: Decl
    }
    multiline?: Decl
  }
}

decl.colors.blue500 = d`...`;

decl.hello = d`lightblue`;
decl.pink = d`pink ${decl.hello} pink`;
decl.sizes.sm = d`1rem`;

decl.multiline = d`
  margin-top: 5px;
`;

const styles = css`
  padding: 5px;
  background-color: ${decl.colors.blue500};
  ${decl.multiline}
  /* Note that .lg and .md error since TS can't ensure they're defined */
  ${decl.sizes.sm}
`;

// These are examples of an export into real runtime JS as a string
const realVariable = decl.pink;
console.log(decl.hello);

console.log(styles);
console.log(otherStyles);

// These are simplified into strings as expected
`m5 p5 ${css`vertical-align: middle`} align-center ${styles}`;
`m5 p5 ${css`vertical-align: middle`} align-center`;
`m5 p5 ${styles} ${css`vertical-align: middle`} align-center ${styles}`;
`${styles} ${css`vertical-align: middle`}`;
`${css`vertical-align: middle`}`;
`${css`vertical-align: middle`} hello`;
