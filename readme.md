# styletakeout.macro

Lets you pull CSS out of CSS-in-JS into an external CSS file. Similar to
`styled-components` and `csz` but at compile time instead of run time.

TODO:
  - Classnames aren't unique using `[filename]:[line]:[col]` instead of hashing.
    I like this, but I'll need to need a list of all used filenames/paths and
    if/while there's a collision add the parent folder.
  - Values of a tag template aren't interpolated... It's [Object object]
  - Optimize cases that result in `${"css-cHelloMessage.tsx:18:28"}`

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
