import _isEqual from 'lodash/isEqual'
import _keyBy from 'lodash/keyBy'
import _memoize from 'lodash/memoize'
import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React from 'react'
import ReactDragList from 'react-drag-list'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'

import {DispatchAllEvalActions, EvalRootState, GET_EVAL_FILTERS_USE_CASES,
  GET_USE_CASE_DISTRIBUTION, getEvalFiltersUseCases, getUseCaseDistribution} from 'store/actions'
import {getUseCaseTitle} from 'store/eval'

import {Button, CircularProgress, Input, GrowingNumber, UpDownIcon} from 'components/theme'
import {Select} from 'components/pages/connected/form_utils'
import {Routes} from 'components/url'


interface SelectorProps {
  dispatch: DispatchAllEvalActions
  isFetching: boolean
}


interface SelectorState {
  filters?: readonly string[]
  inputValue?: string
  useCases?: readonly bayes.bob.UseCase[]
}


interface SelectOption<T> {
  name: string
  value: T
}


class UseCaseSelectorBase extends React.PureComponent<SelectorProps, SelectorState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    isFetching: PropTypes.bool,
  }

  public state = {
    filters: [],
    inputValue: '',
    useCases: [],
  }

  private onInputChange = (inputValue: string, {action}): void => {
    if (action !== 'input-blur' && inputValue && !inputValue.endsWith(' ')) {
      this.setState({inputValue})
      return
    }
    const stateUpdater: SelectorState = {inputValue: ''}
    const {filters, inputValue: oldInputValue} = this.state
    const filter = inputValue.trim() || oldInputValue
    if (filter && !filters.includes(filter)) {
      stateUpdater.filters = [...filters, filter]
    }
    this.setState(stateUpdater)
  }

  private handleFiltersChange = (filters: string[]): void => this.setState({filters})

  private onClick = (): void => {
    this.props.dispatch(getEvalFiltersUseCases(this.state.filters)).
      then((response): void => {
        if (response) {
          this.setState({useCases: response})
        }
      })
  }

  // TODO(cyrille): Maybe get a list of filter suggestions from server.
  // TODO(cyrille): Warn if we don't get any use case from server.
  public render(): React.ReactNode {
    const {filters, inputValue, useCases} = this.state
    return <div style={{maxWidth: 600, padding: 20}}>
      <Select
        onInputChange={this.onInputChange}
        options={filters.map((value: string): SelectOption<string> => ({name: value, value}))}
        isMulti={true} value={filters} autoFocus={true} inputValue={inputValue} menuIsOpen={false}
        onChange={this.handleFiltersChange} />
      <Button style={{margin: 20}} type="validation" onClick={this.onClick}>
        Trouver des cas d'usage
      </Button>
      {this.props.isFetching ? <CircularProgress /> : <ul>
        {useCases.map(({useCaseId, poolName, title, userData}): React.ReactNode =>
          <li key={useCaseId} ><Link
            target="_blank" to={`${Routes.EVAL_PAGE}/${useCaseId}?poolName=${poolName}`}>
            {getUseCaseTitle(title, userData)}
          </Link></li>)}
      </ul>}
    </div>
  }
}
const UseCaseSelector = connect(
  (
    {asyncState: {isFetching: {[GET_EVAL_FILTERS_USE_CASES]: isFetching}}}: EvalRootState,
  ): {isFetching: boolean} => ({isFetching}))(UseCaseSelectorBase)


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
  filters?: readonly FilterDiff[]
  hasInput?: boolean
  inputValue?: string
  validFilters?: readonly string[]
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

  public state = {
    filters: Filters.makeFiltersState(this.props.children, this.props.initial),
    hasInput: false,
    inputValue: '',
    validFilters: [],
  }

  public static getDerivedStateFromProps(
    unusedProps, {filters, validFilters: previous}: FiltersState): FiltersState {
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
    this.setState(({filters, inputValue}: FiltersState): FiltersState => ({
      filters: [...filters, {change: 'added', filter: inputValue}],
      hasInput: false,
      inputValue: '',
    }), (): void => this.props.onChange && this.props.onChange(this.state.validFilters))
  }

  private onChange = (): void => {
    const {onChange} = this.props
    onChange && onChange(this.state.validFilters)
  }

  private handleInputChange = ({target: {value}}): void =>
    value.endsWith(' ') ? this.addFilter() : this.setState({inputValue: value})

  private handleFilterChange = _memoize(
    (filter, shouldRemove): (() => void) => (): void => {
      const initial = new Set(this.props.initial)
      this.setState(({filters}: FiltersState): FiltersState => ({
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
    const filterStyle = (change): React.CSSProperties => ({
      color: change === 'added' ? colors.GREENISH_TEAL : 'initial',
      textDecoration: change === 'removed' ? 'line-through' : 'initial',
    })
    const changeStyle = (change): React.CSSProperties => ({
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
  onChange?: (field: string, value: string) => void
  order?: number
  style?: React.CSSProperties
  totalCount?: number
}


class BobThinkStats extends React.PureComponent<BobThinkStatsProps, {areUseCasesShown: boolean}> {
  public static propTypes = {
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
    totalCount: PropTypes.number.isRequired,
  }

  public state = {
    areUseCasesShown: false,
  }

  private handleChange = _memoize((field: string): ((v) => void) => (value: string): void => {
    this.props.onChange && this.props.onChange(field, value)
  })

  private handleShowUseCases = _memoize((areUseCasesShown): (() => void) =>
    (): void => this.setState({areUseCasesShown}))

  public render(): React.ReactNode {
    const {categoryId, count = 0, filters = [], initial = {}, isEmptyThink, order, style,
      totalCount, examples = []} = this.props
    const {
      count: initialCount = 0,
      filters: initialFilters = [],
      order: initialOrder,
      totalCount: initialTotal,
    } = initial
    const {areUseCasesShown} = this.state
    const defaultElementStyle = {
      flexShrink: 0,
      marginRight: 10,
    }
    const containerStyle = {
      alignItems: 'center',
      border: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      padding: 5,
      ...style,
    }
    const filtersContainerStyle: React.CSSProperties = {
      ...defaultElementStyle,
      display: 'inline-flex',
      flex: 1,
      flexWrap: 'wrap',
      overflow: 'hidden',
    }
    const useCasesSpanStyle: React.CSSProperties = {
      ...defaultElementStyle,
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
    const categoryPercentage = Math.round(100 * count / totalCount)
    // TODO(cyrille): Make a better UI involving table.
    return <div style={containerStyle}>
      <span style={{...defaultElementStyle, marginLeft: 10, width: '3em'}}>
        {isEmptyThink ? null :
          <ComparedValue old={initialOrder} value={order}>{order}</ComparedValue>}
      </span>
      <span style={{...defaultElementStyle, width: '10em'}}>
        {categoryId}
      </span>
      <span style={filtersContainerStyle}>
        {isEmptyThink ? null :
          <Filters initial={initialFilters} onChange={this.handleChange('filters')}>
            {filters}
          </Filters>}
      </span>
      <span style={{...defaultElementStyle, fontWeight: 'bold'}}>
        <ComparedValue
          old={Math.round(100 * initialCount / initialTotal)}
          value={categoryPercentage} isHigherUp={true}>
          <GrowingNumber number={categoryPercentage} />%
        </ComparedValue>
      </span>
      {examples.length ? <span
        onMouseEnter={this.handleShowUseCases(true)}
        onMouseLeave={this.handleShowUseCases(false)}
        style={useCasesSpanStyle}>
        Use Cases
        {areUseCasesShown ? <div style={useCasesContainerStyle}>
          {examples.map(({useCaseId, poolName, title, userData}): React.ReactNode =>
            <div key={useCaseId} style={{margin: 5}} ><Link
              style={{whiteSpace: 'nowrap'}}
              target="_blank" to={`${Routes.EVAL_PAGE}/${useCaseId}?poolName=${poolName}`}>
              {getUseCaseTitle(title, userData)}
            </Link></div>)}
        </div> : null}
      </span> :
        <span style={{...defaultElementStyle, color: colors.RED_PINK}}>No Use Cases</span>}
    </div>
  }
}


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
    const isUp = isHigherUp ? value > old : value < old
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


const makeSendableCategory =
  (category): bayes.bob.DiagnosticCategory => _pick(category, ['categoryId', 'filters', 'order'])


interface CategoriesDistributionProps {
  dispatch: DispatchAllEvalActions
  isFetchingDistribution: boolean
  style: React.CSSProperties
}


interface CategoriesDistributionState {
  categories?: Category[]
  initialCategories?: {[categoryId: string]: Category}
  initialMissing?: Category
  lastCategories?: bayes.bob.DiagnosticCategory[]
  maxCount?: number
  missingUseCases?: {}
  newCategory?: string
  sendableCategories?: bayes.bob.DiagnosticCategory[]
  totalCount?: number
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
    totalCount: 0,
  }

  public static getDerivedStateFromProps(unusedProps, {categories}): CategoriesDistributionState {
    return {sendableCategories: categories.map(makeSendableCategory)}
  }

  public componentDidMount(): void {
    this.props.dispatch(getUseCaseDistribution([], this.state.maxCount)).then(
      (response): void => {
        if (!response) {
          return
        }
        const {categories, distribution, missingUseCases, totalCount} = response;
        [...categories].sort(({order}): number => order)
        const initialCategories = categories.map(
          ({categoryId, ...category}, index): Category => ({
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
      }
    )
  }

  private recompute = (event): void => {
    event && event.preventDefault && event.preventDefault()
    const {categories, maxCount, sendableCategories} = this.state
    this.props.dispatch(getUseCaseDistribution(sendableCategories, maxCount)).then(
      (response): void => {
        if (!response) {
          return
        }
        const {distribution, missingUseCases, totalCount} = response
        const newCategories = categories.map(({categoryId, ...category}): Category => ({
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
      }
    )
  }

  private addCategory = (event): void => {
    event && event.preventDefault && event.preventDefault()
    this.setState(({categories, newCategory, totalCount}): CategoriesDistributionState => ({
      categories: [...categories, {
        categoryId: newCategory,
        filters: [],
        order: categories.length + 1,
        totalCount,
      }],
      newCategory: '',
    }))
  }

  private handleCategoryChange = _memoize((changedIndex: number): ((field, value) => void) =>
    (field, value): void => {
      this.setState(({categories}): CategoriesDistributionState => ({
        categories: categories.map((category, index): Category => index === changedIndex ? {
          ...category,
          [field]: value,
        } : category),
      }))
    })

  private handleDrag = (event, categories): void => {
    this.setState({
      categories: categories.map((category, index): Category => ({...category, order: index + 1})),
    })
  }

  private handleNewCategoryChange = (newCategory: string): void => this.setState({newCategory})

  private handleMaxCountChange = (maxCountString: string): void =>
    this.setState({maxCount: parseInt(maxCountString || '0')})

  private renderStats = (category: Category, index: number): React.ReactElement<BobThinkStats> =>
    <BobThinkStats
      style={{backgroundColor: '#fff'}} onChange={this.handleCategoryChange(index)}
      initial={this.state.initialCategories[category.categoryId]} {...category} />

  public render(): React.ReactNode {
    const {categories, initialMissing, newCategory, maxCount, missingUseCases,
      totalCount}: CategoriesDistributionState = this.state
    if (this.props.isFetchingDistribution) {
      return <CircularProgress />
    }
    if (!totalCount) {
      return null
    }
    return <div style={{padding: 10, ...this.props.style}}>
      <ReactDragList
        dataSource={categories}
        handles={false}
        rowKey="categoryId"
        row={this.renderStats}
        onUpdate={this.handleDrag} />
      <BobThinkStats
        {...{...missingUseCases, totalCount}} initial={initialMissing} isEmptyThink={true}
        categoryId="In need of a category" />
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
    isFetchingDistribution: isFetching[GET_USE_CASE_DISTRIBUTION],
  }))(CategoriesDistributionBase)


export {CategoriesDistribution, UseCaseSelector}
