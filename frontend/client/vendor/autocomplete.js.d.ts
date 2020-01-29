import {Index, QueryParameters} from 'algoliasearch'


declare namespace autocomplete {
  interface CSSClasses {
    readonly root?: string
    readonly prefix?: string
    readonly noPrefix?: boolean
    readonly dropdownMenu?: string
    readonly input?: string
    readonly hint?: string
    readonly suggestions?: string
    readonly suggestion?: string
    readonly cursor?: string
    readonly dataset?: string
    readonly empty?: string
  }


  interface TemplateParam {
    readonly isEmpty: boolean
    readonly query: string
  }


  type Template = string | ((params: TemplateParam) => string)


  interface Templates {
    readonly dropdownMenu?: Template
    readonly header?: Template
    readonly footer?: Template
    readonly empty?: Template
  }


  interface Options {
    readonly ariaLabel?: string
    readonly autoselect?: boolean
    readonly autoselectOnBlur?: boolean
    readonly autoWidth?: boolean
    readonly clearOnSelected?: boolean
    readonly cssClasses?: CSSClasses
    readonly debug?: boolean
    readonly keyboardShortcuts?: readonly string[]
    readonly hint?: boolean
    readonly minLength?: number
    readonly openOnFocus?: boolean
    readonly tabAutocomplete?: boolean
    readonly templates?: Templates
  }


  type Highlighted<T> = T & {_highlightResult: {
    [K in keyof T]: {
      fullyHighlighted: boolean
      matchLevel: 'none' | 'partial' | 'full'
      matchedWords: readonly string[]
      value: string
    }
  }}


  type DatasetSource<T> = (query: string, cb: (suggestions: readonly Highlighted<T>[]) => void) => void


  interface Dataset<T> {
    readonly cache?: boolean
    readonly debounce?: number
    readonly display?: string|((suggestion: Highlighted<T>) => string)
    readonly displayKey?: string|((suggestion: Highlighted<T>) => string)
    readonly name?: string
    readonly source: DatasetSource<T>
    readonly templates?: {
      readonly header?: Template
      readonly footer?: Template
      readonly empty?: Template
      readonly suggestion?: string|((suggestion: Highlighted<T>) => string)
    }
  }


  interface PopularInDetails<T> {
    readonly source: string|((hit: T) => string)
    readonly index: Index
  }


  interface PopularInOptions {
    readonly allTitle?: string
    readonly includeAll?: boolean
  }


  interface Autocompleted extends ZeptoCollection {
    autocomplete: {
      open(): void
      close(): void
      getVal(): string
      setVal(val: string): void
      destroy(): void
      getWrapper(): HTMLElement
    }
  }


  interface AutocompleteStatic {
    <T=any>(selector: string|HTMLElement, options: Options, datasets: readonly Dataset<T>[]): Autocompleted
    <T1=any, T2=any, T3=any>(selector: string|HTMLElement, options: Options, dataset1: Dataset<T1>, dataset2?: Dataset<T2>, dataset3?: Dataset<T3>): Autocompleted

    readonly sources: {
      hits<T=any>(index: Index, params?: QueryParameters): DatasetSource<T>
      popularIn<T=any>(index: Index, params: QueryParameters|undefined, details: PopularInDetails<T>, options?: PopularInOptions): DatasetSource<T>
    }
  }

}

declare const autocomplete: autocomplete.AutocompleteStatic


export = autocomplete
export as namespace autocomplete
