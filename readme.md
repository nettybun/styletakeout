# styletakeout.macro

Lets you pull CSS out of CSS-in-JS into an external CSS file. Similar to
`styled-components` and `csz` but at compile time instead of run time.

It's 350 lines of TypeScript in a single file and still fully featured. The web
ecosystem loves over engineering and complexity; this pushes against that.

_/src/components/Button.ts_:
```ts
import { css, colours } from 'styletakeout.macro';

const buttonStyles = css`
  padding: 5px;
  border-radius: 2px;
  background-color: ${colours.blue500};
  &:hover {
    background-color: ${colours.blue600};
  }
`;
const Button = ({ text }) => html`
  <button class=${buttonStyles}>${text}</button>
`;
```

Becomes:

_/build/components/Button.ts_
```ts
const buttonStyles = "css-Button.tsx+0:10:22";
const Button = ({ text }) => html`
  <button class=${buttonStyles}>${text}</button>
`;
```
_/build/takeout.css_
```css
.css-Button\.tsx\+0\:10\:22 {
  padding: 5px;
  border-radius: 2px;
  background-color: #4299e1;
}
.css-Button\.tsx\+0\:10\:22:hover {
  background-color: #3182ce;
}
```

## API

- `` css`...` ``: CSS which is wrapped in a class and moved to the takeout file.
  In source code, the tag template is replaced with a string of the classname.
- `` injectGlobal`...` ``: Global CSS which is directly moved to the takeout
  file without a class. In source code the tag template is removed entirely.
- `...variables`: Any other imports are treated as variables and looked up in
  your Babel config. See [this file][1], and this [real file][2] as examples.

The names _css_ and _injectGlobal_ are used by other CSS-in-JS libraries like
styled-components. This means editors like VSCode can provide syntax
highlighting, linting, and autocomplete out of the box.

All CSS is processed with Stylis and beautified with CSSBeautify. This can be
configured below.

## Options

For your Babel config (`.babelrc.json` or similar). Default values are shown:

```ts
{
  // Variables. Supports nesing and aliases via "$x.y.z". See examples.
  variables: {},
  // Prefix for all CSS classes: i.e `css-` will yield `css-file.tsx:32:16`
  classPrefix: 'css-',
    // If the file is `index`, use the folder name only
  classUseFolder: true,
    // Relative path to output file. Defaults to `./build/takeout.css`
  outputFile: 'build/takeout.css',
  // Options for `cssbeautify` package or `false` to skip formatting
  beautify: {
    indent: '  ',
    openbrace: 'end-of-line',
    autosemicolon: true,
  },
  // Log to the console
  quiet: false,
  // Log ms per file
  timing: false,
  // Support update-on-save by patching `process.stdout.write()` to know when Babel has compiled
  stdoutPatch: true,
  // String to look for with `indexOf()`. Defaults to @babel/cli's "Sucessfully compiled ..."
  stdoutSearchString: 'Successfully compiled',
}
```

Minimal example:

```json
{
  "plugins": [
    [
      "macros",
      {
        "styletakeout": {
          "variables": {
            "def": {
              "pageBackground": "$colour.black",
              "bodyBackground": "#eee",
            },
            "colour": {
              "black": "#000",
              "white": "#fff",
            }
          },
          "outputFile": "dist/takeout.css",
          "beautify": false
        }
      }
    ]
  ]
}
```

See [this local file][1], and this [other project's file][2] as larger more
complex examples.

## Typings for variables (TS/JS/Intellisense)

You'll likely want autocomplete for the variables you've set. To support this,
use module augmentation. For the minimal example Babelrc from above, you might
use this:

```ts
declare module 'styletakeout.macro' {
  const def: {
    pageBackground: Hex
    bodyBackground: Hex
  }
  const colour {
    black: Hex
    white: Hex
  }
  // Use the type that works for you. The real value is in the JSON config.
  // You could easily use '' or `string`. Anything to help you remember.
  type Hex = { _ : '' } & string
}
```

Now `def` and `colour` will be valid imports with full type-support. You can
import them.

You'll find this example in _sandbox/index.ts_. Notice that the object values
don't matter. You can use `string` but a branded type (as shown above) will
provide a helpful tooltip in your editor to hint the type.

[Here's a more complicated example using TailwindCSS colours][2].

## Classname structure

CSS classnames are written as `${prefix}${name}+${count}:${line}:${column}`:

- **Prefix** defaults to `css-`. Listed in [options][2]

- **Name** is a filename (basename with extension) unless it's an _index_ file
  and [option "classUseFolder"][3] is true, then it's the folder name.

- **Count** is for conflict resolution as same-name files are encountered
  throughout the project. It increments from 0. This is an alternative to
  hashing, which _styled-components_ and friends often use.

  Note there was an attempt to use the shortest conflict-free file path but
  isn't possible due to a limtation from Babel; see [the design notes][4].

## Examples

You can see the _sandbox/_ directory of this repo for some test cases, or see
how it's used in an application at https://github.com/heyheyhello/stayknit

## Pitfalls

At compile time, there is no runtime to understand JS. This is probably why
nearly all CSS-in-JS libraries operate are at runtime (in browser).

So keep that in mind. Below are some common pitfalls where the compiler won't
understand your code:

### Macro export references

All imports are processed and understood in isolation by the compiler.

This means any kind of renaming or modification won't work. In the example
below, the macro only sees the line about `... = css` and then immediately
throws an error since it's not a tag template like `` css`...` ``:

```ts
import { css } from 'styletakeout.macro';
const somethingElse = css;
const classname = somethingElse`padding: 5rem`;
```

### Variable usage

You can't do complex variables like you can in JS. You can read values but not
objects; there's no intermidiate readings. Here's some examples assuming you've
defined a `decl` variable.

```ts
// Assuming you've set `decl.blue` to #ABCDEF. This is OK.
const blue = decl.blue
// However, below is NOT OK.
css`
  color: ${blue};
`;
// Neither is this, assuming `decl.colours` is an object
const colourObject = decl.colours; // Error
const blue = colourObject.blue;
```

Remember that each macro is processed and understood in isolation.

1. The `decl` macro will change `= decl.blue` to `= "#ABCDEF"`. OK!

2. The `css` block will see that the tag template expression `${blue}` is not a
   known variable in the JSON config and will throw an error. It _only_ knows
   how to lookup defined values, nothing about JS.

3. Lastly `colour`, presumably is an object with colours in it, will not be
   serialized to JSON - it'll throw an error: `"decl.colour" is an object`

### No code evaluation

The macro is _removed_ at compile time in-place. This doesn't work:

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

The `css` macro is replaced entirely with the classname. No code is ever run.
There's no JS runtime. The macro is not aware of the for-loop it's in - it
_only_ sees the exact `` css`...` `` line and replaces it.

The result:

```ts
for (const [k, v] of Object.entries(textSizes)) {
  styles[k] = "css-styles.ts+0:30:14";
}
```

It's not complicated. Just look sideways a bit to get the hang of it.

[1]: https://gitlab.com/nthm/styletakeout/-/tree/work/sandbox/.babelrc.json
[2]: https://github.com/heyheyhello/stayknit/blob/work/src/styletakeout.d.ts
[3]: #Options
[4]: https://gitlab.com/nthm/styletakeout/-/tree/work/notes.md
