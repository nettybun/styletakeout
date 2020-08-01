import { css, decl, d } from 'styletakeout.macro';

declare module 'styletakeout.macro' {
  interface KnownDecl {
    sizes: {
      sm?: Decl
      md?: Decl
      lg?: Decl
    }
  }
}
// // Note this _doesn't_ work. Declaration merging isn't deep
// declare module 'styletakeout.macro' {
//   interface KnownDecl { colors: { green: Decl } }
// }

// Still works!
decl.colors.blue500 = d`...`;

// TS is smart enough to see that this resolves `Decl | undefined` to `Decl`
// This doesn't carry to other files. In index.ts all sizes are reset
decl.sizes.lg = d`5rem`;

const otherStyles = css`
  /* Note that trying to use .sm and .md will error as possibly undefined */
  padding: ${decl.sizes.lg};
`;

export { otherStyles };
