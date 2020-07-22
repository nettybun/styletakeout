# styletakeout.macro

Lets you pull CSS out of CSS-in-JS into an external CSS file. Similar to
`styled-components` and `csz` but at compile time instead of run time.

TODO:
  - Classnames aren't unique using `[filename]:[line]:[col]` instead of hashing.
    I like this, but I'll need to need a list of all used filenames/paths and
    if/while there's a collision add the parent folder.

  - Values of a tag template aren't interpolated... It's [Object object]

    This is actually really hard. Babel _does_ track scope bindings for variable
    names but not their ASTs. Even _if_ there was a way to reference the AST
    it's hard to determine the value. No code is evaluated. You certainly can't
    call a CallExpression - reading a string value might seem doable but imagine
    the case of `const h = 100, v = h + 'px';`. Stringifying that is _complex_.

    Check with: `console.log("Bindings in scope", parentPath.scope.bindings)`.

    I think the way forward is to ban all tag template expressions that aren't a
    special `"StringSnippet"` type. Then, like `css`, _collect_ all the values
    in a `Map` of some kind and look them up as needed - maybe `` snip`...` ``.
    That way the variable can be _forced to be a string type_ (or throw).

  - Optimize cases that result in `${"css-cHelloMessage.tsx:18:28"}`

    I suppose this can be done _before_ the actual node/path replacement. If the
    parent is a template literal that has only one expression, then replace with
    the `t.stringLiteral(tag)`...

It may be tempting to write something like:

```ts
const textSizes = {
  'text-xs': '.75rem',
  'text-sm': '.875rem',
  ...
  'text-6xl': '4rem;',
};
for (const [k, v] of Object.entries(textSizes)) {
  styles[k] = css`font-size: ${v}`;
}
```

**Absolutely won't work**. This might be why most CSS-in-JS are at runtime.
Remember that the ``` css`` ``` function is replaced entirely with the
classname:

```ts
for (const [k, v] of Object.entries(textSizes)) {
  styles[k] = "css-styles.ts:30:14";
}
```
