import {Hit, SearchOptions, SearchResponse} from '@algolia/client-search'
import algoliasearch, {SearchIndex} from 'algoliasearch'
import autocomplete from 'autocomplete.js/index'
import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useImperativeHandle,
  useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {useAsynceffect} from 'store/promise'

import algoliaLogoUrl from 'images/algolia.svg'

import 'styles/algolia.css'

const ALGOLIA_APP = 'K6ACI9BKKT'
const ALGOLIA_API_KEY = 'da4db0bf437e37d6d49cefcb8768c67a'


interface AlgoliaSuggestProps<T> {
  // API key of the Algolia app.
  algoliaApiKey: string
  // ID of the Algolia app.
  algoliaApp: string
  // Name of the index to use in the Algolia app.
  algoliaIndex: string
  autoselect?: boolean
  autoselectOnBlur?: boolean
  disabled?: boolean
  // A function to use on suggestion to compute the visible input. Overrides
  // displayKey.
  display?: (suggestion: T) => string
  // Key to use as visible input when a suggestion is selected. Is overriden
  // by display.
  displayKey?: keyof T
  // A value to set inside the field programatically.
  displayValue?: string
  hint?: boolean
  // Numbers of suggestions shown when typing.
  hitsPerPage?: number
  onBlur?: () => void
  // Function called when the value changed either when the text changes or
  // when a suggestion is selected. It takes 3 arguments: the browser event,
  // the displayed value, and in the case of a suggestion selected, the
  // suggestion object.
  onChange?: (
    event: Event|React.ChangeEvent<HTMLInputElement>,
    displaySuggestion: string,
    suggestion: T|null
  ) => void
  onFocus?: () => void
  // Function called when a selection is suggested. It takes 3 arguments:
  // the event, the displayed value, and the suggestion object.
  onSuggestSelect?: (event: Event, displaySuggestion: string, suggestion: T) => void
  // A string to display in the input field when no text is entered.
  placeholder?: string
  // Style to use for the input field.
  style?: React.CSSProperties
  // Rendering function for each suggestion.
  suggestionTemplate?: (suggestion: Hit<T>) => string
}

const mockTranslation = (toTranslate: string): string => toTranslate


const newHitsSource = <T extends unknown>(
  index: SearchIndex,
  searchOptions?: SearchOptions,
) => {
  return async (
    query: string,
    callback: (hits: readonly Hit<T>[], res?: SearchResponse<T>) => void,
  ): Promise<void> => {
    try {
      const res = await index.search<T>(query, searchOptions)
      callback(res.hits, res)
    } catch {
      callback([])
    }
  }
}


// An autocomplete input using Algolia as a backend.
// TODO: Contribute to autocomplete.js.
const AlgoliaSuggestBase = <T extends Record<string, unknown>>(
  props: AlgoliaSuggestProps<T>, ref: React.Ref<Focusable>,
): React.ReactElement => {
  const {
    algoliaApiKey,
    algoliaApp,
    algoliaIndex,
    autoselect,
    autoselectOnBlur,
    disabled,
    display,
    displayKey,
    displayValue,
    hint,
    hitsPerPage,
    onBlur,
    onChange,
    onFocus,
    onSuggestSelect,
    placeholder,
    style,
    suggestionTemplate,
  } = props

  const [suggest, setSuggest] = useState<ReturnType<typeof autocomplete>|undefined>()
  const cleanDisplayValue = displayValue || ''
  useEffect((): void => {
    suggest?.autocomplete?.setVal(cleanDisplayValue)
  }, [cleanDisplayValue, suggest])

  const styleDisplay = style?.display || 'initial'
  const hintRef = useRef<HTMLElement>()
  useEffect((): void => {
    if (hintRef.current) {
      hintRef.current.style.display = styleDisplay
    }
  }, [styleDisplay])

  const displayKeyRef = useRef(displayKey)
  useEffect((): void => {
    displayKeyRef.current = displayKey
  }, [displayKey])

  const displayKeyFunc = useCallback(((suggestion: T): string => {
    const displayKey = displayKeyRef.current
    return displayKey && (suggestion[displayKey] as unknown as string) || ''
  }), [])
  const displayFunc = display || displayKeyFunc

  const node = useRef<HTMLInputElement>(null)

  const {ready, t: translate} = useTranslation()
  const t = ready ? translate : mockTranslation
  useEffect((): void => {
    const algoliaClient = algoliasearch(algoliaApp, algoliaApiKey)
    if (!node.current) {
      return
    }
    const algoliaFooter = t('recherche rapide grâce à {{Algolia}}', {
      Algolia: `<img src="${algoliaLogoUrl}" alt="Algolia" />`,
    })
    // TODO(pascal): Rethink this pattern as this is not compatible with React.
    // Modifying the DOM without React is somewhat OK, but here it changes the
    // main DOM element of this component which confuses React when trying to
    // update the components before it.
    const newSuggest = autocomplete(node.current, {autoselect, autoselectOnBlur, hint}, [
      {
        display: displayFunc,
        source: newHitsSource<T>(algoliaClient.initIndex(algoliaIndex), {hitsPerPage}),
        templates: {
          footer: `<div class="aa-footer">${algoliaFooter}</div>`,
          suggestion: suggestionTemplate,
        },
      },
    ])
    setSuggest(newSuggest)
    // The hint object get styled by the autocomplete lib by copying the
    // initial style of the input. That is a problem because later we allow our
    // component to change this style (so we need to update the hint object
    // manually in componentDidUpdate).
    hintRef.current = newSuggest.get(0).previousSibling as HTMLElement
    // As the style is copied over from the input, to make it more look like a
    // hint we change only the opacity.
    if (hintRef.current) {
      hintRef.current.style.opacity = '.5'
    }
  }, [
    algoliaApiKey, algoliaApp, algoliaIndex, displayFunc, hitsPerPage, suggestionTemplate,
    autoselect, autoselectOnBlur, hint, t,
  ])

  useEffect((): void => {
    if (!suggest) {
      return
    }
    const handleSelected = (event: Event, suggestion: T): void => {
      const displaySuggestion = displayFunc(suggestion)
      onSuggestSelect?.(event, displaySuggestion, suggestion)
      onChange?.(event, displaySuggestion, suggestion)
    }
    suggest.on('autocomplete:selected', handleSelected)
    suggest.on('autocomplete:autocompleted', handleSelected)
  }, [displayFunc, onChange, onSuggestSelect, suggest])

  useImperativeHandle(ref, (): Focusable => ({
    focus: (): void => node.current?.focus(),
  }))

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange?.(event, event.target.value, null)
  }, [onChange])
  const wrappedOnChange = onChange && handleChange

  // TODO(pascal): Also style with focus and hover effects like the other inputs.
  return <input
    onChange={wrappedOnChange} ref={node} style={style} placeholder={placeholder}
    onFocus={onFocus} disabled={disabled} onBlur={onBlur} />
}
// TODO(pascal): Remove the type assertion once we understand how
// https://github.com/Microsoft/TypeScript/issues/9366 should work.
const AlgoliaSuggest = React.forwardRef(AlgoliaSuggestBase) as <T>(
  props: AlgoliaSuggestProps<T> & {ref?: React.Ref<Focusable>},
) => React.ReactElement


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
  readonly jobGroupId?: string
  readonly jobGroupName?: string
  readonly name?: string
  readonly objectID: string
}


type Mutable<T> = {-readonly [K in keyof T]?: T[K]}


// Assemble a Job proto from a JobSuggest suggestion.
function jobFromSuggestion(suggestion?: JobSuggestion): bayes.bob.Job|null {
  if (!suggestion) {
    return null
  }
  const job: Mutable<bayes.bob.Job> = {
    codeOgr: suggestion.codeOgr || suggestion.objectID,
    jobGroup: {
      name: suggestion.jobGroupName || suggestion.libelleRome,
      romeId: suggestion.jobGroupId || suggestion.codeRome,
    },
    name: suggestion.name || suggestion.libelleAppellationCourt,
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


interface SuggestConfig<T, SuggestT> {
  algoliaIndex?: string
  disabled?: boolean
  errorDelaySeconds?: number
  gender?: bayes.bob.Gender
  hitsPerPage?: number
  isLowercased?: boolean
  onBlur?: () => void
  onChange?: (value: T|null) => void
  onError?: () => void
  onFocus?: () => void
  onSuggestSelect?: (event: Event, displaySuggestion: string, suggestion: SuggestT) => void
  placeholder?: string
  style?: React.CSSProperties
  // Set or change to update the text value programatically.
  textValue?: string
  value?: T
}


type SuggestProps<T, SuggestT> = SuggestConfig<T, SuggestT>


// A Job autocomplete input.
const JobSuggestBase:
React.RefForwardingComponent<Focusable, SuggestProps<bayes.bob.Job, JobSuggestion>> =
(props: SuggestProps<bayes.bob.Job, JobSuggestion>, ref: React.Ref<Focusable>):
React.ReactElement => {
  const {errorDelaySeconds = 3, gender, isLowercased, style, onChange,
    onError, textValue, value, ...otherProps} = props
  const [jobName, setJobName] = useState(textValue || '')
  const hasError = useMemo((): boolean => !!jobName && !value, [jobName, value])

  useEffect((): void => {
    if (value && value.codeOgr) {
      setJobName(maybeLowerFirstLetter(genderizeJob(value, gender), !!isLowercased))
    } else if (typeof textValue === 'string') {
      setJobName(textValue)
    }
  }, [gender, isLowercased, textValue, value])

  const timeout = useRef<number|undefined>(undefined)

  const renderSuggestion = useCallback(
    (suggestion: Hit<JobSuggestion>): string => {
      const suggestionResult = suggestion && suggestion._highlightResult
      const defaultName = suggestionResult && suggestionResult.libelleAppellationLong &&
      suggestionResult.libelleAppellationLong.value ||
      suggestionResult && suggestionResult.name && suggestionResult.name.value || ''
      const feminineName = suggestionResult && suggestionResult.libelleAppellationLongFeminin &&
      suggestionResult.libelleAppellationLongFeminin.value
      const masculineName = suggestionResult && suggestionResult.libelleAppellationLongMasculin &&
      suggestionResult.libelleAppellationLongMasculin.value
      const name = gender === 'FEMININE' ? feminineName || defaultName : gender === 'MASCULINE' ?
        masculineName || defaultName : defaultName
      const rome = suggestionResult && suggestionResult.libelleRome &&
      suggestionResult.libelleRome.value ||
      suggestionResult && suggestionResult.jobGroupName && suggestionResult.jobGroupName.value || ''
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
      window.clearTimeout(timeout.current)
    }
    timeout.current = window.setTimeout((): void => {
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

  // TODO(cyrille): Add a prop for `errorStyle`.
  const fieldStyle = useMemo(() => ({
    ...style,
    ...hasError && {borderColor: colors.RED_PINK},
  }), [hasError, style])

  const display = useCallback((suggestion: JobSuggestion): string => {
    const displayKey =
      gender && GENDERIZED_DISPLAY_KEY[gender] || 'libelleAppellationCourt'
    return maybeLowerFirstLetter(suggestion[displayKey], !!isLowercased)
  }, [isLowercased, gender])

  return <AlgoliaSuggest<JobSuggestion>
    {...otherProps}
    algoliaIndex={config.jobSuggestAlgoliaIndex}
    algoliaApp={ALGOLIA_APP} algoliaApiKey={ALGOLIA_API_KEY}
    displayValue={jobName} hint={true} autoselect={true}
    autoselectOnBlur={true} style={fieldStyle} display={display}
    onBlur={handleBlur} onChange={handleChange} ref={ref}
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

async function fetchFirstSuggestedJob(jobName: string): Promise<bayes.bob.Job|null> {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const jobIndex = algoliaClient.initIndex(config.jobSuggestAlgoliaIndex)
  const results = await jobIndex.search<JobSuggestion>(jobName)
  const firstJobSuggestion = results.hits && results.hits[0]
  if (!firstJobSuggestion) {
    return null
  }
  const firstSuggestedJob = jobFromSuggestion(firstJobSuggestion)
  // TODO(florian): Check that the job has the expected RomeId.
  return firstSuggestedJob
}


const getFirstHitWithCodeOgr = (jobId: string, {hits}: SearchResponse<JobSuggestion>):
JobSuggestion|undefined =>
  hits.find(({codeOgr}: JobSuggestion): boolean => !jobId || codeOgr === jobId)


// TODO(pascal): Consider cleaning that up, if unused.
async function fetchJob(jobName: string, jobId: string): Promise<bayes.bob.Job|null> {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const jobIndex = algoliaClient.initIndex(config.jobSuggestAlgoliaIndex)

  const getFirstJob = async (term: string): Promise<bayes.bob.Job|null> => {
    const results = await jobIndex.search<JobSuggestion>(term)
    const hit = getFirstHitWithCodeOgr(jobId, results)
    return (hit === undefined ? null : hit) && jobFromSuggestion(hit)
  }

  return await getFirstJob(jobName) || await getFirstJob(jobId)
}


interface CitySuggestion {
  admin1Code?: string
  admin1Name?: string
  admin2Code?: string
  admin2Name?: string
  cityId?: string
  departementId?: string
  departementName?: string
  departementPrefix?: string
  name: string
  objectID: string
  population: number
  regionId?: string
  regionName?: string
  transport?: number
  urban?: number
  zipCode?: string
}

export interface Focusable {
  focus: () => void
}


const cityFromSuggestion = ({
  admin1Code,
  admin1Name,
  admin2Code,
  admin2Name,
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
    departementId: departementId || admin2Code,
    departementName: departementName || admin2Name,
    departementPrefix,
    name,
    population,
    postcodes: zipCode,
    regionId: regionId || admin1Code,
    regionName: regionName || admin1Name,
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

  useEffect((): void => {
    if (value && value.cityId && value.name) {
      setCityName(value.name)
    }
  }, [value])

  const renderSuggestion = useCallback((suggestion): string => {
    const name = suggestion._highlightResult.name.value
    return '<div>' + name + '<span class="aa-group">' +
        (suggestion._highlightResult.departementName?.value ||
          suggestion._highlightResult.admin1Name?.value) + '</span></div>'
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

  const fieldStyle = useMemo(() => ({
    ...style,
    ...cityName && !value && {borderColor: colors.RED_PINK},
  }), [style, cityName, value])

  return <AlgoliaSuggest<CitySuggestion>
    {...otherProps} algoliaIndex={config.citySuggestAlgoliaIndex}
    algoliaApp={ALGOLIA_APP} algoliaApiKey={ALGOLIA_API_KEY}
    displayValue={cityName} hint={true} autoselect={true} autoselectOnBlur={true}
    hitsPerPage={5} displayKey="name" ref={ref}
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

function getCitySuggestionFromResponse(
  {hits}: SearchResponse<CitySuggestion>, location: bayes.bob.FrenchCity,
): CitySuggestion {
  const {departementId, cityId, name: cityName} = location
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
}

// TODO(cyrille): Factorize with fetchJob.
async function fetchCity(location: bayes.bob.FrenchCity): Promise<bayes.bob.FrenchCity> {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const {departementId, name: cityName} = location
  const cityIndex = algoliaClient.initIndex(config.citySuggestAlgoliaIndex)
  const query = cityName || departementId
  if (!query) {
    return {}
  }

  const results = await cityIndex.search<CitySuggestion>(query)
  const suggestion = getCitySuggestionFromResponse(results, location)
  return cityFromSuggestion(suggestion)
}


interface ActivitySuggestion {
  naf: string
  name: string
}

// DEPARTEMENT SUGGESTIONS \\
interface DepartementSuggestion {
  admin2Code?: string
  admin2Name?: string
  departementId?: string
  departementName?: string
  placeholder?: string
}

export type Departement = {
  id?: string
  name?: string
}

const displayDepartement = (departement?: Departement): string => {
  const {id = '', name = ''} = departement || {}
  return id && name ? `${id} - ${name}` : id
}

const departementFromSuggestion = ({
  admin2Code,
  admin2Name,
  departementId,
  departementName,
}: DepartementSuggestion): Departement => {
  return {
    id: departementId || admin2Code,
    name: departementName || admin2Name,
  }
}
// A Departement autocomplete input.
const DepartementSuggestBase:
React.RefForwardingComponent<Focusable, SuggestConfig<Departement, DepartementSuggestion>> =
(props: SuggestConfig<Departement, DepartementSuggestion>,
  ref: React.Ref<Focusable>): React.ReactElement => {
  const {style, onChange, placeholder, value, ...otherProps} = props
  const [departementDisplay, setDepartementDisplay] = useState(displayDepartement(value))

  const {t} = useTranslation()

  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    if (!value?.id) {
      return
    }
    if (value.name) {
      setDepartementDisplay(displayDepartement(value))
      return
    }
    const departement = await fetchDepartement(value.id)
    if (departement && !checkIfCanceled()) {
      setDepartementDisplay(displayDepartement(departement))
    }
  }, [value])

  const renderSuggestion = useCallback((suggestion): string => {
    const id = suggestion._highlightResult.departementId?.value
    const name = suggestion._highlightResult.departementName?.value
    return `<div>${id} - ${name}</div>`
  }, [])

  const handleChange = useCallback((event, value, suggestion): void => {
    event.stopPropagation()
    if (!suggestion) {
      setDepartementDisplay(value)
      onChange && onChange(null)
      return
    }
    const departement = departementFromSuggestion(suggestion)
    setDepartementDisplay(displayDepartement(departement))

    onChange && onChange(departement)
  }, [onChange])

  const fieldStyle = useMemo(() => ({
    ...style,
    ...departementDisplay && !value && {borderColor: colors.RED_PINK},
  }), [style, departementDisplay, value])

  return <AlgoliaSuggest<DepartementSuggestion>
    {...otherProps} algoliaIndex={config.departementSuggestAlgoliaIndex}
    algoliaApp={ALGOLIA_APP} algoliaApiKey={ALGOLIA_API_KEY}
    displayValue={departementDisplay} hint={true} autoselect={true} autoselectOnBlur={true}
    hitsPerPage={5} displayKey="departementName" ref={ref}
    style={fieldStyle}
    onChange={handleChange}
    suggestionTemplate={renderSuggestion}
    placeholder={
      placeholder || t('Saisissez le nom ou le code postal de votre département')} />
}
const DepartementSuggest = React.forwardRef(DepartementSuggestBase)
DepartementSuggest.propTypes = {
  onChange: PropTypes.func.isRequired,
  style: PropTypes.object,
  value: PropTypes.object,
}

function getDepartementSuggestionFromResponse(
  {hits}: SearchResponse<DepartementSuggestion>, departementId: string,
): DepartementSuggestion {
  const bestDepartementById = hits.find(({departementId: id}): boolean => id === departementId)
  if (bestDepartementById) {
    return bestDepartementById
  }
  return hits[0] || {}
}
// TODO(cyrille): Factorize with fetchJob.
const fetchDepartement = _memoize(async (departementId: string): Promise<Departement> => {
  const algoliaClient = algoliasearch(ALGOLIA_APP, ALGOLIA_API_KEY)
  const departementIndex = algoliaClient.initIndex(config.departementSuggestAlgoliaIndex)
  const query = departementId
  if (!query) {
    return {}
  }
  const results = await departementIndex.search<DepartementSuggestion>(query)
  const suggestion = getDepartementSuggestionFromResponse(results, departementId)
  return departementFromSuggestion(suggestion)
})


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

    const renderSuggestion = useCallback((suggestion: Hit<ActivitySuggestion>): string => {
      const name = suggestion._highlightResult?.name?.value || suggestion.name
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

export {ActivitySuggest, JobSuggest, CitySuggest, DepartementSuggest, fetchFirstSuggestedJob,
  jobFromSuggestion, fetchJob, fetchCity, fetchDepartement}
