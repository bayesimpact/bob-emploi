import type {AutocompleteOptions, AutocompleteState} from '@algolia/autocomplete-core'
import {createAutocomplete} from '@algolia/autocomplete-core'
import {getAlgoliaResults} from '@algolia/autocomplete-js'
import type {HighlightResult, Hit} from '@algolia/client-search'
import algoliasearch from 'algoliasearch'
import _memoize from 'lodash/memoize'
import React, {
  useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Trans, useTranslation} from 'react-i18next'

import 'styles/algolia.css'

import algoliaLogoUrl from 'images/algolia.svg'

const ALGOLIA_APP = 'K6ACI9BKKT'
const ALGOLIA_API_KEY = 'da4db0bf437e37d6d49cefcb8768c67a'
const AlgoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)

const HighlightTag = '<b>'

const noListStyle: React.CSSProperties = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}

export interface AlgoliaProps {
  algoliaIndex: string
  // An algolia filter for all the requests to the index.
  filters?: string
}

interface AutocompleteProps<T> extends
  Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'|'value'>, AlgoliaProps {
  // A function to chose the query string to display for a suggestion.
  displayFunc: (item: Hit<T>) => string|undefined
  onChange?: (item: Hit<T>|undefined) => void
  Item: React.ComponentType<Hit<T>>
  value: string
}

export interface Focusable {
  focus: () => void
}

interface AlgoliaItem extends Record<string, unknown> {
  objectID: string
}

type ListItemProps = React.ComponentPropsWithoutRef<'li'>

const getItemProps = (props: ListItemProps): ListItemProps => ({
  className: `aa-suggestion ${props['aria-selected'] ? 'aa-cursor' : ''}`,
  ...props,
})

type OnStateChangeProps<T extends AlgoliaItem> =
  Parameters<Exclude<AutocompleteOptions<T>['onStateChange'], undefined>>[0]

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
const Autocomplete = <T extends unknown>(
  props: AutocompleteProps<T>,
  ref?: React.Ref<Focusable>,
): React.ReactElement => {
  const {
    Item, algoliaIndex, displayFunc, filters, onChange, style, value,
    'aria-labelledby': ariaLabelledBy,
    ...otherProps
  } = props
  const {t} = useTranslation('components')

  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => inputRef.current?.focus(),
  }))

  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState<Hit<T>>|undefined>()
  const handleStateChange = useCallback((autcompleteState: OnStateChangeProps<Hit<T>>) => {
    const {prevState, refresh, setQuery, state} = autcompleteState
    if (prevState.activeItemId !== null && state.activeItemId === null) {
      // Leaving the input.
      const autoSelectedItem = state.collections[0]?.items?.[prevState.activeItemId]
      onChange?.(autoSelectedItem || undefined)
      if (autoSelectedItem) {
        const query = displayFunc(autoSelectedItem)
        if (query && state.query !== query) {
          setQuery(query)
          refresh()
        }
      }
    }
    setAutocompleteState(state)
  }, [displayFunc, onChange])
  const search = useMemo(() => createAutocomplete<
  Hit<T>, React.SyntheticEvent, React.MouseEvent, React.KeyboardEvent>({
    defaultActiveItemId: 0,
    getSources: () => [{
      getItemInputValue: ({item}) => displayFunc(item) || '',
      getItems: ({query}) => getAlgoliaResults({
        queries: [{
          indexName: algoliaIndex,
          params: {
            ...filters && {filters},
            highlightPostTag: HighlightTag,
            highlightPreTag: HighlightTag,
            hitsPerPage: 5,
          },
          query,
        }],
        searchClient: AlgoliaClient,
      }),
      onSelect: ({item}) => {
        onChange?.(item)
      },
      sourceId: 'algolia',
    }],
    onStateChange: handleStateChange,
  }), [algoliaIndex, displayFunc, filters, handleStateChange, onChange])

  useLayoutEffect(() => {
    search.setQuery(value)
  }, [search, value])

  return <div
    className="algolia-autocomplete" {...search.getRootProps({'aria-labelledby': ariaLabelledBy})}>
    <input
      className="aa-input" {...search.getInputProps({inputElement: null})} style={style}
      aria-labelledby={ariaLabelledBy} ref={inputRef} {...otherProps} />
    {autocompleteState?.isOpen && <div className="aa-dropdown-menu" {...search.getPanelProps({})}>
      {autocompleteState?.collections?.map((collection, index) => {
        const {source, items} = collection
        if (!items.length) {
          return null
        }
        return <ul
          {...search.getListProps({'aria-labelledby': ariaLabelledBy})}
          key={`source-${index}`} style={noListStyle}>
          {items.map((item: Hit<T>): React.ReactElement => <li
            key={item.objectID} {...getItemProps(search.getItemProps({item, source}))}>
            <Item {...item} />
          </li>)}
        </ul>
      })}
      <Trans t={t} className="aa-footer" parent="p">
        recherche rapide grâce à <img src={algoliaLogoUrl} alt="Algolia" />
      </Trans>
    </div>}
  </div>
}

export const fetchFromAlgolia = _memoize(
  async <K extends string, T extends {[k in K]?: string}>(
    index: string, field: K, value?: string): Promise<T|undefined> => {
    if (!value) {
      return undefined
    }
    const algoliaIndex = AlgoliaClient.initIndex(index)
    const {hits} = await algoliaIndex.search<T>(value)
    return hits.find((hit): boolean => value === hit[field]) || hits[0]
  },
  (index: string, field: string, value?: string) => `${index}-${field}-${value}`,
)

interface HiglightedTextProps<K extends string> {
  field: K
  value: Hit<{[k in K]?: string}>
}
const HighlightedTextBase = <K extends string>(
  {field, value}: HiglightedTextProps<K>): React.ReactElement => {
  const fieldValue = value[field]
  const highlightResults = value._highlightResult as {[k in K]?: HighlightResult<string>}|undefined
  const highlightResult = highlightResults?.[field]
  if (!highlightResult || highlightResult.matchLevel === 'none') {
    return <React.Fragment>{fieldValue}</React.Fragment>
  }
  const parts = highlightResult.value.split(HighlightTag)
  if (parts.length <= 1) {
    return <React.Fragment>{fieldValue}</React.Fragment>
  }
  return <React.Fragment>
    {parts.map((part, index) => index % 2 ?
      <b key={index}>{part}</b> :
      <React.Fragment key={index}>{part}</React.Fragment>)}
  </React.Fragment>
}

declare module 'react' {
  function memo<T>(c: T): T
  function forwardRef<T, P>(
    render: (props: P, ref: React.Ref<T>) => React.ReactElement | null,
  ): (props: P & React.RefAttributes<T>) => React.ReactElement | null
}

export const HighlightText = React.memo(HighlightedTextBase)


// TODO(pascal): Use Autocomplete in place of the suggestion module.
export default React.memo(React.forwardRef(Autocomplete))
