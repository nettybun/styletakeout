# styletakeout.macro

Lets you pull CSS out of CSS-in-JS into an external CSS file. Similar to
`styled-components` and `csz` but at compile time instead of run time.

TODO:
  - Classnames aren't unique using `[filename]:[line]:[col]` instead of hashing.
    I like this, but I'll need to need a list of all used filenames/paths and
    if/while there's a collision add the parent folder.
