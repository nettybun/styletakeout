import 'styletakeout.macro';

declare module 'styletakeout.macro' {
  // Use the type that works for you. The real value is in the JSON config
  const decl: {
    primaryPurpleAccent: Hex
    multiline: ''
    color: typeof colors;
    size: typeof sizes;
  };
  type Hex = { _ : '' } & string
  const colors: {
    blue: {
      c400: Hex
      c500: Hex
    }
  };
  type Rem = { _ : '' } & string
  const sizes: {
    sm: Rem
    md: Rem
    lg: Rem
  };
}
