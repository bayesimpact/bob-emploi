import {expect} from 'chai'
import _groupBy from 'lodash/groupBy'
import _mapValues from 'lodash/mapValues'
import getAllPlugins from '../../cfg/plugins'

describe('entrypoints', () => {
  it('does not redefine an entrypoint by name', async () => {
    const plugins = await getAllPlugins()
    const pluginPerEntrypoint: Record<string, readonly string[]> = _mapValues(_groupBy(
      plugins.flatMap(({entrypoints, name}) =>
        Object.keys(entrypoints).map((entrypoint) => [entrypoint, name])),
      '0',
    ), entrypointAndNames => entrypointAndNames.map(([unusedEntrypoint, name]) => name))
    for (const [entrypoint, pluginNames] of Object.entries(pluginPerEntrypoint)) {
      expect(pluginNames, `${entrypoint} is defined in those ${pluginNames}`).to.have.length(1)
    }
  })
})
