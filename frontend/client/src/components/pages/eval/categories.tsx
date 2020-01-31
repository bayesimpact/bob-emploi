import {TFunction} from 'i18next'
import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _memoize from 'lodash/memoize'
import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import ReactDragList from 'react-drag-list'
import {connect} from 'react-redux'
import {InputActionMeta} from 'react-select'
import {Link} from 'react-router-dom'

import {DispatchAllEvalActions, EvalRootState, getEvalFiltersUseCases,
  getUseCaseDistribution} from 'store/actions'
import {getUseCaseTitle} from 'store/eval'

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


interface FiltersProps {
  children: readonly string[]
  initial: readonly string[]
  onChange: (filters: readonly string[]) => void
}


interface FilterDiff {
  change: 'added' | 'removed' | ''
  filter: string
}


interface FiltersState {
  filters: readonly FilterDiff[]
  hasInput: boolean
  inputValue: string
  validFilters: readonly string[]
}


class Filters extends React.PureComponent<FiltersProps> {
  public static propTypes = {
    children: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    initial: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    onChange: PropTypes.func,
  }

  private static makeFiltersState(
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

  public state: FiltersState = {
    filters: Filters.makeFiltersState(this.props.children, this.props.initial),
    hasInput: false,
    inputValue: '',
    validFilters: [],
  }

  public static getDerivedStateFromProps(
    unusedProps: FiltersProps, {filters, validFilters: previous}: FiltersState):
    Pick<FiltersState, 'validFilters'>|null {
    const validFilters = filters.
      filter(({change}): boolean => !change || change === 'added').
      map(({filter}): string => filter)
    if (_isEqual(validFilters, previous)) {
      return null
    }
    return {validFilters}
  }

  private addFilter = (): void => {
    if (!this.state.inputValue) {
      return
    }
    this.setState(({filters, inputValue}: FiltersState):
    Pick<FiltersState, 'filters'|'hasInput'|'inputValue'> => ({
      filters: [...filters, {change: 'added', filter: inputValue}],
      hasInput: false,
      inputValue: '',
    }), (): void => this.props.onChange && this.props.onChange(this.state.validFilters))
  }

  private onChange = (): void => {
    const {onChange} = this.props
    onChange && onChange(this.state.validFilters)
  }

  private handleInputChange =
  ({currentTarget: {value}}: React.ChangeEvent<HTMLInputElement>): void =>
    value.endsWith(' ') ? this.addFilter() : this.setState({inputValue: value})

  private handleFilterChange = _memoize(
    (filter, shouldRemove): (() => void) => (): void => {
      const initial = new Set(this.props.initial)
      this.setState(({filters}: FiltersState): Pick<FiltersState, 'filters'> => ({
        filters: filters.map((filterState: FilterDiff): FilterDiff =>
          filterState.filter === filter ? {
            change: shouldRemove ? 'removed' : initial.has(filter) ? '' : 'added',
            filter,
          } : filterState),
      }), this.onChange)
    },
    (filter, shouldRemove): string => `${filter}:${shouldRemove}`)

  private handleShowInput = _memoize((hasInput: boolean): (() => void) =>
    (): void => this.setState({hasInput}))

  public render(): React.ReactNode {
    const {filters, hasInput, inputValue} = this.state
    const filterElementStyle: React.CSSProperties = {
      backgroundColor: colors.MODAL_PROJECT_GREY,
      borderRadius: 2,
      margin: 2,
      padding: '2px 5px',
      whiteSpace: 'nowrap',
    }
    const filterStyle = (change: 'added'|'removed'|''): React.CSSProperties => ({
      color: change === 'added' ? colors.GREENISH_TEAL : 'initial',
      textDecoration: change === 'removed' ? 'line-through' : 'initial',
    })
    const changeStyle = (change: 'added'|'removed'|''): React.CSSProperties => ({
      color: change === 'removed' ? colors.GREENISH_TEAL : colors.RED_PINK,
      cursor: 'pointer',
      fontWeight: 'bold',
      padding: '0 .2em',
      textDecoration: 'none',
    })
    return <React.Fragment>
      {filters.map(({change, filter}): React.ReactNode =>
        <div key={filter} style={filterElementStyle}>
          <span style={filterStyle(change)}>{filter}</span>
          <span
            onClick={this.handleFilterChange(filter, change !== 'removed')}
            style={changeStyle(change)}>
            {change === 'removed' ? '+' : '-'}
          </span>
        </div>)}
      {hasInput ? <form onSubmit={this.addFilter}>
        <input
          value={inputValue} onBlur={this.handleShowInput(false)}
          onChange={this.handleInputChange} />
      </form> :
        <div
          onClick={this.handleShowInput(true)}
          style={filterElementStyle}><span style={changeStyle('removed')}>+</span></div>}
    </React.Fragment>
  }
}


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


class ComparedValue extends React.PureComponent<ComparedValueProps> {
  public static propTypes = {
    children: PropTypes.node,
    isHigherUp: PropTypes.bool,
    old: PropTypes.number,
    value: PropTypes.number.isRequired,
  }

  public render(): React.ReactNode {
    const {children, isHigherUp, old, value} = this.props
    const isNew = typeof old === 'undefined'
    const isUp = isHigherUp ? value > (old || 0) : value < (old || 0)
    const color = isUp ? colors.GREENISH_TEAL : colors.RED_PINK
    return <div style={{alignItems: 'center', display: 'flex'}}>
      {children}
      {isNew || old === value ? null :
        <UpDownIcon style={{color}} icon="menu" isUp={isUp} />}
    </div>
  }
}


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


interface CategoriesDistributionProps {
  dispatch: DispatchAllEvalActions
  isFetchingDistribution: boolean
  style: React.CSSProperties
  t: TFunction
}


interface CategoriesDistributionState {
  categories: readonly ValidCategory[]
  initialCategories: {[categoryId: string]: ValidCategory}
  initialMissing?: Category
  lastCategories?: bayes.bob.DiagnosticCategory[]
  maxCount: number
  missingUseCases: {}
  newCategory?: string
  sendableCategories: readonly bayes.bob.DiagnosticCategory[]
  totalCount: number
}


class CategoriesDistributionBase
  extends React.PureComponent<CategoriesDistributionProps, CategoriesDistributionState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isFetchingDistribution: PropTypes.bool,
    style: PropTypes.object,
  }

  public state: CategoriesDistributionState = {
    categories: [],
    initialCategories: {},
    maxCount: 10,
    missingUseCases: {},
    sendableCategories: [],
    totalCount: 0,
  }

  public static getDerivedStateFromProps(
    unusedProps: CategoriesDistributionProps, {categories}: CategoriesDistributionState):
    Pick<CategoriesDistributionState, 'sendableCategories'> {
    return {sendableCategories: categories.map(makeSendableCategory)}
  }

  public componentDidMount(): void {
    this.props.dispatch(getUseCaseDistribution([], this.state.maxCount)).then(
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
        this.setState({
          categories: initialCategories,
          initialCategories: _keyBy(initialCategories, 'categoryId'),
          initialMissing: {...missingUseCases, totalCount},
          lastCategories: initialCategories.map(makeSendableCategory),
          maxCount: totalCount,
          missingUseCases,
          totalCount,
        })
      },
    )
  }

  private recompute = (event?: React.FormEvent): void => {
    event && event.preventDefault && event.preventDefault()
    const {categories, maxCount, sendableCategories} = this.state
    this.props.dispatch(getUseCaseDistribution(sendableCategories, maxCount)).then(
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
        this.setState({
          categories: newCategories,
          lastCategories: categories.map(makeSendableCategory),
          maxCount: totalCount,
          missingUseCases,
          totalCount,
        })
      },
    )
  }

  private addCategory = (event?: React.SyntheticEvent): void => {
    event && event.preventDefault && event.preventDefault()
    this.setState(({categories, newCategory, totalCount}):
    Pick<CategoriesDistributionState, 'categories'|'newCategory'>|null => {
      if (!newCategory) {
        return null
      }
      return {
        categories: [...categories, {
          categoryId: newCategory,
          filters: [],
          order: categories.length + 1,
          totalCount,
        }],
        newCategory: '',
      }
    })
  }

  private handleCategoryChange = _memoize(
    (changedIndex: number): ((c: Partial<Category>) => void) =>
      (change: Partial<Category>): void => {
        this.setState(({categories}): Pick<CategoriesDistributionState, 'categories'> => ({
          categories: categories.map((category, index): ValidCategory => index === changedIndex ? {
            ...category,
            ...change,
          } : category),
        }))
      })

  private handleDrag = (unusedEvent: object, categories: readonly object[]): void => {
    this.setState({
      categories: (categories as readonly ValidCategory[]).
        map((category: ValidCategory, index: number): ValidCategory =>
          ({...category, order: index + 1})),
    })
  }

  private handleNewCategoryChange = (newCategory: string): void => this.setState({newCategory})

  private handleMaxCountChange = (maxCountString: string): void =>
    this.setState({maxCount: parseInt(maxCountString || '0')})

  private renderStats = (row: object, index: number): React.ReactElement => {
    const category = row as Category & {categoryId: string}
    return <BobThinkStats
      style={{backgroundColor: '#fff'}} onChange={this.handleCategoryChange(index)}
      initial={this.state.initialCategories[category.categoryId]} t={this.props.t} {...category} />
  }

  private getMutableCategories = _memoize(
    (categories: readonly ValidCategory[]): ValidCategory[] => [...categories])

  public render(): React.ReactNode {
    const {isFetchingDistribution, style, t} = this.props
    const {categories, initialMissing, newCategory, maxCount, missingUseCases,
      totalCount}: CategoriesDistributionState = this.state
    if (isFetchingDistribution) {
      return <CircularProgress />
    }
    if (!totalCount) {
      return null
    }
    return <div style={{padding: 10, ...style}}>
      {/* TODO(pascal): Fix ReactDragList so that it does not modify its props! */}
      <ReactDragList
        dataSource={this.getMutableCategories(categories)}
        handles={false}
        rowKey="categoryId"
        row={this.renderStats}
        onUpdate={this.handleDrag} />
      <BobThinkStats
        {...{...missingUseCases, totalCount}} initial={initialMissing} isEmptyThink={true}
        categoryId="In need of a category" t={t} />
      <form onSubmit={this.addCategory} style={{alignItems: 'center', display: 'flex'}}>
        <Input
          placeholder="Nouvelle catégorie" value={newCategory}
          style={{backgroundColor: '#fff', maxWidth: 220}}
          onChange={this.handleNewCategoryChange} />
        <Button
          disabled={!newCategory} onClick={this.addCategory}
          type="navigation" style={{margin: 20}}>
          Ajouter
        </Button>
      </form>
      <form onSubmit={this.recompute}>
        Nombre de cas à évaluer
        <Input
          style={{margin: '0 10px 0', width: 50}}
          value={maxCount.toString()}
          onChange={this.handleMaxCountChange} />
        <Button
          onClick={this.recompute} type="validation" style={{marginTop: 20}} disabled={!maxCount}>
          Recalculer</Button>
      </form>
    </div>
  }
}
const CategoriesDistribution = connect(
  ({asyncState: {isFetching}}: EvalRootState): {isFetchingDistribution: boolean} => ({
    isFetchingDistribution: !!isFetching['GET_USE_CASE_DISTRIBUTION'],
  }))(CategoriesDistributionBase)


export {CategoriesDistribution, UseCaseSelector}
