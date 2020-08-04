# styletakeout.macro

Lets you pull CSS out of CSS-in-JS into an external CSS file. Similar to
`styled-components` and `csz` but at compile time instead of run time.

_/src/components/Button.ts_:
```ts
import { decl, css } from 'styletakeout.macro';

const buttonStyles = css`
  padding: 5px;
  border-radius: 2px;
  background-color: ${decl.colors.blue500};
  &:hover {
    background-color: ${decl.colors.blue600};
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

- `decl`: Object to access variables defined in your Babel config
- `` css`...` ``: CSS which is wrapped in a class and moved to the takeout file.
  In source code, the tag template is replaced with a string of the classname.
- `` injectGlobal`...` ``: Global CSS which is directly moved to the takeout
  file without a class. In source code the tag template is removed entirely.

The names _css_ and _injectGlobal_ are used by other CSS-in-JS libraries like
styled-components. This means editors like VSCode can provide syntax
highlighting, linting, and autocomplete out of the box.

All CSS is processed with Stylis and beautified with CSSBeautify. This can be
configured below.

## Options

Default values are shown:

```ts
const opts: ConfigOptions = {
  // Variables of the form `decl.x.y.z`. Set in Babel config
  decl: {},
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
};
```

You configure this in `.babelrc.json`:

Notice that variables support nesting and aliases.

```json
{
  "plugins": [
    [
      "macros",
      {
        "styletakeout": {
          "decl": {
            "pageBackground": "decl.color.black",
            "bodyBackground": "#eee",
            "color": {
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

## TypeScript for `decl` variables

In TypeScript you'll likely want autocomplete for the variables you've set. To
support this, use module augmentation:

```ts
declare module 'styletakeout.macro' {
  // Use the type that works for you. The real value is in the JSON config
  type Hex = { _ : '' } & string
  interface Decl {
    primaryPurpleAccent: Hex
    color: {
      blue: {
        c400: Hex
        c500: Hex
      }
    }
  }
}
```

The above example is from _sandbox/index.ts_. Notice that the object values
don't matter. You can use `string` but a branded type (as shown above) will
provide a helpful tooltip in your editor to hint the type.

[Here's a more complicated example using TailwindCSS colours][1].

## Classname structure

CSS classnames are written as `${prefix}${name}+${count}:${line}:${column}`:

- **Prefix** defaults to `css-`. Listed in [options][2]

- **Name** is a filename (basename with extension) unless it's an _index_ file
  and [option "classUseFolder"][2] is true, then it's the folder name.

- **Count** is for conflict resolution as same-name files are encountered
  throughout the project. It increments from 0. This is an alternative to
  hashing, which _styled-components_ and friends often use.

  Note there was an attempt to use the shortest conflict-free file path but
  isn't possible due to a limtation from Babel; see [the design notes][3].

## Examples

You can see the _sandbox/_ directory of this repo for some test cases, or see
how it's used in an application at https://github.com/heyheyhello/stayknit

## Pitfalls

At compile time, there is no runtime to understand JS. This is probably why
nearly all CSS-in-JS libraries operate are at runtime (in browser).

So keep that in mind. Below are some common pitfalls where the compiler won't
understand your code:

### Macro export references

The `decl`, `css`, and `injectGlobal` functions are processed and understood in
isolation by the compiler.

This means any kind of renaming or modification won't work. In the example
below, the macro only sees the line about `... = css` and then immediately
throws an error since it's not a tag template like `` css`...` ``:

```ts
import { css } from 'styletakeout.macro';
const somethingElse = css;
const classname = somethingElse`padding: 5rem`;
```

### Variable usage

The `decl` macro references variables you've defined as an object in your Babel
config. _You must call from the root `decl` onward._ JS knows how to split
object expressions, but this isn't JS - The macro only recognizes full paths
like `${decl.[...]}`.

The below won't work:

```ts
// Assuming you've set `decl.blue` to #ABCDEF
const blue = decl.blue
css`
  color: ${blue};
`;
```

Remember that each macro is processed and understood in isolation.

1. The `decl` macro will change `= decl.blue` to `= "#ABCDEF"`.

2. The `css` block will see that the tag template expression `${blue}` is not in
   the form `${decl.[...]}` and throw an error. It _only_ knows how to lookup
   values in `decl`.

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

[1]: https://github.com/heyheyhello/stayknit/blob/9c8f705dd8d688dc4c8a9f0ee4cd98bd97861d5c/src/styles.ts
[2]: #Options
[3]: https://gitlab.com/nthm/styletakeout/-/tree/work/notes.md
