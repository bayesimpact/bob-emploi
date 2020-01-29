import _memoize from 'lodash/memoize'
import React, {useCallback, useEffect, useImperativeHandle,
  useMemo, useRef, useState} from 'react'
import PropTypes from 'prop-types'
import algoliasearch, {Response} from 'algoliasearch'
import autocomplete, {Highlighted} from 'autocomplete.js/index'

import algoliaLogoUrl from 'images/algolia.svg'

require('styles/algolia.css')

const ALGOLIA_APP = 'K6ACI9BKKT'
const ALGOLIA_API_KEY = 'da4db0bf437e37d6d49cefcb8768c67a'
const ALGOLIA_CITY_INDEX = 'cities'
const ALGOLIA_JOB_INDEX = 'jobs'


interface AlgoliaSuggestProps<T> {
  algoliaApiKey: string
  algoliaApp: string
  algoliaIndex: string
  autoselect?: boolean
  autoselectOnBlur?: boolean
  display?: (suggestion: T) => string
  displayKey?: keyof T
  displayValue?: string
  hint?: boolean
  hitsPerPage?: number
  inputRef?: (input: HTMLInputElement) => void
  onBlur?: () => void
  onChange?: (
    event: Event|React.ChangeEvent<HTMLInputElement>,
    displaySuggestion: string,
    suggestion: T|null
  ) => void
  onFocus?: () => void
  onSuggestSelect?: (event: Event, displaySuggestion: string, suggestion: T) => void
  placeholder?: string
  style?: React.CSSProperties
  suggestionTemplate?: (suggestion: Highlighted<T>) => string
}


// An autocomplete input using Algolia as a backend.
// TODO: Contribute to autocomplete.js.
class AlgoliaSuggest<T> extends React.Component<AlgoliaSuggestProps<T>> {
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
    const displayFunc = display || ((suggestion: T): string => {
      const {displayKey} = this.props
      return displayKey && (suggestion[displayKey] as unknown as string) || ''
    })
    const handleSelected = (event: Event, suggestion: T): void => {
      const displaySuggestion = displayFunc(suggestion)
      onSuggestSelect && onSuggestSelect(event, displaySuggestion, suggestion)
      onChange && onChange(event, displaySuggestion, suggestion)
    }
    // TODO(pascal): Rething this pattern as this is not compatible with React.
    // Modifying the DOM without React is somewhat OK, but here it changes the
    // main DOM element of this component which confuses React when trying to
    // update the components before it.
    const suggest = autocomplete(this.node.current, extraProps, [
      {
        display: displayFunc,
        source: autocomplete.sources.hits<T>(
          algoliaClient.initIndex(algoliaIndex), {hitsPerPage: hitsPerPage}),
        templates: {
          footer: '<div class="aa-footer">recherche rapide grâce à ' +
            '<img src="' + algoliaLogoUrl + '" alt="Algolia"/></div>',
          suggestion: suggestionTemplate,
        },
      },
    ])
    suggest.on('autocomplete:selected', handleSelected)
    suggest.on('autocomplete:autocompleted', handleSelected)
    if (displayValue) {
      suggest.autocomplete.setVal(displayValue)
    }
    this.suggest = suggest
    // The hint object get styled by the autocomplete lib by copying the
    // initial style of the input. That is a problem because later we allow our
    // component to change this style (so we need to update the hint object
    // manually in componentDidUpdate).
    this.hint = suggest.get(0).previousSibling as HTMLElement
    // As the style is copied over from the input, to make it more look like a
    // hint we change only the opacity.
    if (this.hint) {
      this.hint.style.opacity = '.5'
    }
  }

  public componentDidUpdate = (prevProps: AlgoliaSuggestProps<T>): void => {
    if (this.suggest && this.suggest.autocomplete &&
        prevProps.displayValue !== this.props.displayValue) {
      this.suggest.autocomplete.setVal(this.props.displayValue || '')
    }
    if (this.hint && prevProps.style !== this.props.style) {
      // Update the display property. It would make sense to also update other
      // properties but it's quite hard as the hint object is not managed by
      // React and we have no use for it for now.
      if ((prevProps.style && prevProps.style.display) !==
          (this.props.style && this.props.style.display)) {
        this.hint.style.display = this.props.style && this.props.style.display || 'initial'
      }
    }
  }

  private hint?: HTMLElement

  private suggest?: ReturnType<typeof autocomplete>

  private node: React.MutableRefObject<HTMLInputElement> =
  React.createRef() as React.MutableRefObject<HTMLInputElement>

  private handleRefs = (node: HTMLInputElement): void => {
    const {inputRef} = this.props
    this.node.current = node
    if (!inputRef) {
      return
    }
    if (typeof inputRef === 'function') {
      inputRef(node)
      return
    }
    (inputRef as React.MutableRefObject<HTMLInputElement>).current = node
  }

  public focus(): void {
    this.node.current && this.node.current.focus()
  }

  public render(): React.ReactNode {
    const {
      onChange,
      onFocus,
      placeholder,
      style,
    } = this.props
    const wrappedOnChange = onChange && ((event: React.ChangeEvent<HTMLInputElement>): void => {
      onChange(event, event.target.value, null)
    })
    // TODO(pascal): Also style with focus and hover effects like the other inputs.
    return <input
      onChange={wrappedOnChange} ref={this.handleRefs} style={style} placeholder={placeholder}
      onFocus={onFocus} />
  }
}


// Genderize a job name from `store/job.js`.
// TODO: Find a way to avoid this duplication of code.
function genderizeJob(job: bayes.bob.Job|null, gender?: string): string {
  if (!job) {
    return ''
  }
  if (gender === 'FEMININE') {
    return job.feminineName || job.name || ''
  }
  if (gender === 'MASCULINE') {
    return job.masculineName || job.name || ''
  }
  return job.name || ''
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
  readonly libelleAppellationCourtFeminin: string
  readonly libelleAppellationCourtMasculin: string
  readonly libelleAppellationLong: string
  readonly libelleAppellationLongFeminin?: string
  readonly libelleAppellationLongMasculin?: string
}


type Mutable<T> = {-readonly [K in keyof T]?: T[K]}


// Assemble a Job proto from a JobSuggest suggestion.
function jobFromSuggestion(suggestion?: JobSuggestion): bayes.bob.Job|null {
  if (!suggestion) {
    return null
  }
  const job: Mutable<bayes.bob.Job> = {
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


const GENDERIZED_DISPLAY_KEY = {
  FEMININE: 'libelleAppellationCourtFeminin',
  MASCULINE: 'libelleAppellationCourtMasculin',
  UNKNOWN_GENDER: 'libelleAppellationCourt',
} as const


interface GenderizedSuggestion {
  readonly libelleAppellationCourt: string
  readonly libelleAppellationCourtFeminin: string
  readonly libelleAppellationCourtMasculin: string
}


function createDisplay<T extends GenderizedSuggestion>(
  isLowercased: boolean, gender?: bayes.bob.Gender): ((s: T) => string) {
  return (suggestion: T): string => {
    const displayKey =
      gender && GENDERIZED_DISPLAY_KEY[gender] || 'libelleAppellationCourt'
    return maybeLowerFirstLetter(suggestion[displayKey], isLowercased)
  }
}
const handleDisplay = _memoize(
  createDisplay,
  (isLowercased: boolean, gender: bayes.bob.Gender): string => (isLowercased ? 'l' : 'L') + gender)


interface SuggestConfig<T, SuggestT> {
  errorDelaySeconds?: number
  gender?: bayes.bob.Gender
  hitsPerPage?: number
  inputRef?: (input: HTMLInputElement) => void
  isLowercased?: boolean
  onChange?: (value: T|null) => void
  onError?: () => void
  onFocus?: () => void
  onSuggestSelect?: (event: Event, displaySuggestion: string, suggestion: SuggestT) => void
  placeholder?: string
  style?: React.CSSProperties
  value?: T
}


type SuggestProps<T, SuggestT> = SuggestConfig<T, SuggestT>


// A Job autocomplete input.
const JobSuggestBase:
React.RefForwardingComponent<Focusable, SuggestProps<bayes.bob.Job, JobSuggestion>> =
(props: SuggestProps<bayes.bob.Job, JobSuggestion>, ref: React.Ref<Focusable>):
React.ReactElement => {
  const {errorDelaySeconds = 3, gender, isLowercased, style, onChange,
    onError, value, ...otherProps} = props
  const [jobName, setJobName] = useState('')
  const hasError = useMemo((): boolean => !!jobName && !value, [jobName, value])

  useEffect((): void => {
    if (value && value.codeOgr) {
      setJobName(maybeLowerFirstLetter(genderizeJob(value, gender), !!isLowercased))
    }
  }, [gender, isLowercased, value])

  const inputRef = useRef<AlgoliaSuggest<JobSuggestion>>(null)
  const timeout = useRef<ReturnType<typeof setTimeout>|null>(null)

  const renderSuggestion = useCallback(
    (suggestion: Highlighted<JobSuggestion>): string => {
      const suggestionResult = suggestion && suggestion._highlightResult
      const defaultName = suggestionResult && suggestionResult.libelleAppellationLong &&
      suggestionResult.libelleAppellationLong.value || ''
      const feminineName = suggestionResult && suggestionResult.libelleAppellationLongFeminin &&
      suggestionResult.libelleAppellationLongFeminin.value
      const masculineName = suggestionResult && suggestionResult.libelleAppellationLongMasculin &&
      suggestionResult.libelleAppellationLongMasculin.value
      const name = gender === 'FEMININE' ? feminineName || defaultName : gender === 'MASCULINE' ?
        masculineName || defaultName : defaultName
      const rome = suggestionResult && suggestionResult.libelleRome &&
      suggestionResult.libelleRome.value || ''
      return '<div>' + maybeLowerFirstLetter(name, !!isLowercased) + '<span class="aa-group">' +
          rome + '</span></div>'
    }, [gender, isLowercased])

  const handleChange = useCallback((
    event: Event|React.ChangeEvent<HTMLInputElement>,
    value: string,
    suggestion: JobSuggestion|null,
  ): void => {
    event.stopPropagation()
    if (timeout.current) {
      clearTimeout(timeout.current)
    }
    timeout.current = setTimeout((): void => {
      hasError && onError && onError()
    }, errorDelaySeconds * 1000)

    if (!suggestion) {
      setJobName(value)
      onChange && onChange(null)
      return
    }
    const job = jobFromSuggestion(suggestion)
    onChange && onChange(job)
  }, [errorDelaySeconds, hasError, onChange, onError])

  const handleBlur = useCallback((): void => {
    hasError && onError && onError()
  }, [hasError, onError])

  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => {
      inputRef && inputRef.current && inputRef.current.focus()
    },
  }))
  // TODO(marielaure): Change the color here to a theme color.
  // TODO(cyrille): Add a prop for `errorStyle`.
  const fieldStyle = useMemo(() => ({
    ...style,
    ...hasError && {borderColor: 'red'},
  }), [hasError, style])

  return <AlgoliaSuggest<JobSuggestion>
    {...otherProps}
    algoliaIndex={ALGOLIA_JOB_INDEX}
    algoliaApp={ALGOLIA_APP} algoliaApiKey={ALGOLIA_API_KEY}
    displayValue={jobName} hint={true} autoselect={true}
    autoselectOnBlur={true} style={fieldStyle} display={handleDisplay(!!isLowercased, gender)}
    onBlur={handleBlur} onChange={handleChange} ref={inputRef}
    suggestionTemplate={renderSuggestion} />
}
const JobSuggest = React.forwardRef(JobSuggestBase)
JobSuggest.propTypes = {
  // Delay the calling of `onError` by this amount after the user stopped typing.
  // Defaults to 3 seconds.
  errorDelaySeconds: PropTypes.number,
  // The gender to display only one of the names where job names are
  // genderized.
  gender: PropTypes.oneOf(['FEMININE', 'MASCULINE', 'UNKNOWN']),
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

// Return the first job suggested by Algolia for this job name.

function fetchFirstSuggestedJob(jobName: string): Promise<bayes.bob.Job|null> {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const jobIndex = algoliaClient.initIndex(ALGOLIA_JOB_INDEX)
  return jobIndex.search(jobName).then((results): bayes.bob.Job|null => {
    const firstJobSuggestion = results.hits && results.hits[0]
    if (!firstJobSuggestion) {
      return null
    }
    const firstSuggestedJob = jobFromSuggestion(firstJobSuggestion)
    // TODO(florian): Check that the job has the expected RomeId.
    return firstSuggestedJob
  })
}


const getFirstHitWithCodeOgr = (jobId: string):
((h: Response<JobSuggestion>) => JobSuggestion|undefined) =>
  ({hits}: Response<JobSuggestion>): JobSuggestion|undefined =>
    hits.find(({codeOgr}: JobSuggestion): boolean => !jobId || codeOgr === jobId)


// TODO(pascal): Consider cleaning that up, if unused.
function fetchJob(jobName: string, jobId: string): Promise<bayes.bob.Job|null> {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const jobIndex = algoliaClient.initIndex(ALGOLIA_JOB_INDEX)
  // First fetch by name.
  return jobIndex.search(jobName).
    // Check the code OGR is right (if given)
    then(getFirstHitWithCodeOgr(jobId)).
    // If nothing found, fetch by code OGR.
    then((hit): Promise<JobSuggestion|undefined> => hit ? Promise.resolve(hit) :
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

export interface Focusable {
  focus: () => void
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


// A City autocomplete input.
const CitySuggestBase:
React.RefForwardingComponent<Focusable, SuggestConfig<bayes.bob.FrenchCity, CitySuggestion>> =
(props: SuggestConfig<bayes.bob.FrenchCity, CitySuggestion>,
  ref: React.Ref<Focusable>): React.ReactElement => {
  const {style, onChange, value, ...otherProps} = props
  const [cityName, setCityName] = useState('')
  const inputRef = useRef<AlgoliaSuggest<CitySuggestion>>(null)

  useEffect((): void => {
    if (value && value.cityId && value.name) {
      setCityName(value.name)
    }
  }, [value])

  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => {
      inputRef && inputRef.current && inputRef.current.focus()
    },
  }))

  const renderSuggestion = useCallback((suggestion): string => {
    const name = suggestion._highlightResult.name.value
    return '<div>' + name + '<span class="aa-group">' +
        suggestion._highlightResult.departementName.value + '</span></div>'
  }, [])

  const handleChange = useCallback((event, value, suggestion): void => {
    event.stopPropagation()
    if (!suggestion) {
      setCityName(value)
      onChange && onChange(null)
      return
    }
    const city = cityFromSuggestion(suggestion)
    // Keep in sync with frontend/server/geo.py
    setCityName(city.name || '')
    onChange && onChange(city)
  }, [onChange])

  // TODO(marielaure): Change the color here to a theme color.
  const fieldStyle = useMemo(() => ({
    ...style,
    ...cityName && !value && {borderColor: 'red'},
  }), [style, cityName, value])

  return <AlgoliaSuggest
    {...otherProps} algoliaIndex={ALGOLIA_CITY_INDEX}
    algoliaApp={ALGOLIA_APP} algoliaApiKey={ALGOLIA_API_KEY}
    displayValue={cityName} hint={true} autoselect={true} autoselectOnBlur={true}
    hitsPerPage={5} displayKey="name" ref={inputRef as React.Ref<AlgoliaSuggest<CitySuggestion>>}
    style={fieldStyle}
    onChange={handleChange}
    suggestionTemplate={renderSuggestion} />
}
const CitySuggest = React.forwardRef(CitySuggestBase)
CitySuggest.propTypes = {
  onChange: PropTypes.func.isRequired,
  style: PropTypes.object,
  value: PropTypes.object,
}



// TODO(cyrille): Factorize with fetchJob.
function fetchCity(location: bayes.bob.FrenchCity): Promise<bayes.bob.FrenchCity> {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const {departementId, cityId, name: cityName} = location
  const cityIndex = algoliaClient.initIndex(ALGOLIA_CITY_INDEX)
  const query = cityName || departementId
  if (!query) {
    return Promise.resolve({})
  }
  return cityIndex.search(query).then(({hits}): CitySuggestion => {
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


interface ActivitySuggestion {
  naf: string
  name: string
}


// TODO(pascal): Factorize with CitySuggest.
// TODO(pascal): Use this when we're ready to add the activity sector back.
const ActivitySuggest: React.FC<SuggestConfig<bayes.bob.ActivitySector, ActivitySuggestion>> =
  (props: SuggestConfig<bayes.bob.ActivitySector, ActivitySuggestion>): React.ReactElement => {
    const {style, onChange, value, ...otherProps} = props
    const [name, setName] = useState('')
    useEffect((): void => {
      if (value && value.naf && value.name) {
        setName(value.name)
      }
    }, [value])

    const renderSuggestion = useCallback((suggestion: Highlighted<ActivitySuggestion>): string => {
      const name = suggestion._highlightResult.name.value
      return `<div>${name}</div>`
    }, [])

    const handleChange = useCallback((event, value, suggestion: ActivitySuggestion|null): void => {
      event.stopPropagation()
      if (!suggestion) {
        setName(value)
        onChange && onChange(null)
        return
      }
      const {naf, name} = suggestion
      setName(name)
      onChange && onChange({naf, name})
    }, [onChange])

    const fieldStyle = useMemo((): React.CSSProperties|undefined => {
      if (!name || value) {
        return style
      }
      return {
        ...style,
        borderColor: 'red',
      }
    }, [name, style, value])
    return <AlgoliaSuggest<ActivitySuggestion>
      {...otherProps} algoliaIndex="activities"
      algoliaApp={ALGOLIA_APP} algoliaApiKey={ALGOLIA_API_KEY}
      displayValue={name} hint={true} autoselect={true} autoselectOnBlur={true}
      hitsPerPage={5} displayKey="name"
      style={fieldStyle}
      onChange={handleChange}
      suggestionTemplate={renderSuggestion} />
  }
ActivitySuggest.propTypes = {
  onChange: PropTypes.func.isRequired,
  style: PropTypes.object,
  value: PropTypes.object,
}


export {ActivitySuggest, JobSuggest, CitySuggest, fetchFirstSuggestedJob, jobFromSuggestion,
  fetchJob, fetchCity}
