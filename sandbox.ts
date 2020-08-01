import { css, decl, d } from 'styletakeout.macro';

// declare module 'styletakeout.macro' {
//   interface KnownDecl {
//     varHello: Decl;
//     varPink: Decl;
//     multiline: Decl;
//   }
// }

// TODO:?
// decl.colors.blue500`...`;

// Might be easier to just have decl() as a function that accepts an object
// decl({
//   varHello: '...',
//   colors: {
//     blue500: '...',
//   },
// });
// css`...${decl.varHello}` ?
// Easier to type this in a module augmentation via `typeof yourObject`...
type S = {};
decl<S>({
  multiline: '',
});
(d as S).multiline;

// decl.varHello`lightblue`;
// decl.varPink`pink ${decl.varHello} pink`;

// decl.multiline`
//   margin-top: 5px;
// `;

const styles = css`
  padding: 5px;
  background-color: ${d.varPink};
  ${d.multiline}
`;

// These are simplified into strings as expected
`m5 p5 ${css`vertical-align: middle`} align-center ${styles}`;
`m5 p5 ${css`vertical-align: middle`} align-center`;
`m5 p5 ${styles} ${css`vertical-align: middle`} align-center ${styles}`;
`${styles} ${css`vertical-align: middle`}`;
`${css`vertical-align: middle`}`;
`${css`vertical-align: middle`} hello`;
