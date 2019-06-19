import Loadable, {LoadableComponent, LoadingComponentProps} from 'react-loadable'

type ComponentTypeIdentity = <T>(a: React.ComponentType<T>) => React.ComponentType<T>

export type LoadableComponentType<T> = LoadableComponent & React.ComponentType<T>

interface LoadableChunk {
  Component: LoadableComponent
  name: string
  priority: number
}

const isDefaultExport = <T>(someExport: T | {default: T}): someExport is {default: T} =>
  (someExport as {default: T}).default !== undefined

// A class to load webpack chunks one after the other. Once the first one is loaded, all of them
// will follow asynchronously, waiting for some delay between two loads.
// Parameters:
//   - delayMillisecs: duration to wait between two loaded chunks, in milliseconds
//   - WaitingComponent: the component to show in place of a component, while its chunk is being
//                       loaded.
class WebpackChunksLoader {
  public constructor(
    delayMillisecs: number, WaitingComponent: React.ComponentType<LoadingComponentProps>) {
    this.chunksToLoad = []
    this.loadedChunks = new Set()
    this.delay = delayMillisecs
    this.WaitingComponent = WaitingComponent
  }

  private chunksToLoad: LoadableChunk[]

  private loadedChunks: Set<string>

  private delay: number

  private WaitingComponent: React.ComponentType<LoadingComponentProps>

  private chunkLoadingTimeout: ReturnType<typeof setTimeout>

  // Adds a chunk to be loaded. A chunk is represented by a name (which must be used as
  //  webpackChunkName in the dynamic import) and a LoadableComponent inside that chunk.
  // This method should be used with extreme care, since it does not enforce the fact that
  //   the callback onChunkLoad will be called.
  // Parameters:
  //   - chunkName: the name of the chunk to be added
  //   - Component: a component, created with react-loadable, which imports the chunk.
  //   - priority: an integer to decide whether this chunk should be asynchronously loaded before
  //     others
  private addOptionalChunk(
    chunkName: string, Component: LoadableComponent, newPriority: number): void {
    if (this.loadedChunks.has(chunkName) ||
      this.chunksToLoad.find(({name}): boolean => name === chunkName)) {
      return
    }
    this.chunksToLoad.splice(
      this.chunksToLoad.findIndex(({priority}): boolean => priority < newPriority), 0, {
        Component,
        name: chunkName,
        priority: newPriority,
      })
  }

  private onChunkLoad = (chunkName: string): ComponentTypeIdentity =>
    <T>(imported: React.ComponentType<T>): React.ComponentType<T> => {
      this.chunksToLoad.splice(
        this.chunksToLoad.findIndex(({name}): boolean => name === chunkName), 1)
      this.loadedChunks.add(chunkName)
      clearTimeout(this.chunkLoadingTimeout)
      if (this.chunksToLoad.length) {
        this.chunkLoadingTimeout = setTimeout(
          (): void => this.chunksToLoad[0] && this.chunksToLoad[0].Component.preload(), this.delay)
      }
      return imported
    }

  // TODO(cyrille): Add a startAsyncLoad() method to start loading all chunks.
  // TODO(cyrille): Drop possiblity to load non-default module.
  // Creates a loadable component and adds its chunk to the list to be asynchronously loaded.
  // Chunks will only be loaded once a first Component is invoked.
  // Parameters:
  //   - loader: the dynamic importer for this component, ie a parameterless function that returns
  //     a promise for a component, or for a module whose default is a component
  //   - chunkName: the name of the webpack chunk where the dynamic import is bundled
  //   - priority: a positive integer to decide whether this chunk should be asynchronously loaded
  //     before others, the larger the earlier (priority 0 will be loaded last)
  public createLoadableComponent = <PropsType>(
    loader: () => Promise<React.ComponentType<PropsType>|{default: React.ComponentType<PropsType>}>,
    chunkName: string, priority: number): LoadableComponentType<PropsType> => {
    const Component = Loadable({
      loader: (): Promise<React.ComponentType<PropsType>> => loader().
        then((module): React.ComponentType<PropsType> => {
          if (isDefaultExport(module)) {
            return module.default
          }
          return module
        }).
        then(this.onChunkLoad(chunkName)),
      loading: this.WaitingComponent,
    })
    this.addOptionalChunk(chunkName, Component, priority)
    return Component
  }
}


export {WebpackChunksLoader}
