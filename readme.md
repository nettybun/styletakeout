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

## TODO:

The TODO list is back

- Variables need an overhaul. Specifically, to be able to change a variable in
  one file and have it update all styles in all files in `--watch` mode. It's
  hard to work with real JS variables since the AST is not real JS (there's no
  way to know the value, or catch overwrites), so it's best to have `decl`
  not depend on its environment.

## Options

Default values are shown:

```ts
const opts: ConfigOptions = {
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
          "outputFile": "dist/takeout.css",
          "beautify": false,
        }
      }
    ]
  ]
}
```

## Classnames

They're exported as `${prefix}${name}+${count}:${line}:${column}` where:

- **Prefix** defaults to `css-`. Listed in [options][1]

- **Name** is a filename (basename with extension) unless it's an _index_ file
  and [option "classUseFolder"][1] is true, then it's the folder name.

- **Count** is for conflict resolution as same-name files are encountered
  throughout the project. It increments from 0. This is an alternative to
  hashing, which _styled-components_ and friends often use.

  Note there was an attempt to use the shortest conflict-free file path but
  isn't possible due to a limtation from Babel; see [the appendix][2].

## Hiccups

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

### Variable declaration

This is done with `decl`. It looks like an object but isn't. Remember there's
no understanding of JS here, so the use of an object is entirely for your own
organizational purposes. Try thinking of `decl.colors.blue` as the one long
variable name like `decl-colors-blue` because that's literally how it's handled.

Variables are global and mutable. The last file to write wins.

Because the macro is processed in isolation, it can only handle strings and
template literals that reference other `decl` variables (read the next section
on variable usage)

The below doesn't work since `decl` has no idea what `color` is.

```ts
const color = "#ABCDEF"
decl.colors.blue = color
```

Similarly, any of these won't work:

```ts
decl.size = function() { ... } // Not a string
decl.size.large = 20 // Not a string
decl.size.medium = '20' + 'rem' // Not a string; this is an expression
```

### Variable usage

As mentioned above, variables in the `decl` "object" are actually one long
variable name, so `decl`, `css`, and `injectGlobal` must reference them using
their full "paths" like `${decl.[...]}`.

The below won't work:

```ts
// Assuming you've set `decl.blue = #ABCDEF` elsewhere
const blue = decl.blue
css`
  color: ${blue};
`;
```

Remember that each macro is processed and understood in isolation.

The `decl` macro sees `= decl.colors` has a left-hand-side equals sign and
throws. I wish I could give you `const blue = "#ABCDEF"` but Babel doesn't allow
that, see appendix. You can't use a `decl` anywhere outside of `css` and
`injectGlobal` blocks.

_If_ the `css` block could run (it won't because we've errored by now) it'd see
that the tag template expression `${blue}` is not in the form `${decl.[...]}`
and throw an error. It _only_ knows how to lookup values in `decl`.

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
  styles[k] = "css-styles.ts:30:14";
}
```

## Appendix

Explaining some quirks and design decisions:

### Variables with `decl`

Ugh. I really didn't like this. _They're not real JS variables at all_. It makes
sense to support variables as there are good reasons to want them, but without
running in a real JS runtime makes it hard to define what a variable is.

Concepts like declaration, scope, import/export, nested objects, and updates all
don't make sense anymore. In the first few iterations I designed `decl` for good
autocomplete support by enforcing ``const/let/var x = decl`...` `` and then
straight up _removing_ the variable declaration (!). This is an awful idea
because it treats `decl` like a variable when it's really not... Imagine how
people could easily export the variable and their editor would say it was fine.

Hard pass.

The current version of `decl` involves either:

  - RHS assignment `decl.[...] = '...'`
  - Use in `css` and `injectGlobal` blocks

I wanted the ability to export a decl to a string to be used in JS code, but the
same issues of `unique-paths` branch (see appendix' section on classnames) came
up where it's not possible to use Babel to modify already written JS files.
Since decl is global, another file can change a variable value already in use
and I'd need to update all the areas that use it. _It's not possible to update
the JS source of already written files_. I can only touch the CSS output.

This breaks the ability to export variables to into JS-land at all, so I removed
it. If you have a better alternative let me know.

### Babel CLI and patching `process.stdout.write`

This macro supports the `babel --watch` command to update the takeout on each
save in your editor. Unfortunately there's [no way to know when Babel is done
compiling][3] and files are processed one at a time in isolation. I managed to
get around this by adding a `process.on('exit', ...)` listener, since Babel
_must_ be done if the process is exiting. This works for any tools that are Node
processes like Webpack/Rollup, too. However, for `--watch` the process hangs
forever (that's the point)...there is a `console.log` message on each hot-update
though: "Successfully compiled N files with Babel (XXXms)". In Node the stdout
stream write-only, but the function `process.stdout.write` can be replaced - so
I wrapped it and look for _"Successfully compiled"_. You can change the string
with ["stdoutSearchString"][1] or turn off the patch with ["stdoutPatch"][1].

### Classnames and shortest unique file path as an alternatives to hashes

I didn't want to use a hash or random number for the classname because in my
experience they're meaningless at a glance - `.sc-JwXcy` doesn't tell me
anything. The idea was to use the filename only, and if there was a collision,
reconcile by adjusting each of the conflicting names to use their parent
directory (as many times as needed).

For example, a conflicted `Grouper.jsx` component would have conflicts resolve
into `Dropdown/Grouper.jsx` and `List/Grouper.jsx`.

Originally I collected all filenames and did conflict resolution just before
writing the takeout (on process exit, likely). This didn't work. I imagine that
the AST had already been serialized by then, so changes weren't observed.

Next I tried to update on the fly - this work is at the HEAD of `unique-paths`
for reference - which _should_ work but I _think_ Babel must be serializing and
writing the AST for _each file as it's encountered_. Once the macro is working
on another file, references to the previous file's AST don't work. Ugh.

Even if it did work though, it adds a lot of code complexity. 1/3 of the code
was filepath reconcilation...

Settled on an auto-incrementing number `+N` since it _at least_ gives you the
filename at a glance, which is more meaningful than a hash. The mapping of N to
the full filepath is written alongside the CSS takeout for when you need to find
the source.

[1]: #Options
[2]: #Appendix
[3]: https://github.com/kentcdodds/babel-plugin-macros/issues/155
