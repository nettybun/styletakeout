export enum DeclBrand { _ = '' }
export type Decl = DeclBrand & string;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownDecl {}
/** Variable store. Must be Decl type */
export const decl: KnownDecl;
/** Create a Decl string to pass type restrictions for css`` and injectGlobal`` */
export function d(statics: TemplateStringsArray, ...v: Decl[]): Decl;

/** CSS is taken out; css`` statement is replaced with a string of a unique classname */
export function css(statics: TemplateStringsArray, ...variables: Decl[]): string;
/** CSS is taken out; injectGlobal`` statement is removed entirely */
export function injectGlobal(statics: TemplateStringsArray, ...variables: Decl[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: unknown;
export default macro;
