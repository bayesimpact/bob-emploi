# Plugins For Bob

In this folder, you can add 3rd party apps that depends on Bob core React app.


Each plugin has the same structure as the core app, with `cfg` and `src` folders.

## Configuration

The configuration can extend the base config, in particular `entrypoints`, `colors`, and `const`.

### Entrypoints

Entrypoints are not namespaced, and their route in the dev server are not prefixed either, so you should be careful not to use an entrypoint with a rewrite overlapping an existing one. However, their `entry` is relative to the plugin folder, so you may use `./src/entry`, for instance.

### Loaders

For plugins to add content to entrypoints from `core` or other plugins, you can add loaders. In the `src/loaders` subfolder of a plugin, Bob framework will load modules in Webpack with the name of the entrypoint. For instance when loading or compiling the core `nps` entrypoint, Bob will also load modules from `plugins/*/src/loaders/nps` if they exist. Note that those loaders export are not used, so they need to have side effects.

### Colors

You may create a plugin-specific `colors.json5`, which will allow your plugin to use specific colors.

If colors have the same name in core and the plugin, priorities are as follows (latter source will override former ones):

- core colors (i.e. from cfg/colors.json5)
- plugin colors (e.g. from plugins/jobflix/cfg/colors.json5)
- deployment colors (e.g. from cfg/deployments/fr.json5#colors)

#### Typing

For the colors to be properly typed, you need to go through the following steps:

- Add a `custom.d.ts` file in your plugin
- Add a `tsconfig.json` file at the root of the plugin folder that includes (at least) the core `custom.d.ts` and the one you just created
- Add a conversion of the `colors.json5` file to json in `frontend/client/entrypoint.sh` (replacing the variables with what you see fit):
```bash
    npx json5 plugins/$PLUGIN_NAME/cfg/colors.json5 > /tmp/bob_emploi/${PLUGIN_NAME}_colors.json
```
- Add the following lines in the newly created `custom.d.ts`:
```typescript
    type PluginColors = {[name in keyof typeof import('/tmp/bob_emploi/${PLUGIN_NAME}_colors.json')]: ConfigColor}
    interface Colors extends CoreColors, PluginColors {}
```

### Constants

Constants (available inside the code from `config.constantName`) can be found in 5 different files:

- `cfg/const.json5` has all the production constants for the core
- `cfg/deployments/$deployment.json5` has all the deployment-specific (fr, usa, uk) constants for the core
- `plugins/$PLUGIN_NAME/cfg/const.json5` has all the production constants for the plugin (no need to create it if you don't have any plugin-specific constants)
- `cfg/deployments/environment/$environment.js` has all the environment-specific (in dev or demo) constants for the core (that should apply for the plugins too)
- `plugins/$PLUGIN_NAME/cfg/deployments/$deployment.js` has all the environment-specific (in dev or demo) constants for the plugin

The constants are added in that order, so if a constant name has different values in different files, the last one in this list will be used.

## Sources

The source files may use components from the core app using aliases: importing from `'components/...'`, or `'images/...'` will look for the described file in the core app.

To import files from the current plugin, you should import using relative path:

```ts
import Foo from './components/foo'
```

## Deployment-specific sources

Some modules may need to be defined differently at the deployment level.
We use the `${pluginName}/src/deployments` folder for them. Here is how it's structured:

```
deployments
    |
    |-- default
    |       |
    |       |- filename.ts   
    |
    |-- ${deploymentName}
    |       |
    |       |- deploment_specific_file_used_in_filename.ts
    |       |- filename.ts   
```

Each module should have at least a default implementation in `default`.

The describing interface for the module (common for all its implementation) must be described in `${pluginName}/custom.d.ts`:
```typescript
declare module 'plugin/deployment/my_module' {
  const CommonInterface: ... // Define common interface...
  export CommonInterface // export as default if relevant to your usage.
}

```

To use the deployment-specific implementation (or the default one if no deployment-specific one is available for the current deployment), you can then `import from 'plugin/deployment/my_module'` in plugin files.


## Typescript

For plugins with typed files, you need to define a tsconfig.json file at the root of your plugin folder.

## String extraction

For translation, you may use the string extraction process already in place in the core app. Define a `i18n.babelrc.js` file at the root of your plugin folder, with the relevant `i18next-extract` plugin. This file must be JS config, not other formats usually allowed by babel.

## Plugin selection

You can choose to use only specific plugins by putting them as a comma separated list in the `BOB_PLUGINS` environment variable.

## Tests

If you have tests for your plugin, that need to be run in a webpack environment, create a `test/loadtests.ts` file in your plugin folder, as a test entry.

To test only some plugins, run `npm run test -- my-plugin my-other-plugin`. To watch tests for a given plugin, run `BOB_PLUGIN_TEST=my-plugin npm run test:watch`.
