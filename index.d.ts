export enum SnipBrand { _ = '' }
export type Snip = SnipBrand & string;

export function snip(statics: TemplateStringsArray, ...variables: Snip[]): Snip;
export function css(statics: TemplateStringsArray, ...variables: Snip[]): string;
export function injectGlobal(statics: TemplateStringsArray, ...variables: Snip[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: unknown;
export default macro;
