import Loadable from 'react-loadable'

// A class to load webpack chunks one after the other. Once the first one is loaded, all of them
// will follow asynchronously, waiting for some delay between two loads.
// Parameters:
//   - delayMillisecs: duration to wait between two loaded chunks, in milliseconds
//   - WaitingComponent: the component to show in place of a component, while its chunk is being
//                       loaded.
class WebpackChunksLoader {
  constructor(delayMillisecs, WaitingComponent) {
    this.chunksToLoad = []
    this.loadedChunks = new Set()
    this._delay = delayMillisecs
    this._WaitingComponent = WaitingComponent
  }

  // Adds a chunk to be loaded. A chunk is represented by a name (which must be used as
  //  webpackChunkName in the dynamic import) and a LoadableComponent inside that chunk.
  // This method should be used with extreme care, since it does not enforce the fact that
  //   the callback onChunkLoad will be called.
  // Parameters:
  //   - chunkName: the name of the chunk to be added
  //   - Component: a component, created with react-loadable, which imports the chunk.
  //   - priority: an integer to decide whether this chunk should be asynchronously loaded before
  //     others
  _addOptionalChunk(chunkName, Component, newPriority) {
    if (this.loadedChunks.has(chunkName) ||
      this.chunksToLoad.find(({name}) => name === chunkName)) {
      return
    }
    this.chunksToLoad.splice(
      this.chunksToLoad.findIndex(({priority}) => priority < newPriority), 0, {
        Component,
        name: chunkName,
        priority: newPriority,
      })
  }

  _onChunkLoad = chunkName => imported => {
    this.chunksToLoad.splice(this.chunksToLoad.findIndex(({name}) => name === chunkName), 1)
    this.loadedChunks.add(chunkName)
    clearTimeout(this.chunkLoadingTimeout)
    if (this.chunksToLoad.length) {
      this.chunkLoadingTimeout = setTimeout(
        () => this.chunksToLoad[0] && this.chunksToLoad[0].Component.preload(), this._delay)
    }
    return imported
  }

  // TODO(cyrille): Add a startAsyncLoad() method to start loading all chunks.
  // Creates a loadable component and adds its chunk to the list to be asynchronously loaded.
  // Chunks will only be loaded once a first Component is invoked.
  // Parameters:
  //   - loader: the dynamic importer for this component, ie a parameterless function that returns
  //     a promise for a component, or a module whose default is a component (see
  //     shouldAvoidLoadingFromDefault)
  //   - chunkName: the name of the webpack chunk where the dynamic import is bundled
  //   - priority: a positive integer to decide whether this chunk should be asynchronously loaded
  //     before others, the larger the earlier (priority 0 will be loaded last)
  //   - shouldAvoidLoadingFromDefault: a flag to set to true if the given loader returns the
  //     component itself, not a module.
  createLoadableComponent = (loader, chunkName, priority, shouldAvoidLoadingFromDefault) => {
    const Component = Loadable({
      loader: () => loader().
        then(shouldAvoidLoadingFromDefault ?
          (Component => Component) :
          (({default: Component}) => Component)
        ).
        then(this._onChunkLoad(chunkName)),
      loading: this._WaitingComponent,
    })
    this._addOptionalChunk(chunkName, Component, priority)
    return Component
  }
}


export {WebpackChunksLoader}
