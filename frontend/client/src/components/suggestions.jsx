import _omit from 'lodash/omit'
import React from 'react'
import PropTypes from 'prop-types'
import algoliasearch from 'algoliasearch/reactnative'
import autocomplete from 'autocomplete.js/dist/autocomplete.min'

import algoliaLogoUrl from 'images/algolia.svg'

require('styles/algolia.css')


// An autocomplete input using Algolia as a backend.
// TODO: Contribute to autocomplete.js.
class AlgoliaSuggest extends React.Component {
  static propTypes = {
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

  componentDidMount() {
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
    const displayFunc = display || ((suggestion) => suggestion[this.props.displayKey])
    const handleSelected = (event, suggestion) => {
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
      this.hint.style.opacity = .5
    }
  }

  componentDidUpdate = (prevProps) => {
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

  render() {
    const {
      inputRef,
      onChange,
      onFocus,
      placeholder,
      style,
    } = this.props
    const wrappedOnChange = onChange && (event => {
      onChange(event, event.target.value, null)
    })
    const handleRef = node => {
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
function genderizeJob(job, gender) {
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

function maybeLowerFirstLetter(word, isLowercased) {
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

// Assemble a Job proto from a JobSuggest suggestion.
function jobFromSuggestion(suggestion) {
  if (!suggestion) {
    return
  }
  var job = {
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


// A Job autocomplete input.
class JobSuggest extends React.Component {
  static algoliaApp = 'K6ACI9BKKT'

  static algoliaApiKey = 'da4db0bf437e37d6d49cefcb8768c67a'

  static algoliaIndex = 'jobs'

  static propTypes = {
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

  static defaultProps = {
    errorDelaySeconds: 3,
  }

  state = {
    jobName: '',
  }

  static getDerivedStateFromProps({gender, isLowercased, value}, prevState) {
    if (prevState.gender === gender && !!prevState.isLowercased === !!isLowercased
      && prevState.value === value) {
      return null
    }
    if (!value || !value.codeOgr) {
      return {
        gender,
        isLowercased,
        value,
      }
    }
    const jobName = maybeLowerFirstLetter(genderizeJob(value, gender), isLowercased) || ''
    return {
      gender,
      isLowercased,
      jobName,
      value,
    }
  }

  maybeLowerFirstLetter = word => maybeLowerFirstLetter(word, this.props.isLowercased)

  renderSuggestion = (suggestion) => {
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

  handleChange = (event, value, suggestion) => {
    event.stopPropagation()
    const {errorDelaySeconds, gender, onChange, onError} = this.props

    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
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

  handleBlur = () => {
    const {onError} = this.props
    this.hasError() && onError && onError()
  }

  hasError = () => {
    return this.state.jobName && !this.props.value
  }

  render() {
    const {gender, style, ...otherProps} = this.props
    const fieldStyle = {...style}
    if (this.hasError()) {
      // TODO: Add a prop for `errorStyle`.
      fieldStyle.borderColor = 'red'
    }

    const displayKey = 'libelleAppellationCourt' + (GENDERIZED_DISPLAY_KEY_SUFFIX[gender] || '')
    const display = suggestion => this.maybeLowerFirstLetter(suggestion[displayKey])
    return <AlgoliaSuggest
      {..._omit(otherProps, ['onChange', 'value'])} algoliaIndex={this.constructor.algoliaIndex}
      algoliaApp={this.constructor.algoliaApp} algoliaApiKey={this.constructor.algoliaApiKey}
      displayValue={this.state.jobName} hint={true} autoselect={true}
      autoselectOnBlur={true} style={fieldStyle} display={display}
      onBlur={this.handleBlur}
      onChange={this.handleChange}
      suggestionTemplate={this.renderSuggestion} />
  }
}


// Return the first job suggested by Algolia for this job name.
function fetchFirstSuggestedJob(jobName) {
  const algoliaClient = algoliasearch(JobSuggest.algoliaApp, JobSuggest.algoliaApiKey)
  const jobIndex = algoliaClient.initIndex(JobSuggest.algoliaIndex)
  return jobIndex.search(jobName).then(results => {
    const firstJobSuggestion = results.hits && results.hits[0]
    if (!firstJobSuggestion) {
      return null
    }
    const firstSuggestedJob = jobFromSuggestion(firstJobSuggestion)
    // TODO(florian): Check that the job has the expected RomeId.
    return firstSuggestedJob
  })
}


const getFirstHitWithCodeOgr = jobId => ({hits}) =>
  hits.find(({codeOgr}) => !jobId || codeOgr === jobId)


function fetchJob(jobName, jobId) {
  const algoliaClient = algoliasearch(JobSuggest.algoliaApp, JobSuggest.algoliaApiKey)
  const jobIndex = algoliaClient.initIndex(JobSuggest.algoliaIndex)
  // First fetch by name.
  return jobIndex.search(jobName).
    // Check the code OGR is right (if given)
    then(getFirstHitWithCodeOgr(jobId)).
    // If nothing found, fetch by code OGR.
    then(hit => hit ? Promise.resolve(hit) :
      jobIndex.search(jobId).then(getFirstHitWithCodeOgr(jobId))).
    then(jobFromSuggestion)
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
}) => {
  const city = {cityId: cityId || objectID,
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
class CitySuggest extends React.Component {
  static algoliaApp = 'K6ACI9BKKT'

  static algoliaApiKey = 'da4db0bf437e37d6d49cefcb8768c67a'

  static algoliaIndex = 'cities'

  static propTypes = {
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object,
    value: PropTypes.object,
  }

  state = {
    cityName: '',
  }

  static getDerivedStateFromProps({value}, prevState) {
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

  renderSuggestion = (suggestion) => {
    var name = suggestion._highlightResult.name.value
    return '<div>' + name + '<span class="aa-group">' +
        suggestion._highlightResult.departementName.value + '</span></div>'
  }

  handleChange = (event, value, suggestion) => {
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

  render() {
    const {style, value, ...otherProps} = this.props
    const {cityName} = this.state
    const fieldStyle = {...style}
    if (cityName && !value) {
      fieldStyle.borderColor = 'red'
    }
    return <AlgoliaSuggest
      {..._omit(otherProps, ['onChange'])} algoliaIndex={CitySuggest.algoliaIndex}
      algoliaApp={CitySuggest.algoliaApp} algoliaApiKey={CitySuggest.algoliaApiKey}
      displayValue={cityName} hint={true} autoselect={true} autoselectOnBlur={true}
      hitsPerPage={5} displayKey="name"
      style={fieldStyle}
      onChange={this.handleChange}
      suggestionTemplate={this.renderSuggestion} />
  }
}


// TODO(cyrille): Factorize with fetchJob.
function fetchCity(cityName, cityId) {
  const algoliaClient = algoliasearch(CitySuggest.algoliaApp, CitySuggest.algoliaApiKey)
  const cityIndex = algoliaClient.initIndex(CitySuggest.algoliaIndex)
  return cityIndex.search(cityName).then(({hits}) => {
    const bestCityById = hits.find(({name, cityId: id}) => name === cityName && id === cityId)
    if (bestCityById) {
      return bestCityById
    }
    const bestCityByName = hits.find(({name}) => name === cityName)
    if (bestCityByName) {
      return bestCityByName
    }
    return hits[0] || {}
  }).then(cityFromSuggestion)
}


// TODO(pascal): Factorize with CitySuggest.
// TODO(pascal): Use this when we're ready to add the activity sector back.

class ActivitySuggest extends React.Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object,
    value: PropTypes.object,
  }

  state = {
    name: '',
  }

  static getDerivedStateFromProps({value}, prevState) {
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

  renderSuggestion = (suggestion) => {
    var name = suggestion._highlightResult.name.value
    return `<div>${name}</div>`
  }

  handleChange = (event, value, suggestion) => {
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

  render() {
    const {style, value, ...otherProps} = this.props
    const {name} = this.state
    const fieldStyle = {...style}
    if (name && !value) {
      fieldStyle.borderColor = 'red'
    }
    return <AlgoliaSuggest
      {..._omit(otherProps, ['onChange'])} algoliaIndex="activities"
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
