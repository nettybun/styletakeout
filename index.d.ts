export enum DeclBrand { _ = '' }
export type Decl = DeclBrand & string;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownDecl {}

// export interface DeclFn extends KnownDecl {
//   (statics: TemplateStringsArray, ...v: Decl[]): Decl
// }
export interface DeclObject {
  <K extends keyof KnownDecl>(state: (Pick<KnownDecl, K> | KnownDecl | null)): void;
}
export const decl: DeclObject;
export const d: KnownDecl; // DeclFn;

/** CSS is taken out; css`` statement is replaced with a string of a unique classname */
export function css(statics: TemplateStringsArray, ...variables: Decl[]): string;
/** CSS is taken out; injectGlobal`` statement is removed entirely */
export function injectGlobal(statics: TemplateStringsArray, ...variables: Decl[]): void;

// Upstream doesn't use types. The above aren't even real functions...
declare const macro: unknown;
export default macro;
