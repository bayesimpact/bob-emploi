# Plugins For Bob

In this folder, you can add 3rd party apps that depends on Bob core React app.


Each plugin has the same structure as the core app, with `cfg` and `src` folders.

## Configuration

The configuration can extend the base config, in particular `entrypoints`, `colors`, and `const` and `const_dist`.

Entrypoints are not namespaced, and their route in the dev server are not prefixed either, so you should be careful not to use an entrypoint with a rewrite overlapping an existing one.

## Sources

The source files may use components from the core app using aliases: importing from `'components/...'`, or `'images/...'` will look for the described file in the core app.

To import files from the current plugin, you should import using relative path:

```ts
import Foo from './components/foo'
```

## Typescript

For plugins with typed files, you need to define a tsconfig.json file at the root of your plugin folder.

## String extraction

For translation, you may use the string extraction process already in place in the core app. Define a `i18n.babelrc.js` file at the root of your plugin folder, with the relevant `i18next-extract` plugin. This file must be JS config, not other formats usually allowed by babel.

## Plugin selection

You can choose to use only specific plugins by putting them as a comma separated list in the `BOB_PLUGINS` environment variable.
