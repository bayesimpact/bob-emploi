import React from 'react'
import algoliasearch from 'algoliasearch/reactnative'
import autocomplete from 'autocomplete.js/dist/autocomplete.min'

require('styles/algolia.css')
const algoliaLogoUrl = require('images/algolia.svg')

// An autocomplete input using Algolia as a backend.
// TODO: Contribute to autocomplete.js.
class AlgoliaSuggest extends React.Component {
  static propTypes = {
    // API key of the Algolia app.
    algoliaApiKey: React.PropTypes.string.isRequired,
    // ID of the Algolia app.
    algoliaApp: React.PropTypes.string.isRequired,
    // Name of the index to use in the Algolia app.
    algoliaIndex: React.PropTypes.string.isRequired,
    // A function to use on suggestion to compute the visible input. Overrides
    // displayKey.
    display: React.PropTypes.func,
    // Key to use as visible input when a suggestion is selected. Is overriden
    // by display.
    displayKey: React.PropTypes.string,
    // A value to set inside the field programatically.
    displayValue: React.PropTypes.string,
    // Numbers of suggestions shown when typing.
    hitsPerPage: React.PropTypes.number,
    // A callback ref to set on the input field.
    inputRef: React.PropTypes.func,
    // Function called when the value changed either when the text changes or
    // when a suggestion is selected. It takes 3 arguments: the browser event,
    // the displayed value, and in the case of a suggestion selected, the
    // suggestion object.
    onChange: React.PropTypes.func,
    // Function called when a selection is suggested. It takes 3 arguments:
    // the event, the displayed value, and the suggestion object.
    onSuggestSelect: React.PropTypes.func,
    // A string to display in the input field when no text is entered.
    placeholder: React.PropTypes.string,
    // Style to use for the input field.
    style: React.PropTypes.object,
    // Rendering function for each suggestion.
    suggestionTemplate: React.PropTypes.func,
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
          (this.props.style.display && this.props.style.display)) {
        this.hint.style.display = this.props.style.display
      }
    }
  }

  render() {
    const {
      inputRef,
      onChange,
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
        onChange={wrappedOnChange} ref={handleRef} style={style} placeholder={placeholder} />
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


const GENDERIZED_DISPLAY_KEY_SUFFIX = {
  'FEMININE': 'Feminin',
  'MASCULINE': 'Masculin',
}


// A Job autocomplete input.
class JobSuggest extends React.Component {
  static propTypes = {
    // Delay the calling of `onError` by this amount after the user stopped typing.
    // Defaults to 3 seconds.
    errorDelaySeconds: React.PropTypes.number,
    // The gender to display only one of the names where job names are
    // genderized.
    gender: React.PropTypes.oneOf(['FEMININE', 'MASCULINE']),
    // If true, will display job names starting with a lower case letter
    // instead of upper case. This only changes the display, not the values in
    // the job object if it comes from a suggestion.
    lowercase: React.PropTypes.bool,
    // Function called when the value changed either when the text changes or
    // when a suggestion is selected. It takes 1 argument: the job that is
    // selected if it's a valid job, null otherwise.
    onChange: React.PropTypes.func.isRequired,
    // Function called in case no result could be found after the user stopped typing
    // for `errorDelaySeconds` seconds.
    onError: React.PropTypes.func,
    style: React.PropTypes.object,
    value: React.PropTypes.object,
  };
  static defaultProps = {
    errorDelaySeconds: 3,
  };

  componentWillMount() {
    this.reset()
  }

  reset() {
    const {value, gender} = this.props
    this.setState({
      jobName: genderizeJob(value, gender),
    })
  }

  // Assemble a Job proto from a JobSuggest suggestion.
  jobFromSuggestion(suggestion) {
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

  maybeLowerFirstLetter = word => {
    if (!this.props.lowercase || !word) {
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
    const job = this.jobFromSuggestion(suggestion)
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

  componentWillReceiveProps(nextProps) {
    if (nextProps.value && nextProps.value.codeOgr) {
      const genderizedJobName = genderizeJob(nextProps.value, nextProps.gender)
      const jobName = this.maybeLowerFirstLetter(genderizedJobName)
      this.setState({jobName})
    }
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {gender, onChange, style, value, ...otherProps} = this.props
    const fieldStyle = {...style}
    if (this.hasError()) {
      // TODO: Add a prop for `errorStyle`.
      fieldStyle.borderColor = 'red'
    }

    const displayKey = 'libelleAppellationCourt' + (GENDERIZED_DISPLAY_KEY_SUFFIX[gender] || '')
    const display = suggestion => this.maybeLowerFirstLetter(suggestion[displayKey])
    return <AlgoliaSuggest
        {...otherProps} algoliaIndex="jobs"
        algoliaApp="K6ACI9BKKT" algoliaApiKey="da4db0bf437e37d6d49cefcb8768c67a"
        displayValue={this.state.jobName} hint={true} autoselect={true}
        autoselectOnBlur={true} style={fieldStyle} display={display}
        onBlur={this.handleBlur}
        onChange={this.handleChange}
        suggestionTemplate={this.renderSuggestion} />
  }
}


// A City autocomplete input.
class CitySuggest extends React.Component {
  static propTypes = {
    onChange: React.PropTypes.func.isRequired,
    style: React.PropTypes.object,
    value: React.PropTypes.object,
  }

  componentWillMount() {
    const {value} = this.props
    this.setState({cityName: value && value.name || ''})
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
    // eslint-disable-next-line no-unused-vars
    const {cityId, population, zipCode, objectID, _highlightResult, ...city} = suggestion
    city.cityId = cityId || objectID
    city.postcodes = zipCode
    this.setState({cityName: city.name})
    onChange && onChange(city)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value && nextProps.value.cityId) {
      this.setState({
        cityName: nextProps.value.name,
      })
    }
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {onChange, style, value, ...otherProps} = this.props
    const {cityName} = this.state
    const fieldStyle = {...style}
    if (cityName && !value) {
      fieldStyle.borderColor = 'red'
    }
    return <AlgoliaSuggest
        {...otherProps} algoliaIndex="cities"
        algoliaApp="K6ACI9BKKT" algoliaApiKey="da4db0bf437e37d6d49cefcb8768c67a"
        displayValue={cityName} hint={true} autoselect={true} autoselectOnBlur={true}
        hitsPerPage={5} displayKey="name"
        style={fieldStyle}
        onChange={this.handleChange}
        suggestionTemplate={this.renderSuggestion} />
  }
}


export {JobSuggest, CitySuggest}
