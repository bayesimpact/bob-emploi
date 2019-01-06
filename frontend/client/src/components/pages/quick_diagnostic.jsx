import MagnifyIcon from 'mdi-react/MagnifyIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import {parse, stringify} from 'query-string'
import React from 'react'
import {connect} from 'react-redux'
import {Link} from 'react-router-dom'
import {FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton,
  TwitterIcon, TwitterShareButton} from 'react-share'

import {closeQuickDiagnostic, idleQuickDiagnostic, quickDiagnose,
  shareProductToNetwork} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {computeBobScore} from 'store/score'

import {LoginButton} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {CitySuggest, JobSuggest, fetchCity, fetchJob} from 'components/suggestions'
import {Button, CircularProgress} from 'components/theme'
import {Routes} from 'components/url'

import {DiagnosticMetrics} from './connected/project/diagnostic'


const UNDEFINED_TOPICS = new Set([
  'PROFILE_DIAGNOSTIC',
  'PROJECT_DIAGNOSTIC',
  'JOB_SEARCH_DIAGNOSTIC',
])


class QuickDiagnostic extends React.Component {
  static propTypes = {
    areQuestionsShown: PropTypes.bool,
    city: PropTypes.object,
    job: PropTypes.object,
    onStartEditing: PropTypes.func,
    onSubmit: PropTypes.func,
    style: PropTypes.object,
  }

  state = {
    city: this.props.city || null,
    job: this.props.job || null,
  }

  componentDidUpdate({city: prevPropCity, job: prevPropJob}) {
    const {city, job} = this.props
    if (city !== prevPropCity || job !== prevPropJob) {
      this.setState({city, job})
    }
  }

  getLinkToParameters() {
    const {city, job} = this.state
    if (!city || !job) {
      return {}
    }
    const search = {
      cityId: city.cityId,
      jobId: job.codeOgr,
    }
    return {
      pathname: Routes.QUICK_DIAGNOSTIC_PAGE + '/' +
        encodeURIComponent(lowerFirstLetter(job.feminineName || job.name)) + '/' +
        encodeURIComponent(city.name) + `?${stringify(search)}`,
      state: {city, job},
    }
  }

  handleChange = type => object => {
    this.setState({[type]: object})
  }

  onQuickDiagnose = () => {
    const {city, job} = this.state
    if (!city || !job) {
      // TODO(cyrille): Show an error to the user.
      return
    }
    const {onSubmit} = this.props
    onSubmit && onSubmit()
  }

  render() {
    const {areQuestionsShown, onStartEditing, style} = this.props
    const isMobileQuestions = areQuestionsShown && isMobileVersion
    const {city, job} = this.state
    // TODO(pascal): Add some content for the result.
    const searchBoxStyle = isMobileQuestions ? {
      color: colors.DARK_TWO,
      marginBottom: 30,
      ...style,
    } : {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 4,
      boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.2)',
      color: colors.DARK_TWO,
      display: 'flex',
      margin: areQuestionsShown ? '30px auto 0' : '0 auto',
      maxWidth: 960,
      ...style,
    }
    const explanationTextStyle = {
      bottom: '100%',
      color: '#fff',
      left: 0,
      marginBottom: 15,
      position: 'absolute',
    }
    const separatorStyle = isMobileQuestions ? {
      height: 20,
    } : {
      alignSelf: 'stretch',
      backgroundColor: colors.MODAL_PROJECT_GREY,
      width: 1,
    }
    const inputContainerStyle = isMobileQuestions ? {
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 4,
      boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.2)',
      display: 'flex',
    } : {flex: 1, position: 'relative'}
    const iconStyle = {
      fill: colors.PINKISH_GREY,
      margin: '10px 0 10px 15px',
      width: 27,
    }
    const inputStyle = {
      borderWidth: 0,
      flex: 1,
      padding: isMobileQuestions ? '.5em 13px' : '.5em 1em',
      textOverflow: 'ellipsis',
    }
    const buttonContainerStyle = isMobileQuestions ? {
      bottom: -25,
      left: 30,
      position: 'absolute',
      right: 30,
    } : {}
    const buttonStyle = isMobileQuestions ? {width: '100%'} : {margin: 4}
    // TODO(pascal): Drop the empty spans when AlgoliaSuggest is using pure React.
    return <div style={searchBoxStyle}>
      <div style={inputContainerStyle}>
        {isMobileQuestions ? <MagnifyIcon style={iconStyle} /> : areQuestionsShown ?
          <div style={explanationTextStyle}>Quel métier cherchez-vous&nbsp;?</div> : null}
        <span />
        <JobSuggest
          value={job} onChange={this.handleChange('job')} placeholder="Saisir un métier"
          style={inputStyle} onFocus={onStartEditing} />
      </div>
      <div style={separatorStyle} />
      <div style={inputContainerStyle}>
        {isMobileQuestions ? <MagnifyIcon style={iconStyle} /> : areQuestionsShown ?
          <div style={explanationTextStyle}>Dans quelle ville&nbsp;?</div> : null}
        <span />
        <CitySuggest
          value={city} onChange={this.handleChange('city')} placeholder="Saisir une ville"
          style={inputStyle} onFocus={onStartEditing} />
      </div>
      {isMobileVersion && !areQuestionsShown ? null :
        <Link
          onClick={this.onQuickDiagnose} style={buttonContainerStyle}
          to={this.getLinkToParameters()}>
          <Button type="validation" style={buttonStyle}>
            Évaluer&nbsp;!
          </Button>
        </Link>}
    </div>
  }
}


class QuickDiagnosticPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
      pathname: PropTypes.string.isRequired,
      search: PropTypes.string,
      state: PropTypes.shape({
        city: PropTypes.object,
        job: PropTypes.object,
      }),
    }).isRequired,
    match: PropTypes.shape({
      params: PropTypes.shape({
        cityName: PropTypes.string.isRequired,
        jobName: PropTypes.string.isRequired,
      }).isRequired,
    }),
  }

  state = {
    isEditing: false,
    isWaiting: false,
  }

  componentDidMount() {
    this.componentDidUpdate({}, {})
    // Consider user is idle after 30 minutes.
    this.idleTimeout = setTimeout(() => this.props.dispatch(idleQuickDiagnostic), 1800000)
    window.addEventListener('beforeunload', this.handleBeforeUnload)
  }

  componentDidUpdate({location: {state: prevPropState} = {}}, {city: prevCity, job: prevJob}) {
    const {state} = this.props.location
    if (state !== prevPropState) {
      this.populateState(state || {})
      return
    }
    const {city, components, isWaiting, job} = this.state
    if (!city || !job) {
      this.populateState({})
      return
    }
    if (city === prevCity && job === prevJob && (components || isWaiting)) {
      return
    }
    this.setState({isWaiting: true})
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.setState({isWaiting: false}), 4000)
    // TODO(cyrille): Make sure to deal with errors if we decide to keep this MVP.
    this.props.dispatch(quickDiagnose(city, job)).
      then(computeBobScore).then(({components}) => {
        components.forEach((component) => {
          if (!component.isDefined || UNDEFINED_TOPICS.has(component.topic)) {
            component.isDefined = false
            component.isEnticing = true
            component.percent = 0
            component.text = "Je n'ai pas assez d'information sur vous pour vous répondre. \
              Poursuivez l'évaluation pour en savoir plus."
          } else {
            component.isAlwaysExpanded = true
          }
        })
        this.setState({components})
      })
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
    clearTimeout(this.idleTimeout)
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
    this.props.dispatch(closeQuickDiagnostic)
  }

  handleBeforeUnload = () => {
    this.props.dispatch(closeQuickDiagnostic)
  }

  populateState({city, job}) {
    if (city && job) {
      this.setState({city, job})
      return
    }
    const {location: {search}, match: {params: {cityName, jobName}}} = this.props
    const {city: {name: stateCity} = {}, job: {feminineName: stateJob} = {}} = this.state
    const {cityId, jobId} = parse(search)
    if (!city || stateCity !== cityName) {
      fetchCity(cityName, cityId).then(city => this.setState({city}))
    }
    if (!job || stateJob !== jobName) {
      fetchJob(jobName, jobId).then(job => this.setState({job}))
    }
  }

  renderShareButton(network, ShareButton, ShareIcon, otherProps, isFirst) {
    const {dispatch} = this.props
    const iconSize = 55
    const iconStyle = {
      borderRadius: 5,
      cursor: 'pointer',
      display: 'block',
      height: iconSize,
      marginBottom: 5,
      marginLeft: isFirst ? 0 : isMobileVersion ? 30 : 40,
      overflow: 'hidden',
      width: iconSize,
    }
    return <ShareButton
      {...otherProps}
      beforeOnClick={() => dispatch(shareProductToNetwork(`quick-diagnostic-${network}`))}
      url={location.href} style={iconStyle}>
      <ShareIcon size={iconSize} />
    </ShareButton>
  }

  render() {
    const {city, components, isEditing, isWaiting, job} = this.state
    const resultPageStyle = {
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto',
      maxWidth: 630,
      paddingBottom: isMobileVersion ? 20 : 0,
      paddingTop: isMobileVersion ? 0 : 48,
      position: 'relative',
    }
    const metricButtonStyle = {
      backgroundColor: colors.SLATE,
      display: 'block',
      fontSize: isMobileVersion ? 13 : 14,
      margin: isMobileVersion ? '10px 0 30px 43px' : '10px 0 0 64px',
      padding: '9px 15px',
    }
    const globalButtonStyle = {
      margin: '60px auto',
    }
    const FollowThroughButton = ({children, visualElement, ...otherProps}) => <LoginButton
      isSignUpButton={true} visualElement={`quick-diagnostic-${visualElement}`}
      type="validation" {...otherProps} >
      {children}
      <ChevronRightIcon size={20} style={{margin: '-5px -6px -5px 11px'}} />
    </LoginButton>
    const FutureJobComponent = components && components.find(
      component => component.topic && component.topic === 'JOB_OF_THE_FUTURE_DIAGNOSTIC')
    const isFutureJobGood = FutureJobComponent && FutureJobComponent.percent &&
      FutureJobComponent.percent > 80
    const sharedText = isFutureJobGood ? 'Mon métier fait partie des métiers qui offrent les ' +
        "meilleures perspectives d'avenir en France\u00A0!!\nEt toi, comment va ton job\u00A0? " +
        `Demande à ${config.productName}\u00A0!` : 'Tu te demandes si ton métier ira bien ' +
      `en 2022\u00A0? ${config.productName} te répond.`
    const pageStyle = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }
    const headerStyle = {
      backgroundColor: colors.BOB_BLUE,
      flexShrink: 0,
      height: isMobileVersion ? 'initial' : 90,
      marginBottom: isMobileVersion ? 0 : 50,
      padding: 10,
      position: 'relative',
    }
    const quickDiagnosticStyle = isMobileVersion ? {} : {
      bottom: 0,
      left: 0,
      margin: '0 auto',
      position: 'absolute',
      right: 0,
      transform: 'translateY(50%)',
      zIndex: 1,
    }
    const footerStyle = {
      alignItems: 'center',
      backgroundColor: colors.BACKGROUND_GREY,
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 20px 60px',
      textAlign: 'center',
    }
    return <PageWithNavigationBar
      page="quick-diagnostic" isContentScrollable={false}
      style={pageStyle} isChatButtonShown={true}
      isCookieDisclaimerShown={!!isMobileVersion}>
      <div style={headerStyle}>
        <QuickDiagnostic
          areQuestionsShown={isEditing} city={city} job={job} style={quickDiagnosticStyle}
          onSubmit={() => this.setState({components: null, isEditing: false})}
          onStartEditing={() => this.setState({isEditing: true})} />
      </div>
      {isEditing && isMobileVersion ? null : (components && !isWaiting) ? <React.Fragment>
        <div style={resultPageStyle}>
          <DiagnosticMetrics
            components={components} makeAdviceLink={() => ''} topicChildren={({topic, isDefined}) =>
              <FollowThroughButton
                style={metricButtonStyle} visualElement={topic} isRound={true}>
                {isDefined ? "Approfondir l'évaluation" : 'Renseigner mes informations'}
              </FollowThroughButton>} />
          {isMobileVersion ? null :
            <FollowThroughButton visualElement="bottom" style={globalButtonStyle}>
              Approfondir l'évaluation
            </FollowThroughButton>}
        </div>
        <footer style={footerStyle}>
          <h3 style={{fontSize: 26, margin: '0 0 15px'}}>
            <span style={{color: colors.BOB_BLUE}}>#</span>commentVaTonJob
          </h3>
          <p style={{color: colors.COOL_GREY, fontSize: 15, margin: '0 0 56px'}}>
            Partagez votre évaluation
          </p>
          <div style={{display: 'flex'}}>
            {/* TODO(cyrille): Add more content than just the shared link. */}
            {this.renderShareButton(
              'facebook', FacebookShareButton, FacebookIcon, {
                quote: `${sharedText} #commentVaTonJob`}, true)}
            {this.renderShareButton(
              'twitter', TwitterShareButton, TwitterIcon, {
                'hashtags': ['commentVaTonJob'], title: sharedText})}
            {this.renderShareButton('linkedin', LinkedinShareButton, LinkedinIcon, {
              description: sharedText})}
          </div>
        </footer>
      </React.Fragment> : <div style={{alignItems: 'center', display: 'flex', flex: 1}}>
        <CircularProgress size={50} />
      </div>}
    </PageWithNavigationBar>
  }
}
const QuickDiagnosticPage = connect()(QuickDiagnosticPageBase)


export {QuickDiagnostic, QuickDiagnosticPage}
