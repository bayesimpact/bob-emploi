import type {TFunction} from 'i18next'
import _keyBy from 'lodash/keyBy'
import _pick from 'lodash/pick'
import _sortBy from 'lodash/sortBy'
import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import ReactDragList from 'react-drag-list'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import type {InputActionMeta} from 'react-select'
import ReactSelect from 'react-select'
import {Link} from 'react-router-dom'

import {useAsynceffect, useSafeDispatch} from 'store/promise'

import Button from 'components/button'
import CircularProgress from 'components/circular_progress'
import GrowingNumber from 'components/growing_number'
import Input from 'components/input'
import UpDownIcon from 'components/up_down_icon'

import {EVAL_PAGE} from '../routes'

import type {DispatchAllEvalActions, EvalRootState} from '../store/actions'
import {getEvalFiltersUseCases, getUseCaseDistribution} from '../store/actions'
import {getUseCaseTitle} from '../store/eval'


const emptyArray = [] as const
const getName = ({name}: {name: string}): string => name



interface SelectOption<T> {
  name: string
  value: T
}


const UseCaseSelectorBase = (): React.ReactElement => {
  const isFetching = useSelector(
    ({asyncState: {isFetching}}: EvalRootState): boolean =>
      !!isFetching['GET_EVAL_FILTERS_USE_CASES'],
  )
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const {t} = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [filters, setFilters] = useState<readonly string[]>([])
  const [useCases, setUseCases] = useState<readonly bayes.bob.UseCase[]>([])

  const onInputChange = useCallback((newInputValue: string, {action}: InputActionMeta): void => {
    if (action !== 'input-blur' && newInputValue && !newInputValue.endsWith(' ')) {
      setInputValue(newInputValue)
      return
    }
    setInputValue('')
    const filter = inputValue.trim() || inputValue
    if (filter && !filters.includes(filter)) {
      setFilters([...filters, filter])
    }
  }, [inputValue, filters])

  const onClick = useCallback(async (): Promise<void> => {
    const useCases = await dispatch(getEvalFiltersUseCases(filters))
    if (useCases) {
      setUseCases(useCases)
    }
  }, [dispatch, filters])

  const options = useMemo(
    (): readonly SelectOption<string>[] =>
      filters.map((value: string): SelectOption<string> => ({name: value, value})),
    [filters],
  )

  const handleChange = useCallback(
    (options?: SelectOption<string>|readonly SelectOption<string>[]|null): void => {
      setFilters(((options || []) as readonly SelectOption<string>[]).map(({value}) => value))
    }, [])

  // TODO(cyrille): Maybe get a list of filter suggestions from server.
  // TODO(cyrille): Warn if we don't get any use case from server.
  return <div style={{maxWidth: 600, padding: 20}}>
    <ReactSelect
      onInputChange={onInputChange}
      options={options}
      getOptionLabel={getName}
      isMulti={true} value={options} inputValue={inputValue} menuIsOpen={false}
      onChange={handleChange} />
    <Button style={{margin: 20}} type="validation" onClick={onClick}>
      Trouver des cas d'usage
    </Button>
    {isFetching ? <CircularProgress /> : <ul>
      {useCases.map(({useCaseId, poolName, title, userData}): React.ReactNode =>
        <li key={useCaseId} ><Link
          target="_blank" to={`${EVAL_PAGE}/${poolName}/${useCaseId}`}>
          {getUseCaseTitle(t, title, userData)}
        </Link></li>)}
    </ul>}
  </div>
}
const UseCaseSelector = React.memo(UseCaseSelectorBase)


const filterElementStyle: React.CSSProperties = {
  backgroundColor: colors.MODAL_PROJECT_GREY,
  borderRadius: 2,
  margin: 2,
  padding: '2px 5px',
  whiteSpace: 'nowrap',
} as const
const changeStyle = (change: 'added'|'removed'|''): React.CSSProperties => ({
  color: change === 'removed' ? colors.GREENISH_TEAL : colors.RED_PINK,
  cursor: 'pointer',
  fontWeight: 'bold',
  padding: '0 .2em',
  textDecoration: 'none',
})


interface FilterDiff {
  change: 'added' | 'removed' | ''
  filter: string
}


interface FilterProps extends FilterDiff {
  onChange: (filter: string, shouldRemove: boolean) => void
}


const FilterBase = (props: FilterProps): React.ReactElement => {
  const {change, filter, onChange} = props
  const handleFilterChange = useCallback((): void => {
    onChange(filter, change !== 'removed')
  }, [change, filter, onChange])
  const filterStyle = (change: 'added'|'removed'|''): React.CSSProperties => ({
    color: change === 'added' ? colors.GREENISH_TEAL : 'initial',
    textDecoration: change === 'removed' ? 'line-through' : 'initial',
  })
  return <div style={filterElementStyle}>
    <span style={filterStyle(change)}>{filter}</span>
    <button
      onClick={handleFilterChange}
      style={changeStyle(change)}
      type="button">
      {change === 'removed' ? '+' : '-'}
    </button>
  </div>
}
const Filter = React.memo(FilterBase)


interface FiltersProps {
  children: readonly string[]
  initial: readonly string[]
  onChange: (filters: readonly string[]) => void
}


function makeFiltersState(
  children: readonly string[] = [], initial: readonly string[] = []): readonly FilterDiff[] {
  const childrenSet = new Set(children)
  const initialSet = new Set(initial)
  const filters = initial.map(
    (filter: string): FilterDiff => ({change: childrenSet.has(filter) ? '' : 'removed', filter}))
  for (const filter of children) {
    if (!initialSet.has(filter)) {
      filters.push({change: 'added', filter})
    }
  }
  return filters
}


const FiltersBase = (props: FiltersProps): React.ReactElement => {
  const {children, initial, onChange} = props
  const [filters, setFilters] = useState(
    (): readonly FilterDiff[] => makeFiltersState(children, initial),
  )
  const [hasInput, setHasInput] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const changeFilters = useCallback((newFilters: readonly FilterDiff[]): void => {
    setFilters(newFilters)
    const validFilters = newFilters.
      filter(({change}): boolean => !change || change === 'added').
      map(({filter}): string => filter)
    onChange?.(validFilters)
  }, [onChange])

  const addFilter = useCallback((event?: React.FormEvent): void => {
    event?.preventDefault?.()
    if (!inputValue) {
      return
    }
    setHasInput(false)
    setInputValue('')
    changeFilters([...filters, {change: 'added', filter: inputValue}])
  }, [changeFilters, filters, inputValue])

  const handleInputChange = useCallback(
    ({currentTarget: {value}}: React.ChangeEvent<HTMLInputElement>): void =>
      value.endsWith(' ') ? addFilter() : setInputValue(value),
    [addFilter],
  )

  const handleFilterChange = useCallback((filter: string, shouldRemove: boolean): void => {
    const initialSet = new Set(initial)
    changeFilters(filters.
      map((filterState: FilterDiff): FilterDiff =>
        filterState.filter === filter ? {
          change: shouldRemove ? 'removed' : initialSet.has(filter) ? '' : 'added',
          filter,
        } : filterState))
  }, [filters, initial, changeFilters])

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect((): void => {
    if (hasInput) {
      inputRef.current?.focus()
    }
  }, [hasInput])

  const toggleInput = useCallback(
    (): void => setHasInput((hasInput: boolean): boolean => !hasInput),
    [],
  )

  return <React.Fragment>
    {filters.map(({change, filter}): React.ReactNode =>
      <Filter key={filter} filter={filter} change={change} onChange={handleFilterChange} />)}
    {hasInput ? <form onSubmit={addFilter}>
      <input
        value={inputValue} onBlur={toggleInput} onChange={handleInputChange} ref={inputRef} />
    </form> :
      <button onClick={toggleInput} style={filterElementStyle} type="button">
        <span style={changeStyle('removed')}>+</span>
      </button>}
  </React.Fragment>
}
const Filters = React.memo(FiltersBase)


interface BobThinkStatsProps {
  categoryId?: string
  count?: number
  examples?: readonly bayes.bob.UseCase[]
  filters?: readonly string[]
  initial?: MainChallenge
  isEmptyThink?: boolean
  onChange?: (mainChallengeChanges: Partial<MainChallenge>) => void
  order?: number
  style?: React.CSSProperties
  t: TFunction
  totalCount?: number
}


const bobThinkStatsDefaultElementStyle = {
  flexShrink: 0,
  marginRight: 10,
}
const filtersContainerStyle: React.CSSProperties = {
  ...bobThinkStatsDefaultElementStyle,
  display: 'inline-flex',
  flex: 1,
  flexWrap: 'wrap',
  overflow: 'hidden',
}
const useCasesSpanStyle: React.CSSProperties = {
  ...bobThinkStatsDefaultElementStyle,
  display: 'inline-block',
  marginLeft: '1.4em',
  position: 'relative',
  zIndex: 0,
}
const useCasesContainerStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 5,
  boxShadow: '0 10px 30px rgba(0, 0, 0, .2)',
  display: 'block',
  left: '50%',
  overflow: 'hidden',
  padding: 10,
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%,-50%)',
  zIndex: 1,
}
const orderContainerStyle: React.CSSProperties = {
  ...bobThinkStatsDefaultElementStyle,
  marginLeft: 10,
  width: '3em',
}
const categoryIdStyle: React.CSSProperties = {
  ...bobThinkStatsDefaultElementStyle,
  width: '10em',
}
const percentageContainerStyle: React.CSSProperties = {
  ...bobThinkStatsDefaultElementStyle,
  fontWeight: 'bold',
}
const noUseCasesStyle: React.CSSProperties = {
  ...bobThinkStatsDefaultElementStyle,
  color: colors.RED_PINK,
}


const BobThinkStatsBase = (props: BobThinkStatsProps): React.ReactElement => {
  const {categoryId, count = 0, filters = [], initial = {}, isEmptyThink, onChange, order, style,
    t, totalCount, examples = []} = props
  const [areUseCasesShown, setAreUseCasesShown] = useState(false)

  const handleChangeFilters = useCallback(
    (filters: readonly string[]): void => onChange && onChange({filters}),
    [onChange],
  )

  const showUseCases = useCallback(() => setAreUseCasesShown(true), [])
  const hideUseCases = useCallback(() => setAreUseCasesShown(false), [])

  const tooltipId = useMemo(_uniqueId, [])

  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const [shouldFocusOnFirstLink, setShouldFocusOnFirstLink] = useState(false)
  const handleUseCasesFocus = useCallback((): void => {
    setAreUseCasesShown(true)
    setShouldFocusOnFirstLink(true)
  }, [])
  const stopFocusBubbling = useCallback((event: React.FocusEvent): void => {
    event.stopPropagation()
  }, [])
  useEffect((): void => {
    if (areUseCasesShown && shouldFocusOnFirstLink) {
      firstLinkRef.current?.focus?.()
      setShouldFocusOnFirstLink(false)
    }
  }, [areUseCasesShown, shouldFocusOnFirstLink])
  const useCasesRef = useRef<HTMLSpanElement>(null)
  const [isLeavingLink, setIsLeavingLink] = useState(false)
  const handleLinkBlur = useCallback((): void => setIsLeavingLink(true), [])
  useEffect((): (() => void) => {
    if (!isLeavingLink) {
      return () => void 0
    }
    const timeout = window.setTimeout((): void => {
      setIsLeavingLink(false)
      if (areUseCasesShown && !useCasesRef.current?.contains?.(document.activeElement)) {
        setAreUseCasesShown(false)
      }
    }, 0)
    return (): void => window.clearTimeout(timeout)
  }, [areUseCasesShown, isLeavingLink])

  const {
    count: initialCount = 0,
    filters: initialFilters = emptyArray,
    order: initialOrder,
    totalCount: initialTotal,
  } = initial
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    border: `1px solid ${colors.MODAL_PROJECT_GREY}`,
    display: 'flex',
    padding: 5,
    ...style,
  }), [style])
  const mainChallengePercentage = Math.round(100 * count / (totalCount || 1))
  // TODO(cyrille): Make a better UI involving table.
  return <div style={containerStyle}>
    <span style={orderContainerStyle}>
      {isEmptyThink ? null :
        <ComparedValue old={initialOrder} value={order || 0}>{order}</ComparedValue>}
    </span>
    <span style={categoryIdStyle}>
      {categoryId}
    </span>
    <span style={filtersContainerStyle}>
      {isEmptyThink ? null :
        <Filters initial={initialFilters} onChange={handleChangeFilters}>
          {filters}
        </Filters>}
    </span>
    <span style={percentageContainerStyle}>
      <ComparedValue
        old={Math.round(100 * initialCount / (initialTotal || 1))}
        value={mainChallengePercentage} isHigherUp={true}>
        <GrowingNumber number={mainChallengePercentage} />%
      </ComparedValue>
    </span>
    {examples.length ?
      // Interactivity is handled specifically to show the tooltip: no real interactions on this
      // element.
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <span
        onMouseEnter={showUseCases}
        onMouseLeave={hideUseCases}
        onFocus={handleUseCasesFocus}
        style={useCasesSpanStyle}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-describedby={tooltipId}
        ref={useCasesRef}>
        Use Cases
        {areUseCasesShown ? <div style={useCasesContainerStyle} id={tooltipId}>
          {examples.map(({useCaseId, poolName, title, userData}, index): React.ReactNode =>
            <div key={useCaseId} style={{margin: 5}} ><Link
              ref={index ? undefined : firstLinkRef}
              style={{whiteSpace: 'nowrap'}}
              onBlur={handleLinkBlur}
              onFocus={stopFocusBubbling}
              target="_blank" to={`${EVAL_PAGE}/${poolName}/${useCaseId}`}>
              {getUseCaseTitle(t, title, userData)}
            </Link></div>)}
        </div> : null}
      </span> :
      <span style={noUseCasesStyle}>
        No Use Cases
      </span>}
  </div>
}
const BobThinkStats = React.memo(BobThinkStatsBase)


interface ComparedValueProps {
  children?: React.ReactNode
  isHigherUp?: boolean
  old?: number
  value: number
}


const ComparedValueBase = (props: ComparedValueProps): React.ReactElement => {
  const {children, isHigherUp, old, value} = props
  const isNew = typeof old === 'undefined'
  const isUp = isHigherUp ? value > (old || 0) : value < (old || 0)
  const color = isUp ? colors.GREENISH_TEAL : colors.RED_PINK
  return <div style={{alignItems: 'center', display: 'flex'}}>
    {children}
    {isNew || old === value ? null :
      <UpDownIcon style={{color}} icon="menu" isUp={isUp} />}
  </div>
}
const ComparedValue = React.memo(ComparedValueBase)


interface MainChallenge extends bayes.bob.DiagnosticMainChallenge {
  count?: number
  totalCount?: number
}


const makeSendableMainChallenge =
  (mainChallenge: ValidMainChallenge): bayes.bob.DiagnosticMainChallenge =>
    _pick(mainChallenge, ['categoryId', 'filters', 'order'])


interface ValidMainChallenge extends MainChallenge {
  categoryId: string
}


function hasCategoryId(c?: MainChallenge): c is ValidMainChallenge {
  return !!(c && c.categoryId)
}


interface BobThinkStatsIndexedProps extends Omit<BobThinkStatsProps, 'onChange'> {
  onChange: (index: number, change: Partial<ValidMainChallenge>) => void
  index: number
}


const BobThinkStatsIndexedBase = (props: BobThinkStatsIndexedProps): React.ReactElement => {
  const {index, onChange, ...extraProps} = props
  const handleChange = useCallback(
    (change: Partial<ValidMainChallenge>): void => onChange(index, change),
    [index, onChange],
  )
  return <BobThinkStats {...extraProps} onChange={handleChange} />
}
const BobThinkStatsIndexed = React.memo(BobThinkStatsIndexedBase)


interface MainChallengesDistributionProps {
  style: React.CSSProperties
}


const MainChallengesDistributionBase = (props: MainChallengesDistributionProps):
React.ReactElement|null => {
  const isFetchingDistribution = useSelector(
    ({asyncState: {isFetching}}: EvalRootState): boolean =>
      !!isFetching['GET_USE_CASE_DISTRIBUTION'],
  )
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const {t} = useTranslation()

  const [maxCount, setMaxCount] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [mainChallenges, setMainChallenges] = useState<readonly ValidMainChallenge[]>([])
  const [{mainChallenges: initialMainChallenges, missing: initialMissing}, setInitial] =
    useState<{mainChallenges: {[categoryId: string]: ValidMainChallenge}; missing?: MainChallenge}>(
      {mainChallenges: {}},
    )
  const [missingUseCases, setMissingUseCases] = useState({})
  const [newMainChallenge, setNewMainChallenge] = useState('')

  const safeComputeDistribution = useCallback(async (isInitial?: boolean) => {
    const sendableMainChallenges = mainChallenges.map(makeSendableMainChallenge)
    const response = await dispatch(getUseCaseDistribution(sendableMainChallenges, maxCount))
    if (!response) {
      return
    }
    const {categories: fetchedMainChallenges = [], distribution = {}, missingUseCases = {},
      totalCount = 0} = response
    const newMainChallenges = _sortBy(
      (isInitial ? fetchedMainChallenges : mainChallenges).filter(hasCategoryId),
      'order',
    ).map(({categoryId, ...mainChallenge}, index) => ({
      categoryId,
      ...mainChallenge,
      ...distribution[categoryId],
      order: index + 1,
      totalCount,
    }))
    return {
      distribution,
      ...isInitial ? {initial: {
        mainChallenges: _keyBy(newMainChallenges, 'categoryId'),
        missing: {...missingUseCases, totalCount},
      }} : {},
      mainChallenges: newMainChallenges,
      missingUseCases,
      totalCount,
    }
  }, [mainChallenges, dispatch, maxCount])

  const hasMainChallenges = !!mainChallenges.length
  useAsynceffect(async (checkIfCanceled) => {
    if (hasMainChallenges) {
      return
    }
    const response = await safeComputeDistribution(true)
    if (checkIfCanceled() || !response) {
      return
    }
    const {mainChallenges, initial, totalCount} = response
    setMainChallenges(mainChallenges)
    if (initial) {
      setInitial(initial)
    }
    setMaxCount(totalCount)
    setTotalCount(totalCount)
  }, [safeComputeDistribution, hasMainChallenges])

  const recompute = useCallback(async (event?: React.FormEvent): Promise<void> => {
    event && event.preventDefault && event.preventDefault()
    const useCaseDistribution = await safeComputeDistribution()
    if (!useCaseDistribution) {
      return
    }
    const {mainChallenges, missingUseCases = {}, totalCount = 0} = useCaseDistribution
    setMainChallenges(mainChallenges)
    setTotalCount(totalCount)
    setMissingUseCases(missingUseCases)
  }, [safeComputeDistribution])

  const addMainChallenge = useCallback((event?: React.SyntheticEvent): void => {
    event && event.preventDefault && event.preventDefault()
    if (!newMainChallenge) {
      return
    }
    setMainChallenges([
      ...mainChallenges, {
        categoryId: newMainChallenge,
        filters: [],
        order: mainChallenges.length + 1,
        totalCount,
      }])
    setNewMainChallenge('')
  }, [mainChallenges, newMainChallenge, totalCount])

  const handleMainChallengeChange = useCallback(
    (changedIndex: number, change: Partial<MainChallenge>): void => {
      setMainChallenges(
        mainChallenges.map((mainChallenge, index): ValidMainChallenge => index === changedIndex ? {
          ...mainChallenge,
          ...change,
        } : mainChallenge))
    },
    [mainChallenges],
  )

  const handleDrag = useCallback(
    (unusedEvent: unknown, mainChallenges: readonly object[]): void => {
      setMainChallenges((mainChallenges as readonly ValidMainChallenge[]).
        map((mainChallenge: ValidMainChallenge, index: number): ValidMainChallenge =>
          ({...mainChallenge, order: index + 1})))
    }, [])

  const handleMaxCountChange = useCallback(
    (maxCountString: string): void => setMaxCount(Number.parseInt(maxCountString || '0')),
    [],
  )

  const renderStats = useCallback((row: object, index: number): React.ReactElement => {
    const mainChallenge = row as ValidMainChallenge
    return <BobThinkStatsIndexed
      style={{backgroundColor: '#fff'}} onChange={handleMainChallengeChange} index={index}
      initial={initialMainChallenges[mainChallenge.categoryId]} t={t} {...mainChallenge} />
  }, [handleMainChallengeChange, initialMainChallenges, t])

  const mutableMainChallenges =
    useMemo((): ValidMainChallenge[] => [...mainChallenges], [mainChallenges])

  const {style} = props
  if (isFetchingDistribution) {
    return <CircularProgress />
  }
  if (!totalCount) {
    return null
  }
  return <div style={{padding: 10, ...style}}>
    {/* TODO(pascal): Fix ReactDragList so that it does not modify its props! */}
    <ReactDragList
      dataSource={mutableMainChallenges}
      handles={false}
      rowKey="categoryId"
      row={renderStats}
      onUpdate={handleDrag} />
    <BobThinkStats
      {...{...missingUseCases, totalCount}} initial={initialMissing} isEmptyThink={true}
      categoryId="In need of a main challenge" t={t} />
    <form onSubmit={addMainChallenge} style={{alignItems: 'center', display: 'flex'}}>
      <Input
        placeholder="Nouvelle catégorie" value={newMainChallenge}
        style={{backgroundColor: '#fff', maxWidth: 220}}
        onChange={setNewMainChallenge} name="category" />
      <Button
        disabled={!newMainChallenge} onClick={addMainChallenge}
        type="navigation" style={{margin: 20}}>
        Ajouter
      </Button>
    </form>
    <form onSubmit={recompute}>
      Nombre de cas à évaluer
      <Input
        style={{margin: '0 10px 0', width: 50}} type="number"
        value={maxCount.toString()}
        onChange={handleMaxCountChange} name="number" />
      <Button
        onClick={recompute} type="validation" style={{marginTop: 20}} disabled={!maxCount}>
        Recalculer</Button>
    </form>
  </div>
}
const MainChallengesDistribution = React.memo(MainChallengesDistributionBase)


export {MainChallengesDistribution, UseCaseSelector}
