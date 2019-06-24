import _memoize from 'lodash/memoize'
import React from 'react'
import PropTypes from 'prop-types'
import algoliasearch from 'algoliasearch/reactnative'
import autocomplete from 'autocomplete.js/dist/autocomplete.min'

import algoliaLogoUrl from 'images/algolia.svg'

require('styles/algolia.css')


interface AlgoliaSuggestProps {
  algoliaApiKey: string
  algoliaApp: string
  algoliaIndex: string
  autoselect?: boolean
  autoselectOnBlur?: boolean
  display?: (suggestion) => React.ReactNode
  displayKey?: string
  displayValue?: string
  hint?: boolean
  hitsPerPage?: number
  inputRef?: (input: HTMLInputElement) => void
  onBlur?: () => void
  onChange?: (event, displaySuggestion, suggestion) => void
  onFocus?: () => void
  onSuggestSelect?: (event, displaySuggestion, suggestion) => void
  placeholder?: string
  style?: React.CSSProperties
  suggestionTemplate?: (suggestion) => React.ReactNode
}


// An autocomplete input using Algolia as a backend.
// TODO: Contribute to autocomplete.js.
class AlgoliaSuggest extends React.Component<AlgoliaSuggestProps> {
  public static propTypes = {
    // API key of the Algolia app.
    algoliaApiKey: PropTypes.string.isRequired,
    // ID of the Algolia app.
    algoliaApp: PropTypes.string.isRequired,
    // Name of the index to use in the Algolia app.
    algoliaIndex: PropTypes.string.isRequired,
    // A function to use on suggestion to compute the visible input. Overrides
    // displayKey.
    display: PropTypes.func,
    // Key to use as visible input when a suggestion is selected. Is overriden
    // by display.
    displayKey: PropTypes.string,
    // A value to set inside the field programatically.
    displayValue: PropTypes.string,
    // Numbers of suggestions shown when typing.
    hitsPerPage: PropTypes.number,
    // A callback ref to set on the input field.
    inputRef: PropTypes.func,
    // Function called when the value changed either when the text changes or
    // when a suggestion is selected. It takes 3 arguments: the browser event,
    // the displayed value, and in the case of a suggestion selected, the
    // suggestion object.
    onChange: PropTypes.func,
    onFocus: PropTypes.func,
    // Function called when a selection is suggested. It takes 3 arguments:
    // the event, the displayed value, and the suggestion object.
    onSuggestSelect: PropTypes.func,
    // A string to display in the input field when no text is entered.
    placeholder: PropTypes.string,
    // Style to use for the input field.
    style: PropTypes.object,
    // Rendering function for each suggestion.
    suggestionTemplate: PropTypes.func,
    // Other props are used as autocomplete options.
  }

  public componentDidMount(): void {
    const {
      algoliaApp,
      algoliaApiKey,
      algoliaIndex,
      display,
      displayValue,
      hitsPerPage,
      onChange,
      onSuggestSelect,
      suggestionTemplate,
      ...extraProps
    } = this.props
    const algoliaClient = algoliasearch(algoliaApp, algoliaApiKey)
    const displayFunc = display ||
      ((suggestion): React.ReactNode => suggestion[this.props.displayKey])
    const handleSelected = (event, suggestion): void => {
      const displaySuggestion = displayFunc(suggestion)
      onSuggestSelect && onSuggestSelect(event, displaySuggestion, suggestion)
      onChange && onChange(event, displaySuggestion, suggestion)
    }
    // TODO(pascal): Rething this pattern as this is not compatible with React.
    // Modifying the DOM without React is somewhat OK, but here it changes the
    // main DOM element of this component which confuses React when trying to
    // update the components before it.
    const suggest = autocomplete(this.node, extraProps, [
      {
        display: displayFunc,
        source: autocomplete.sources.hits(
          algoliaClient.initIndex(algoliaIndex), {hitsPerPage: hitsPerPage}),
        templates: {
          footer: '<div class="aa-footer">recherche rapide grâce à ' +
            '<img src="' + algoliaLogoUrl + '" alt="Algolia"/></div>',
          suggestion: suggestionTemplate,
        },
      },
    ]).
      on('autocomplete:selected', handleSelected).
      on('autocomplete:autocompleted', handleSelected)
    if (displayValue) {
      suggest.autocomplete.setVal(displayValue)
    }
    this.suggest = suggest
    // The hint object get styled by the autocomplete lib by copying the
    // initial style of the input. That is a problem because later we allow our
    // component to change this style (so we need to update the hint object
    // manually in componentDidUpdate).
    this.hint = suggest[0].previousSibling
    // As the style is copied over from the input, to make it more look like a
    // hint we change only the opacity.
    if (this.hint) {
      this.hint.style.opacity = '.5'
    }
  }

  public componentDidUpdate = (prevProps): void => {
    if (this.suggest && this.suggest.autocomplete &&
        prevProps.displayValue !== this.props.displayValue) {
      this.suggest.autocomplete.setVal(this.props.displayValue)
    }
    if (this.hint && prevProps.style !== this.props.style) {
      // Update the display property. It would make sense to also update other
      // properties but it's quite hard as the hint object is not managed by
      // React and we have no use for it for now.
      if ((prevProps.style && prevProps.style.display) !==
          (this.props.style && this.props.style.display)) {
        this.hint.style.display = this.props.style.display
      }
    }
  }

  private hint: HTMLElement

  private suggest: ReturnType<typeof autocomplete>

  private node: HTMLInputElement

  public render(): React.ReactNode {
    const {
      inputRef,
      onChange,
      onFocus,
      placeholder,
      style,
    } = this.props
    const wrappedOnChange = onChange && ((event): void => {
      onChange(event, event.target.value, null)
    })
    // TODO(cyrille): Replace with createRef.
    const handleRef = (node): void => {
      this.node = node
      inputRef && inputRef(node)
    }
    // TODO(pascal): Also style with focus and hover effects like the other inputs.
    return <input
      onChange={wrappedOnChange} ref={handleRef} style={style} placeholder={placeholder}
      onFocus={onFocus} />
  }
}


// Genderize a job name from `store/job.js`.
// TODO: Find a way to avoid this duplication of code.
function genderizeJob(job: bayes.bob.Job, gender: string): string {
  if (!job) {
    return ''
  }
  if (gender === 'FEMININE') {
    return job.feminineName || job.name
  }
  if (gender === 'MASCULINE') {
    return job.masculineName || job.name
  }
  return job.name
}


function maybeLowerFirstLetter(word: string, isLowercased: boolean): string {
  if (!isLowercased || !word) {
    return word
  }
  // Matches the first visible letter (ignoring HTML tag that would come
  // before): e.g. "Fireman" => "F", "<em>Gre</em>mlin" => "G".
  const matchFirstLetter = word.match(/^(<.*?>)?(\w)(.*)$/)
  if (!matchFirstLetter) {
    return word
  }
  return (matchFirstLetter[1] || '') + matchFirstLetter[2].toLowerCase() + matchFirstLetter[3]
}


interface JobSuggestion {
  readonly codeOgr: string
  readonly libelleRome: string
  readonly codeRome: string
  readonly libelleAppellationCourt: string
  readonly libelleAppellationCourtFeminin?: string
  readonly libelleAppellationCourtMasculin?: string
}


type Mutable<T> = {-readonly [K in keyof T]?: T[K]}


// Assemble a Job proto from a JobSuggest suggestion.
function jobFromSuggestion(suggestion: JobSuggestion): bayes.bob.Job {
  if (!suggestion) {
    return
  }
  var job: Mutable<bayes.bob.Job> = {
    codeOgr: suggestion.codeOgr,
    jobGroup: {
      name: suggestion.libelleRome,
      romeId: suggestion.codeRome,
    },
    name: suggestion.libelleAppellationCourt,
  }
  if (suggestion.libelleAppellationCourtFeminin) {
    job.feminineName = suggestion.libelleAppellationCourtFeminin
  }
  if (suggestion.libelleAppellationCourtMasculin) {
    job.masculineName = suggestion.libelleAppellationCourtMasculin
  }
  return job
}


const GENDERIZED_DISPLAY_KEY_SUFFIX = {
  'FEMININE': 'Feminin',
  'MASCULINE': 'Masculin',
}


const handleDisplay = _memoize(
  (isLowercased, gender): ((s) => string) => (suggestion): string => {
    const displayKey = 'libelleAppellationCourt' + (GENDERIZED_DISPLAY_KEY_SUFFIX[gender] || '')
    return maybeLowerFirstLetter(suggestion[displayKey], isLowercased)
  },
  (isLowercased, gender): string => (isLowercased ? 'l' : 'L') + gender)


interface SuggestProps<T> {
  errorDelaySeconds?: number
  gender?: bayes.bob.Gender
  hitsPerPage?: number
  inputRef?: (input: HTMLInputElement) => void
  isLowercased?: boolean
  onChange?: (value: T) => void
  onError?: () => void
  onFocus?: () => void
  onSuggestSelect?: (event, displaySuggestion, suggestion) => void
  placeholder?: string
  style?: React.CSSProperties
  value?: T
}


interface JobSuggestState {
  gender?: bayes.bob.Gender
  jobName?: string
  value?: bayes.bob.Job
}


// A Job autocomplete input.
class JobSuggest extends React.Component<SuggestProps<bayes.bob.Job>, JobSuggestState> {
  public static algoliaApp = 'K6ACI9BKKT'

  public static algoliaApiKey = 'da4db0bf437e37d6d49cefcb8768c67a'

  public static algoliaIndex = 'jobs'

  public static propTypes = {
    // Delay the calling of `onError` by this amount after the user stopped typing.
    // Defaults to 3 seconds.
    errorDelaySeconds: PropTypes.number,
    // The gender to display only one of the names where job names are
    // genderized.
    gender: PropTypes.oneOf(['FEMININE', 'MASCULINE']),
    // If true, will display job names starting with a lower case letter
    // instead of upper case. This only changes the display, not the values in
    // the job object if it comes from a suggestion.
    isLowercased: PropTypes.bool,
    // Function called when the value changed either when the text changes or
    // when a suggestion is selected. It takes 1 argument: the job that is
    // selected if it's a valid job, null otherwise.
    onChange: PropTypes.func.isRequired,
    // Function called in case no result could be found after the user stopped typing
    // for `errorDelaySeconds` seconds.
    onError: PropTypes.func,
    style: PropTypes.object,
    value: PropTypes.object,
  }

  public static defaultProps = {
    errorDelaySeconds: 3,
  }

  public state: JobSuggestState = {
    jobName: '',
  }

  public static getDerivedStateFromProps({gender, isLowercased, value}, prevState):
  Partial<JobSuggestState> {
    if (prevState.gender === gender && !!prevState.isLowercased === !!isLowercased
      && prevState.value === value) {
      return null
    }
    const updatedState = {
      gender,
      isLowercased,
      jobName: '',
      value,
    }
    if (!value || !value.codeOgr) {
      return updatedState
    }
    updatedState.jobName = maybeLowerFirstLetter(genderizeJob(value, gender), isLowercased) || ''
    return updatedState
  }

  private timeout: ReturnType<typeof setTimeout>

  private maybeLowerFirstLetter = (word): string =>
    maybeLowerFirstLetter(word, this.props.isLowercased)

  private renderSuggestion = (suggestion): React.ReactNode => {
    const {gender} = this.props
    var name = suggestion._highlightResult.libelleAppellationLong.value
    if (gender === 'FEMININE') {
      name = suggestion._highlightResult.libelleAppellationLongFeminin.value || name
    } else if (gender === 'MASCULINE') {
      name = suggestion._highlightResult.libelleAppellationLongMasculin.value || name
    }
    return '<div>' + this.maybeLowerFirstLetter(name) + '<span class="aa-group">' +
        suggestion._highlightResult.libelleRome.value + '</span></div>'
  }

  private handleChange = (event, value, suggestion): void => {
    event.stopPropagation()
    const {errorDelaySeconds, gender, onChange, onError} = this.props

    clearTimeout(this.timeout)
    this.timeout = setTimeout((): void => {
      this.hasError() && onError && onError()
    }, errorDelaySeconds * 1000)

    if (!suggestion) {
      this.setState({jobName: value})
      onChange && onChange(null)
      return
    }
    const job = jobFromSuggestion(suggestion)
    const genderizedJobName = genderizeJob(job, gender)
    const jobName = this.maybeLowerFirstLetter(genderizedJobName)
    this.setState({jobName})
    onChange && onChange(job)
  }

  private handleBlur = (): void => {
    const {onError} = this.props
    this.hasError() && onError && onError()
  }

  private hasError = (): boolean => {
    return this.state.jobName && !this.props.value
  }

  public render(): React.ReactNode {
    const {gender, isLowercased, style,
      onChange: omittedOnChange, value: omittedValue,
      ...otherProps} = this.props
    const {jobName} = this.state
    const fieldStyle = {...style}
    if (this.hasError()) {
      // TODO: Add a prop for `errorStyle`.
      fieldStyle.borderColor = 'red'
    }

    return <AlgoliaSuggest
      {...otherProps}
      algoliaIndex={JobSuggest.algoliaIndex}
      algoliaApp={JobSuggest.algoliaApp} algoliaApiKey={JobSuggest.algoliaApiKey}
      displayValue={jobName} hint={true} autoselect={true}
      autoselectOnBlur={true} style={fieldStyle} display={handleDisplay(isLowercased, gender)}
      onBlur={this.handleBlur}
      onChange={this.handleChange}
      suggestionTemplate={this.renderSuggestion} />
  }
}


// Return the first job suggested by Algolia for this job name.
function fetchFirstSuggestedJob(jobName: string): Promise<bayes.bob.Job> {
  const algoliaClient = algoliasearch(JobSuggest.algoliaApp, JobSuggest.algoliaApiKey)
  const jobIndex = algoliaClient.initIndex(JobSuggest.algoliaIndex)
  return jobIndex.search(jobName).then((results): bayes.bob.Job => {
    const firstJobSuggestion = results.hits && results.hits[0]
    if (!firstJobSuggestion) {
      return null
    }
    const firstSuggestedJob = jobFromSuggestion(firstJobSuggestion)
    // TODO(florian): Check that the job has the expected RomeId.
    return firstSuggestedJob
  })
}


const getFirstHitWithCodeOgr = (jobId: string): ((h) => JobSuggestion) =>
  ({hits}): JobSuggestion => hits.find(({codeOgr}): boolean => !jobId || codeOgr === jobId)


// TODO(pascal): Consider cleaning that up, if unused.
function fetchJob(jobName: string, jobId: string): Promise<bayes.bob.Job> {
  const algoliaClient = algoliasearch(JobSuggest.algoliaApp, JobSuggest.algoliaApiKey)
  const jobIndex = algoliaClient.initIndex(JobSuggest.algoliaIndex)
  // First fetch by name.
  return jobIndex.search(jobName).
    // Check the code OGR is right (if given)
    then(getFirstHitWithCodeOgr(jobId)).
    // If nothing found, fetch by code OGR.
    then((hit): Promise<JobSuggestion> => hit ? Promise.resolve(hit) :
      jobIndex.search(jobId).then(getFirstHitWithCodeOgr(jobId))).
    then(jobFromSuggestion)
}


interface CitySuggestion {
  cityId: string
  departementId: string
  departementName: string
  departementPrefix: string
  name: string
  objectID: string
  population: number
  regionId: string
  regionName: string
  transport: number
  urban: number
  zipCode: string
}


const cityFromSuggestion = ({
  cityId,
  departementId,
  departementName,
  departementPrefix,
  name,
  objectID,
  population,
  regionId,
  regionName,
  transport,
  urban,
  zipCode,
}: CitySuggestion): bayes.bob.FrenchCity => {
  const city: Mutable<bayes.bob.FrenchCity> = {cityId: cityId || objectID,
    departementId,
    departementName,
    departementPrefix,
    name,
    population,
    postcodes: zipCode,
    regionId,
    regionName,
  }
  if (urban === 0) {
    city.urbanScore = -1
  } else if (urban) {
    city.urbanScore = urban
  }
  if (transport) {
    city.publicTransportationScore = transport
  }
  return city
}


interface CitySuggestState {
  cityName?: string
  value?: bayes.bob.FrenchCity
}


// A City autocomplete input.
class CitySuggest extends React.Component<SuggestProps<bayes.bob.FrenchCity>, CitySuggestState> {
  public static algoliaApp = 'K6ACI9BKKT'

  public static algoliaApiKey = 'da4db0bf437e37d6d49cefcb8768c67a'

  public static algoliaIndex = 'cities'

  public static propTypes = {
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object,
    value: PropTypes.object,
  }

  public state: CitySuggestState = {
    cityName: '',
  }

  public static getDerivedStateFromProps({value}, prevState): CitySuggestState {
    if (prevState.value === value) {
      return null
    }
    if (!value || !value.cityId) {
      return {value}

    }
    return {
      cityName: value && value.name || '',
      value,
    }
  }

  private renderSuggestion = (suggestion): React.ReactNode => {
    var name = suggestion._highlightResult.name.value
    return '<div>' + name + '<span class="aa-group">' +
        suggestion._highlightResult.departementName.value + '</span></div>'
  }

  private handleChange = (event, value, suggestion): void => {
    event.stopPropagation()
    const {onChange} = this.props
    if (!suggestion) {
      this.setState({cityName: value})
      onChange && onChange(null)
      return
    }
    const city = cityFromSuggestion(suggestion)
    // Keep in sync with frontend/server/geo.py
    this.setState({cityName: city.name})
    onChange && onChange(city)
  }

  public render(): React.ReactNode {
    const {style, onChange: omittedOnChange, value, ...otherProps} = this.props
    const {cityName} = this.state
    const fieldStyle = {...style}
    if (cityName && !value) {
      fieldStyle.borderColor = 'red'
    }
    return <AlgoliaSuggest
      {...otherProps} algoliaIndex={CitySuggest.algoliaIndex}
      algoliaApp={CitySuggest.algoliaApp} algoliaApiKey={CitySuggest.algoliaApiKey}
      displayValue={cityName} hint={true} autoselect={true} autoselectOnBlur={true}
      hitsPerPage={5} displayKey="name"
      style={fieldStyle}
      onChange={this.handleChange}
      suggestionTemplate={this.renderSuggestion} />
  }
}


// TODO(cyrille): Factorize with fetchJob.
function fetchCity(location: bayes.bob.FrenchCity): Promise<bayes.bob.FrenchCity> {
  const algoliaClient = algoliasearch(CitySuggest.algoliaApp, CitySuggest.algoliaApiKey)
  const {departementId, cityId, name: cityName} = location
  const cityIndex = algoliaClient.initIndex(CitySuggest.algoliaIndex)
  return cityIndex.search(cityName || departementId).then(({hits}): CitySuggestion => {
    const bestCityById = hits.find(({cityId: id}): boolean => id === cityId)
    if (bestCityById) {
      return bestCityById
    }
    const bestCityByName = hits.find(({name}): boolean => name === cityName)
    if (bestCityByName) {
      return bestCityByName
    }
    const bestCityByDepartement = hits.find(({departementId: id}): boolean => id === departementId)
    if (bestCityByDepartement) {
      return bestCityByDepartement
    }
    return hits[0] || {}
  }).then(cityFromSuggestion)
}


// TODO(pascal): Factorize with CitySuggest.
// TODO(pascal): Use this when we're ready to add the activity sector back.

interface ActivitySuggestState {
  name?: string
  value?: bayes.bob.ActivitySector
}


class ActivitySuggest
  extends React.Component<SuggestProps<bayes.bob.ActivitySector>, ActivitySuggestState> {
  public static propTypes = {
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object,
    value: PropTypes.object,
  }

  public state = {
    name: '',
  }

  public static getDerivedStateFromProps({value}, prevState): ActivitySuggestState {
    if (prevState.value === value) {
      return null
    }
    if (!value || !value.naf) {
      return {value}
    }
    return {
      name: value && value.name || '',
      value,
    }
  }

  private renderSuggestion = (suggestion): React.ReactNode => {
    var name = suggestion._highlightResult.name.value
    return `<div>${name}</div>`
  }

  private handleChange = (event, value, suggestion): void => {
    event.stopPropagation()
    const {onChange} = this.props
    if (!suggestion) {
      this.setState({name: value})
      onChange && onChange(null)
      return
    }
    const {naf, name} = suggestion
    this.setState({name})
    onChange && onChange({naf, name})
  }

  public render(): React.ReactNode {
    const {style, onChange: omittedOnChange, value, ...otherProps} = this.props
    const {name} = this.state
    const fieldStyle = {...style}
    if (name && !value) {
      fieldStyle.borderColor = 'red'
    }
    return <AlgoliaSuggest
      {...otherProps} algoliaIndex="activities"
      algoliaApp="K6ACI9BKKT" algoliaApiKey="da4db0bf437e37d6d49cefcb8768c67a"
      displayValue={name} hint={true} autoselect={true} autoselectOnBlur={true}
      hitsPerPage={5} displayKey="name"
      style={fieldStyle}
      onChange={this.handleChange}
      suggestionTemplate={this.renderSuggestion} />
  }
}


export {ActivitySuggest, JobSuggest, CitySuggest, fetchFirstSuggestedJob, jobFromSuggestion,
  fetchJob, fetchCity}
