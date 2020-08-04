# Notes/Appendix

Explaining some quirks and design decisions:

## Variables with `decl`

I really didn't like designing this. Variables are hard! It makes sense to
support them but without running in a real JS runtime concepts like declaration,
scope, import/export, nested objects, and updates all don't make sense anymore.

Variables were orignally set _in JS_ like ``const/let/var x = decl`...` `` where
macro `decl` had to be a `TagTemplateExpression` (to enforce that `${...}` used
only other `decl` statements). Then the entire variable declaration was straight
up removed from the code (!). This is bad because it treats `decl` like a
variable when it's really not... People can easily export the variable or mutate
it and their editor will say it's fine.

The next version didn't use `VariableDeclaration` to get the variable name.
Instead you treat `decl` as an object and write to it like `decl.[...] = '...'`.
This enters a huge mess. Now variables are global. In `--watch` (and not) the
last write wins and must update all references in the project. However, as
learned in the below section on classnames, it's not possible to use Babel to
modify already written JS files - so I can't support exporting `decl` to a
string to be used in JS code. I can only touch the CSS output. This is bad
because I'm treating `decl` like a variable that can be set but not read unless
it's in a `css` or `injectGlobal` block, and that changes update CSS but not JS.

Also people will want to be able to export into JS-land. That's important.

The last/current version sets variables in the Babel config as JSON. No
assignment in JS! This also means it's intuitive that changes to variables will
require a full reload (not just a `--watch` save). That's also great because it
doesn't let people get too deep into variable tricks - it's JSON.

## Babel CLI and patching `process.stdout.write`

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

## Classnames and shortest unique file path as an alternatives to hashes

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
