export enum SnipBrand { _ = '' }
export type Snip = SnipBrand & string;

/** Declare a variable (use const/let/var) */
export function decl(statics: TemplateStringsArray, ...variables: Snip[]): Snip;
/** CSS is taken out; css`` statement is replaced with a string of a unique classname */
export function css(statics: TemplateStringsArray, ...variables: Snip[]): string;
/** CSS is taken out; injectGlobal`` statement is removed entirely */
export function injectGlobal(statics: TemplateStringsArray, ...variables: Snip[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: unknown;
export default macro;
