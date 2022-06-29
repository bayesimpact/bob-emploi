# Deployments

TODO(cyrille): Hydrate this file.

A deployment is a config to describe what we want for a given version of the product.

Right now, it may override colors, define constants or describe which plugins to use.
To define a deployment, create a file in this folder, either js, json or json5, with the following properties:
- colors (optional): an object with colors to override, in the same format as `../colors.json5`.
- constants: an object with config values, in the same format as `../const.json5`.
    There's no need to re-define the values given in `../const.json5`,
    but you need to add the deployment-specific ones.
- plugins: a list of plugin names (use `core` to include the core plugin).
    If not specified, will assume only the `core` plugin is needed.

To use a specific deployment (say `usa`) in dev mode, you may need to update several environment variables. To do this, you can use `bob-dc` instead of `docker-compose` its first argument is an (optional) deployment name. For instance you may run

```
bob-dc usa up -d frontend-dev
```

If no deployment is specified, it defaults to the `fr` deployment.

All deployments are built nightly, and pushed
as docker image `bayesimpact/bob-emploi-frontend:branch-main-nightly`.
