export enum DeclBrand { _ = '' }
export type Decl = DeclBrand & string;

export type DeclFn = (statics: TemplateStringsArray, ...v: DeclFn[]) => Decl

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeclObject {}

// I tried Proxy but TS' implementation doesn't allow type convertion #20846
// export interface DeclProxy extends ProxyHandler<DeclObject> { ... }

// /** Declare a variable (use const/let/var) */
// export function decl(statics: TemplateStringsArray, ...variables: Decl[]): Decl;
export const decl: DeclObject;
/** CSS is taken out; css`` statement is replaced with a string of a unique classname */
export function css(statics: TemplateStringsArray, ...variables: DeclFn[]): string;
/** CSS is taken out; injectGlobal`` statement is removed entirely */
export function injectGlobal(statics: TemplateStringsArray, ...variables: DeclFn[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: unknown;
export default macro;
