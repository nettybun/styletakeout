import { css, decl, d } from 'styletakeout.macro';
import { otherStyles } from './imported.js';

// Up to you on whether you want to use `:?`. You'll get a compile error if you
// forgot to define something, so it's only for intellisense
declare module 'styletakeout.macro' {
  interface KnownDecl {
    // No import needed for `Decl`~!
    hello?: Decl
    pink?: Decl
    // Yes this is wild but it works... In styletakout object aren't real.
    // Everything is a long concatenated variable name. The use of objects in
    // your code is entirely for organizational purposes.
    colors: Decl & {
      blue400?: Decl
      blue500?: Decl
    }
    multiline?: Decl
  }
}

// Yes unfortunately (?) this is a "feature" of reading `=` from the AST
// There's no concept of "objects". The "." can be basically converted to "-"
// and thought of as one-long-variable-name
decl.colors = d`...`;
decl.colors.blue400 = d`...`;
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

console.log(styles);
console.log(otherStyles);

// These are simplified into strings as expected
`m5 p5 ${css`vertical-align: middle`} align-center ${styles}`;
`m5 p5 ${css`vertical-align: middle`} align-center`;
`m5 p5 ${styles} ${css`vertical-align: middle`} align-center ${styles}`;
`${styles} ${css`vertical-align: middle`}`;
`${css`vertical-align: middle`}`;
`${css`vertical-align: middle`} hello`;
