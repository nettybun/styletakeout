import { decl, sizes, css } from 'styletakeout.macro';

const exportedVariable = sizes.md;
const otherStyles = css`
  padding: ${decl.size.lg};
`;

export { otherStyles };
