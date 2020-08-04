import { decl, css } from 'styletakeout.macro';

declare module 'styletakeout.macro' {
  // Use the type that works for you. The real value is in the JSON config
  type Rem = { _ : '' } & string
  interface Decl {
    // Note that declaration merging isn't deep. If size was already defined, it
    // would be overwritten
    sizes: {
      sm: Rem
      md: Rem
      lg: Rem
    }
  }
}

const exportedVariable = decl.sizes.md;
const otherStyles = css`
  padding: ${decl.sizes.lg};
`;

export { otherStyles };
