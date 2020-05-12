import {TFunction} from 'i18next'
import _keyBy from 'lodash/keyBy'
import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import ReactDragList from 'react-drag-list'
import {useTranslation} from 'react-i18next'
import {connect, useSelector} from 'react-redux'
import {InputActionMeta} from 'react-select'
import {Link} from 'react-router-dom'

import {DispatchAllEvalActions, EvalRootState, getEvalFiltersUseCases,
  getUseCaseDistribution} from 'store/actions'
import {getUseCaseTitle} from 'store/eval'
import {useSafeDispatch} from 'store/promise'

import {Button, CircularProgress, Input, GrowingNumber, UpDownIcon} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {Routes} from 'components/url'


const emptyArray = [] as const


interface SelectorProps {
  dispatch: DispatchAllEvalActions
  isFetching: boolean
  t: TFunction
}


interface SelectOption<T> {
  name: string
  value: T
}


const UseCaseSelectorBase = (props: SelectorProps): React.ReactElement => {
  const {dispatch, isFetching, t} = props
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

  const onClick = useCallback((): void => {
    dispatch(getEvalFiltersUseCases(filters)).
      then((response): void => {
        if (response) {
          setUseCases(response)
        }
      })
  }, [dispatch, filters])

  const options = useMemo(
    (): readonly SelectOption<string>[] =>
      filters.map((value: string): SelectOption<string> => ({name: value, value})),
    [filters],
  )

  // TODO(cyrille): Maybe get a list of filter suggestions from server.
  // TODO(cyrille): Warn if we don't get any use case from server.
  return <div style={{maxWidth: 600, padding: 20}}>
    <Select<string>
      onInputChange={onInputChange}
      options={options}
      isMulti={true} value={filters} autoFocus={true} inputValue={inputValue} menuIsOpen={false}
      onChange={setFilters} />
    <Button style={{margin: 20}} type="validation" onClick={onClick}>
      Trouver des cas d'usage
    </Button>
    {isFetching ? <CircularProgress /> : <ul>
      {useCases.map(({useCaseId, poolName, title, userData}): React.ReactNode =>
        <li key={useCaseId} ><Link
          target="_blank" to={`${Routes.EVAL_PAGE}/${useCaseId}?poolName=${poolName}`}>
          {getUseCaseTitle(t, title, userData)}
        </Link></li>)}
    </ul>}
  </div>
}
UseCaseSelectorBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  isFetching: PropTypes.bool,
  t: PropTypes.func.isRequired,
}
const UseCaseSelector = connect(
  (
    {asyncState: {isFetching: {GET_EVAL_FILTERS_USE_CASES: isFetching = false}}}: EvalRootState,
  ): {isFetching: boolean} => ({isFetching}))(React.memo(UseCaseSelectorBase))


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
    <span
      onClick={handleFilterChange}
      style={changeStyle(change)}>
      {change === 'removed' ? '+' : '-'}
    </span>
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
  children.forEach((filter): void => {
    if (!initialSet.has(filter)) {
      filters.push({change: 'added', filter})
    }
  })
  return filters
}


const FiltersBase = (props: FiltersProps): React.ReactElement => {
  const {children, initial, onChange} = props
  const [filters, setFilters] = useState(
    (): readonly FilterDiff[] => makeFiltersState(children, initial),
  )
  const [hasInput, setHasInput] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const validFilters = useMemo(
    (): readonly string[] => filters.
      filter(({change}): boolean => !change || change === 'added').
      map(({filter}): string => filter),
    [filters],
  )

  const addFilter = useCallback((): void => {
    if (!inputValue) {
      return
    }
    setFilters((filters: readonly FilterDiff[]): readonly FilterDiff[] =>
      [...filters, {change: 'added', filter: inputValue}])
    setHasInput(false)
    setInputValue('')
  }, [inputValue])

  useEffect((): void => onChange?.(validFilters), [onChange, validFilters])

  const handleInputChange = useCallback(
    ({currentTarget: {value}}: React.ChangeEvent<HTMLInputElement>): void =>
      value.endsWith(' ') ? addFilter() : setInputValue(value),
    [addFilter],
  )

  const handleFilterChange = useCallback((filter: string, shouldRemove: boolean): void => {
    const initialSet = new Set(initial)
    setFilters((filters: readonly FilterDiff[]): readonly FilterDiff[] => filters.
      map((filterState: FilterDiff): FilterDiff =>
        filterState.filter === filter ? {
          change: shouldRemove ? 'removed' : initialSet.has(filter) ? '' : 'added',
          filter,
        } : filterState),
    )
  }, [initial])

  const toggleInput = useCallback(
    (): void => setHasInput((hasInput: boolean): boolean => !hasInput),
    [],
  )

  return <React.Fragment>
    {filters.map(({change, filter}): React.ReactNode =>
      <Filter key={filter} filter={filter} change={change} onChange={handleFilterChange} />)}
    {hasInput ? <form onSubmit={addFilter}>
      <input
        value={inputValue} onBlur={toggleInput}
        onChange={handleInputChange} />
    </form> :
      <div
        onClick={toggleInput}
        style={filterElementStyle}><span style={changeStyle('removed')}>+</span></div>}
  </React.Fragment>
}
FiltersBase.propTypes = {
  children: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  initial: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  onChange: PropTypes.func,
}
const Filters = React.memo(FiltersBase)


interface BobThinkStatsProps {
  categoryId?: string
  count?: number
  examples?: readonly bayes.bob.UseCase[]
  filters?: readonly string[]
  initial?: Category
  isEmptyThink?: boolean
  onChange?: (categoryChanges: Partial<Category>) => void
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
  const categoryPercentage = Math.round(100 * count / (totalCount || 1))
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
        value={categoryPercentage} isHigherUp={true}>
        <GrowingNumber number={categoryPercentage} />%
      </ComparedValue>
    </span>
    {examples.length ? <span
      onMouseEnter={showUseCases}
      onMouseLeave={hideUseCases}
      style={useCasesSpanStyle}>
      Use Cases
      {areUseCasesShown ? <div style={useCasesContainerStyle}>
        {examples.map(({useCaseId, poolName, title, userData}): React.ReactNode =>
          <div key={useCaseId} style={{margin: 5}} ><Link
            style={{whiteSpace: 'nowrap'}}
            target="_blank" to={`${Routes.EVAL_PAGE}/${useCaseId}?poolName=${poolName}`}>
            {getUseCaseTitle(t, title, userData)}
          </Link></div>)}
      </div> : null}
    </span> :
      <span style={noUseCasesStyle}>
        No Use Cases
      </span>}
  </div>
}
BobThinkStatsBase.propTypes = {
  categoryId: PropTypes.string.isRequired,
  count: PropTypes.number,
  examples: PropTypes.arrayOf(PropTypes.shape({
    useCaseId: PropTypes.string.isRequired,
  }).isRequired),
  filters: PropTypes.arrayOf(PropTypes.string.isRequired),
  // TODO(cyrille): Add other fields once we compare them.
  initial: PropTypes.shape({
    count: PropTypes.number.isRequired,
    filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    order: PropTypes.number,
    totalCount: PropTypes.number.isRequired,
  }),
  isEmptyThink: PropTypes.bool,
  onChange: PropTypes.func,
  order: PropTypes.number,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
  totalCount: PropTypes.number.isRequired,
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
ComparedValueBase.propTypes = {
  children: PropTypes.node,
  isHigherUp: PropTypes.bool,
  old: PropTypes.number,
  value: PropTypes.number.isRequired,
}
const ComparedValue = React.memo(ComparedValueBase)


interface Category extends bayes.bob.DiagnosticCategory {
  count?: number
  totalCount?: number
}


const makeSendableCategory = (category: ValidCategory): bayes.bob.DiagnosticCategory =>
  _pick(category, ['categoryId', 'filters', 'order'])


interface ValidCategory extends Category {
  categoryId: string
}


function hasCategoryId(c?: Category): c is ValidCategory {
  return !!(c && c.categoryId)
}


interface BobThinkStatsIndexedProps extends Omit<BobThinkStatsProps, 'onChange'> {
  onChange: (index: number, change: Partial<ValidCategory>) => void
  index: number
}


const BobThinkStatsIndexedBase = (props: BobThinkStatsIndexedProps): React.ReactElement => {
  const {index, onChange, ...extraProps} = props
  const handleChange = useCallback(
    (change: Partial<ValidCategory>): void => onChange(index, change),
    [index, onChange],
  )
  return <BobThinkStats {...extraProps} onChange={handleChange} />
}
const BobThinkStatsIndexed = React.memo(BobThinkStatsIndexedBase)


interface CategoriesDistributionProps {
  style: React.CSSProperties
}


const CategoriesDistributionBase = (props: CategoriesDistributionProps):
React.ReactElement|null => {
  const isFetchingDistribution = useSelector(
    ({asyncState: {isFetching}}: EvalRootState): boolean =>
      !!isFetching['GET_USE_CASE_DISTRIBUTION'],
  )
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const {t} = useTranslation()

  const [maxCount, setMaxCount] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [categories, setCategories] = useState<readonly ValidCategory[]>([])
  const [{categories: initialCategories, missing: initialMissing}, setInitial] =
    useState<{categories: {[categoryId: string]: ValidCategory}; missing?: Category}>(
      {categories: {}},
    )
  const [missingUseCases, setMissingUseCases] = useState({})
  const [newCategory, setNewCategory] = useState('')
  const sendableCategories = useMemo(
    (): readonly bayes.bob.DiagnosticCategory[] => categories.map(makeSendableCategory),
    [categories],
  )

  const hasCategories = !!categories.length
  useEffect((): void => {
    if (isFetchingDistribution && !hasCategories) {
      return
    }
    dispatch(getUseCaseDistribution([], maxCount)).then(
      (response): void => {
        if (!response) {
          return
        }
        const {categories = [], distribution = {}, missingUseCases = {}, totalCount = 0} = response;
        [...categories].sort(({order = 0}): number => order)
        const initialCategories = categories.filter(hasCategoryId).map(
          ({categoryId, ...category}, index): ValidCategory => ({
            categoryId,
            ...category,
            ...distribution[categoryId],
            order: index + 1,
            totalCount,
          }))
        setCategories(initialCategories)
        setInitial({
          categories: _keyBy(initialCategories, 'categoryId'),
          missing: {...missingUseCases, totalCount},
        })
        setMaxCount(totalCount)
        setTotalCount(totalCount)
      },
    )
  }, [dispatch, hasCategories, isFetchingDistribution, maxCount])

  const recompute = useCallback((event?: React.FormEvent): void => {
    event && event.preventDefault && event.preventDefault()
    dispatch(getUseCaseDistribution(sendableCategories, maxCount)).then(
      (response): void => {
        if (!response) {
          return
        }
        const {distribution = {}, missingUseCases = {}, totalCount = 0} = response
        const newCategories = categories.filter(hasCategoryId).
          map(({categoryId, ...category}): ValidCategory => ({
            categoryId,
            ...category,
            ...distribution[categoryId],
            totalCount,
          }))
        setCategories(newCategories)
        setMaxCount(totalCount)
        setTotalCount(totalCount)
        setMissingUseCases(missingUseCases)
      },
    )
  }, [categories, dispatch, maxCount, sendableCategories])

  const addCategory = useCallback((event?: React.SyntheticEvent): void => {
    event && event.preventDefault && event.preventDefault()
    if (!newCategory) {
      return
    }
    setCategories([
      ...categories, {
        categoryId: newCategory,
        filters: [],
        order: categories.length + 1,
        totalCount,
      }])
    setNewCategory('')
  }, [categories, newCategory, totalCount])

  const handleCategoryChange = useCallback(
    (changedIndex: number, change: Partial<Category>): void => {
      setCategories(categories.map((category, index): ValidCategory => index === changedIndex ? {
        ...category,
        ...change,
      } : category))
    },
    [categories],
  )

  const handleDrag = useCallback((unusedEvent: object, categories: readonly object[]): void => {
    setCategories((categories as readonly ValidCategory[]).
      map((category: ValidCategory, index: number): ValidCategory =>
        ({...category, order: index + 1})))
  }, [])

  const handleMaxCountChange = useCallback(
    (maxCountString: string): void => setMaxCount(Number.parseInt(maxCountString || '0')),
    [],
  )

  const renderStats = useCallback((row: object, index: number): React.ReactElement => {
    const category = row as Category & {categoryId: string}
    return <BobThinkStatsIndexed
      style={{backgroundColor: '#fff'}} onChange={handleCategoryChange} index={index}
      initial={initialCategories[category.categoryId]} t={t} {...category} />
  }, [handleCategoryChange, initialCategories, t])

  const mutableCategories = useMemo((): ValidCategory[] => [...categories], [categories])

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
      dataSource={mutableCategories}
      handles={false}
      rowKey="categoryId"
      row={renderStats}
      onUpdate={handleDrag} />
    <BobThinkStats
      {...{...missingUseCases, totalCount}} initial={initialMissing} isEmptyThink={true}
      categoryId="In need of a category" t={t} />
    <form onSubmit={addCategory} style={{alignItems: 'center', display: 'flex'}}>
      <Input
        placeholder="Nouvelle catégorie" value={newCategory}
        style={{backgroundColor: '#fff', maxWidth: 220}}
        onChange={setNewCategory} />
      <Button
        disabled={!newCategory} onClick={addCategory}
        type="navigation" style={{margin: 20}}>
        Ajouter
      </Button>
    </form>
    <form onSubmit={recompute}>
      Nombre de cas à évaluer
      <Input
        style={{margin: '0 10px 0', width: 50}}
        value={maxCount.toString()}
        onChange={handleMaxCountChange} />
      <Button
        onClick={recompute} type="validation" style={{marginTop: 20}} disabled={!maxCount}>
        Recalculer</Button>
    </form>
  </div>
}
CategoriesDistributionBase.propTypes = {
  style: PropTypes.object,
}
const CategoriesDistribution = React.memo(CategoriesDistributionBase)


export {CategoriesDistribution, UseCaseSelector}
