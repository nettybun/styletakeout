export function css(statics: TemplateStringsArray, ...variables: string[]): string;
export function injectGlobal(statics: TemplateStringsArray, ...variables: string[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: any;
export default macro;
