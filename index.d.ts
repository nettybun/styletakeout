export enum DeclBrand { _ = '' }
export type Decl = DeclBrand & string;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownDecl {}
/** Variable store. Must be Decl type */
export const decl: KnownDecl;

// TODO: d`` is a bad idea. It's too easy for people to pull out a subset of the
// decl "object" and try to use that - TS will say it's fine. There's too many
// cases that can go wrong that trying to enforce it in TS isn't worth the
// overhead to developers. Also in css`` and injectGlobal``, you _need_ to use
// references starting from `decl.[...]` which makes it obvious at a glance
// whether or not you're using them correctly. Instead of "does it lint error"
// it's "does it start with 'decl.'". Compile error is the only truth. TS won't
// tell you it's even a defined decl expression.

/** Create a Decl string to pass type restrictions for css`` and injectGlobal`` */
export function d(statics: TemplateStringsArray, ...v: Decl[]): Decl;

/** CSS is taken out; css`` statement is replaced with a string of a unique classname */
export function css(statics: TemplateStringsArray, ...variables: Decl[]): string;
/** CSS is taken out; injectGlobal`` statement is removed entirely */
export function injectGlobal(statics: TemplateStringsArray, ...variables: Decl[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: unknown;
export default macro;
