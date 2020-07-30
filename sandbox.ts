import { css, decl } from 'styletakeout.macro';
import type { Decl, DeclFn } from 'styletakeout.macro';

type MyType = {
  [key in
    | 'varHello'
    | 'varPink'
    | 'multiline'
  ]: DeclFn;
}

declare module 'styletakeout.macro' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DeclObject extends MyType {}
}

// TODO:?
// decl.colors.blue500`...`;

decl.varHello`lightblue`;
decl.varPink`pink ${decl.varHello} pink`;

decl.multiline`
  margin-top: 5px;
`;

const styles = css`
  padding: 5px;
  background-color: ${decl.varPink};
  ${decl.multiline}
`;

// These are simplified into strings as expected
`m5 p5 ${css`vertical-align: middle`} align-center ${styles}`;
`m5 p5 ${css`vertical-align: middle`} align-center`;
`m5 p5 ${styles} ${css`vertical-align: middle`} align-center ${styles}`;
`${styles} ${css`vertical-align: middle`}`;
`${css`vertical-align: middle`}`;
`${css`vertical-align: middle`} hello`;
