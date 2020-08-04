# styletakeout.macro

Lets you pull CSS out of CSS-in-JS into an external CSS file. Similar to
`styled-components` and `csz` but at compile time instead of run time.

_/src/components/Button.ts_:
```ts
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

You configure this in `.babelrc.json` like this:

```json
{
  "plugins": [
    [
      "macros",
      {
        "styletakeout": {
          // Variables support nesting and aliases
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

## Classname structure

They're exported as `${prefix}${name}+${count}:${line}:${column}` where:

- **Prefix** defaults to `css-`. Listed in [options][1]

- **Name** is a filename (basename with extension) unless it's an _index_ file
  and [option "classUseFolder"][1] is true, then it's the folder name.

- **Count** is for conflict resolution as same-name files are encountered
  throughout the project. It increments from 0. This is an alternative to
  hashing, which _styled-components_ and friends often use.

  Note there was an attempt to use the shortest conflict-free file path but
  isn't possible due to a limtation from Babel; see [the design notes][2].

## Pitfalls

_This macro doesn't understand JavaScript (or TypeScript)._

Probably why all CSS-in-JS libraries are at runtime. There is no runtime in this
macro. That's the most important thing to remember. Any kind of clever language
use beyond basic bare-bones assignment expressions aren't understood.

### Macro export references

The macro is given a list of AST references to its exports. These are processed
and understood in isolation.

Any kind of renaming or modification won't work. The below doesn't work since
the macro only sees the line about `... = css` and then throws an error because
it's not in the form `` css`...` ``:

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

[1]: #options
[2]: https://gitlab.com/nthm/styletakeout/-/tree/work/notes.md
[3]: https://github.com/kentcdodds/babel-plugin-macros/issues/155
