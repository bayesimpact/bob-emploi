import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import createHistory from 'history/createBrowserHistory'
import _keyBy from 'lodash/keyBy'
import _omit from 'lodash/omit'
import ThumbDownIcon from 'mdi-react/ThumbDownIcon'
import ThumbUpIcon from 'mdi-react/ThumbUpIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {Route, Switch} from 'react-router'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'

import {actionTypesToLog, computeAdvicesForProject, convertUserWithAdviceSelectionFromProto,
  convertUserWithAdviceSelectionToProto, displayToasterMessage,
  sendAdviceFeedback} from 'store/actions'
import {getAdviceShortTitle} from 'store/advice'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {inCityPrefix, lowerFirstLetter, maybeContractPrefix} from 'store/french'

import {AdvicePicto, ExpandedAdviceCardContent, ExplorerAdviceCard} from 'components/advisor'
import {Modal} from 'components/modal'
import {isMobileVersion} from 'components/mobile'
import {Snackbar} from 'components/snackbar'
import {CitySuggest, JobSuggest} from 'components/suggestions'
import {Button, Checkbox, ExternalLink, MAX_CONTENT_WIDTH,
  SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'

import 'normalize.css'
import 'styles/App.css'

const SET_CITY = 'SET_CITY'
const SET_JOB = 'SET_JOB'
const SET_USER = 'SET_USER'
const SEND_ADVICE_SELECTION = 'SEND_ADVICE_SELECTION'

const HoverableThumbDownIcon = Radium(ThumbDownIcon)
const HoverableThumbUpIcon = Radium(ThumbUpIcon)

const parseJsonAsync = jsonText => {
  return new Promise(resolve => {
    return resolve(JSON.parse(jsonText))
  })
}


class BootstrapPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: PropTypes.shape({
      hash: PropTypes.string.isRequired,
    }).isRequired,
    user: PropTypes.object.isRequired,
  }

  state = {
    advices: [],
    advicesById: {},
    badAdvices: new Set(),
    cachedSharedUrl: null,
    goodAdvices: new Set(),
    isBadAdviceModalShown: false,
    isEditorEnabled: true,
    onBadAdviceConfirmed: null,
    selectedAdvices: new Set(),
  }

  componentDidMount() {
    const {dispatch, location} = this.props
    if (location.hash.length <= 1) {
      return
    }
    const hashString = decodeURIComponent(location.hash.substr(1))
    const protoPromise = hashString.startsWith('{') ?
      parseJsonAsync(hashString) : dispatch(convertUserWithAdviceSelectionFromProto(hashString))
    protoPromise.
      catch(error => {
        dispatch(displayToasterMessage(`${error.message} en parsant ${hashString}`))
      }).
      then(userAndAdvices => {
        if (!userAndAdvices) {
          return
        }
        if (userAndAdvices.user) {
          const selectedAdvices = new Set(userAndAdvices.adviceIds || [])
          this.setState({
            cachedSharedUrl: null,
            isEditorEnabled: false,
            selectedAdvices,
          })
          dispatch({type: SET_USER, user: userAndAdvices.user})
          this.updateCachedSharedUrl(selectedAdvices)
        } else {
          dispatch({type: SET_USER, user: userAndAdvices})
        }
      })
  }

  componentDidUpdate({user: prevUser}) {
    const {dispatch, user} = this.props
    const {isEditorEnabled, selectedAdvices} = this.state
    if (user !== prevUser) {
      dispatch(computeAdvicesForProject(user)).then(({advices}) => {
        this.setState({
          advices: isEditorEnabled ?
            advices : advices.filter(({adviceId}) => selectedAdvices.has(adviceId)),
          advicesById: _keyBy(advices, 'adviceId'),
          cachedSharedUrl: null,
        })
        if (selectedAdvices) {
          this.updateCachedSharedUrl(selectedAdvices)
        }
      })
    }
  }

  handleAdviceChangeSelection({adviceId}, isSelected) {
    const {selectedAdvices: prevSelectedAdvices} = this.state
    if (prevSelectedAdvices.has(adviceId) === isSelected) {
      return
    }
    const selectedAdvices = new Set(prevSelectedAdvices)
    if (isSelected) {
      selectedAdvices.add(adviceId)
    } else {
      selectedAdvices.delete(adviceId)
    }
    this.setState({cachedSharedUrl: null, selectedAdvices})
    this.updateCachedSharedUrl(selectedAdvices)
  }

  updateCachedSharedUrl(selectedAdvices) {
    const {dispatch, user} = this.props
    if (this.state.isEditorEnabled && selectedAdvices.size) {
      const userWithAdviceSelection = {
        adviceIds: Array.from(selectedAdvices),
        user,
      }
      dispatch(convertUserWithAdviceSelectionToProto(userWithAdviceSelection)).
        then(proto => {
          if (user !== this.props.user || selectedAdvices !== this.state.selectedAdvices) {
            return
          }
          this.setState({cachedSharedUrl: proto})
        })
    }
  }

  handleThumbDown(project, advice) {
    this.setState({
      isBadAdviceModalShown: true,
      onBadAdviceConfirmed: feedback => {
        const {dispatch} = this.props
        const badAdvices = new Set(this.state.badAdvices)
        badAdvices.add(advice.adviceId)
        const goodAdvices = new Set(this.state.goodAdvices)
        goodAdvices.delete(advice.adviceId)
        this.setState({
          badAdvices,
          goodAdvices,
          isBadAdviceModalShown: false,
          onBadAdviceConfirmed: null,
        })
        dispatch(sendAdviceFeedback(project, advice, feedback, 1))
      },
    })
  }

  handleThumbUp(project, advice) {
    const {dispatch} = this.props
    const goodAdvices = new Set(this.state.goodAdvices)
    goodAdvices.add(advice.adviceId)
    const badAdvices = new Set(this.state.badAdvices)
    badAdvices.delete(advice.adviceId)
    this.setState({badAdvices, goodAdvices})
    dispatch(sendAdviceFeedback(project, advice, '', 5))
  }

  getShareFragment() {
    const {cachedSharedUrl, selectedAdvices} = this.state
    if (cachedSharedUrl) {
      return cachedSharedUrl
    }
    const userWithAdviceSelection = {
      adviceIds: Array.from(selectedAdvices),
      user: this.props.user,
    }
    // While the server is computing the proto version, use the JSON one.
    return JSON.stringify(userWithAdviceSelection)
  }

  renderLocation({city}) {
    if (!city || !city.name) {
      return null
    }
    const {cityName, prefix} = inCityPrefix(city.name)
    return ' ' + prefix + cityName
  }

  renderInJobGroup({targetJob}) {
    if (!targetJob || !targetJob.jobGroup || !targetJob.jobGroup.name) {
      return null
    }
    return ` en ${lowerFirstLetter(targetJob.jobGroup.name)}`
  }

  renderProfile(style) {
    const {lastName, name} = this.props.user.profile || {}
    const containerStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
      borderRadius: 5,
      color: colors.DARK,
      margin: 20,
      padding: '15px 20px',
      ...style,
    }
    // TODO(pascal): Add more profile info.
    return <div style={containerStyle}>
      <div style={{fontSize: 18, fontWeight: 'bold'}}>
        {name} {lastName}
      </div>
    </div>
  }

  renderSelection(style) {
    const {dispatch} = this.props
    const {email, name} = this.props.user.profile || {}
    const {advicesById, selectedAdvices} = this.state
    const containerStyle = {
      color: colors.CHARCOAL_GREY,
      margin: '35px 10px',
      ...style,
    }
    const adviceStyle = {
      alignItems: 'center',
      backgroundColor: colors.BACKGROUND_GREY,
      borderRadius: 5,
      display: 'flex',
      fontWeight: 'bold',
      marginTop: 10,
      padding: '15px 8px 15px 15px',
    }
    const noteStyle = {
      fontSize: 14,
      fontStyle: 'italic',
      textAlign: 'center',
    }
    const maybeS = selectedAdvices.size > 1 ? 's' : ''
    const subject = 'Quelques conseils pour votre recherche'
    const {origin, pathname} = window.location
    const body = "Voici quelques conseils que j'ai sélectionnés pour vous parmi les conseils " +
      `de ${config.productName} :\n\n` +
      `${origin}${pathname}#${encodeURIComponent(this.getShareFragment())}`
    const mailtoLink = `mailto:${email}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`
    return <div style={containerStyle}>
      {selectedAdvices.size ? <nav>
        <div style={{color: colors.DARK, fontSize: 18, fontWeight: 500, marginBottom: 15}}>
          Conseil{maybeS} sélectionné{maybeS} ({selectedAdvices.size})&nbsp;:
        </div>
        {Array.from(selectedAdvices).filter(adviceId => advicesById[adviceId]).map(adviceId => <div
          style={adviceStyle} key={`menu-${adviceId}`}>
          <AdvicePicto adviceId={adviceId} style={{height: 34, marginRight: 10, width: 34}} />
          {getAdviceShortTitle(advicesById[adviceId], (tu, vous) => vous)}
        </div>)}
        <ExternalLink
          href={mailtoLink} style={{margin: '40px 0 25px'}}
          onClick={() => dispatch({type: SEND_ADVICE_SELECTION})}>
          <Button style={{margin: '40px 0 25px', width: '100%'}}>
            Envoyer à…
          </Button>
        </ExternalLink>
      </nav> : null}
      <div style={noteStyle}>
        {selectedAdvices.size ? <React.Fragment>
          Partagez les conseils {name ? `avec ${name}` : null} en cliquant sur "Envoyer"
        </React.Fragment> : <React.Fragment>
          Créez une sélection de conseils {name ? `pour ${name}` : null} en
          cochant les cases à côté de chaque carte.
        </React.Fragment>}
      </div>
    </div>
  }

  render() {
    const {user} = this.props
    const {advices, badAdvices, goodAdvices, isBadAdviceModalShown,
      isEditorEnabled, onBadAdviceConfirmed, selectedAdvices} = this.state
    const project = (user.projects || []).find(p => p)
    if (!project || !advices) {
      return <div>Chargement…</div>
    }
    const {lastName, name} = user.profile || {}
    const headerStyle = {
      fontSize: 30,
      padding: 20,
      textAlign: 'center',
    }
    return <React.Fragment>
      {isEditorEnabled ? null : <header style={headerStyle}>
        Conseils pour le projet
        {(name && lastName) ? ` ${maybeContractPrefix('de ', "d'", name)} ${lastName}` : null} de
        trouver un emploi
        {this.renderInJobGroup(project)}
        {this.renderLocation(project)}
      </header>}
      {isEditorEnabled ?
        this.renderProfile({left: 0, position: 'fixed', top: 0, width: 300}) : null}
      <BadAdviceModal
        isShown={isBadAdviceModalShown}
        onClose={() => this.setState({isBadAdviceModalShown: false})}
        onConfirm={onBadAdviceConfirmed} />
      <div style={{margin: '0 300px'}}>
        {advices.map(advice => <BootstrapAdviceCard
          key={advice.adviceId} advice={advice} isSelectable={isEditorEnabled}
          isSelected={selectedAdvices.has(advice.adviceId)} isBad={badAdvices.has(advice.adviceId)}
          isGood={goodAdvices.has(advice.adviceId)}
          onChangeSelection={isSelected => this.handleAdviceChangeSelection(advice, isSelected)}
          onThumbDown={() => this.handleThumbDown(project, advice)}
          onThumbUp={() => this.handleThumbUp(project, advice)}
          project={project} profile={user.profile} />)}
      </div>
      {isEditorEnabled ?
        this.renderSelection({position: 'fixed', right: 0, top: 0, width: 300}) : null}
    </React.Fragment>
  }
}
const BootstrapPage = connect(({user}) => ({user}))(BootstrapPageBase)


class BadAdviceModal extends React.Component {
  static propTypes = {
    isShown: PropTypes.bool,
    onConfirm: PropTypes.func,
  }

  state = {
    feedback: '',
  }

  componentDidUpdate({isShown: wasShown}) {
    if (!wasShown && this.props.isShown && this.textarea.current) {
      this.textarea.current.focus()
    }
  }

  textarea = React.createRef()

  render() {
    const {onConfirm, ...otherProps} = this.props
    const {feedback} = this.state
    // TODO(marielaure): Prettify the text.
    return <Modal {...otherProps} style={{margin: '0 10px', padding: 25}}>
      <div style={{color: colors.DARK_TWO, maxWidth: 600}}>
        Dites-nous ce qui ne va pas dans ce conseil.<br />
        <em>
          Notez que pour des raisons de confidentialité, en recevant votre
          retour nous n'aurons aucun contexte : ni les données de
          l'utilisateur, ni les données fournies par Bob. Donc n'hésitez pas à
          rajouter des détails dans votre retour ci-dessous.
        </em>
      </div>
      <textarea
        ref={this.textarea}
        value={feedback}
        style={{height: 180, padding: 10, width: '100%'}}
        onChange={event => this.setState({feedback: event.target.value})} />
      <div style={{textAlign: 'center'}}>
        <Button onClick={() => onConfirm(feedback)}>
          Valider
        </Button>
      </div>
    </Modal>
  }
}


class BootstrapAdviceCard extends React.Component {
  static propTypes = {
    isBad: PropTypes.bool,
    isGood: PropTypes.bool,
    isSelectable: PropTypes.bool,
    isSelected: PropTypes.bool,
    onChangeSelection: PropTypes.func.isRequired,
    onThumbDown: PropTypes.func.isRequired,
    onThumbUp: PropTypes.func.isRequired,
  }

  state = {
    isExpanded: false,
  }

  renderSelectButtons() {
    const {isBad, isGood, isSelectable, isSelected, onChangeSelection,
      onThumbDown, onThumbUp} = this.props
    if (!isSelectable) {
      return null
    }
    const buttonStyle = {
      cursor: 'pointer',
      padding: 15,
    }
    const thumbStyle = {
      ':hover': {fill: colors.GREYISH_BROWN},
      fill: colors.COOL_GREY,
      width: 20,
      ...SmoothTransitions,
    }
    const selectedThumbStyle = {
      ...thumbStyle,
      ':hover': {fill: colors.BOB_BLUE},
      fill: colors.BOB_BLUE,
    }
    return <div style={{marginLeft: 10}}>
      <div style={buttonStyle} onClick={() => onChangeSelection(!isSelected)}>
        <Checkbox isSelected={isSelected} onClick={() => onChangeSelection(!isSelected)} />
      </div>
      <div style={buttonStyle} onClick={onThumbUp}>
        <HoverableThumbUpIcon style={isGood ? selectedThumbStyle : thumbStyle} />
      </div>
      <div style={buttonStyle} onClick={onThumbDown}>
        <HoverableThumbDownIcon style={isBad ? selectedThumbStyle : thumbStyle} />
      </div>
    </div>
  }

  render() {
    const {isExpanded} = this.state
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      margin: '35px 0',
    }
    const style = {
      maxHeight: isExpanded ? 'initial' : 350,
      width: 780,
    }
    return <div style={containerStyle}>
      <ExplorerAdviceCard
        {...this.props} style={style} userYou={(tu, vous) => vous}
        onClick={isExpanded ? null : () => this.setState({isExpanded: true})}
        howToSeeMore={isExpanded ? null : 'Cliquez pour voir le contenu'}
      />
      {this.renderSelectButtons()}
    </div>
  }
}


class ResourcesPageBase extends React.Component {
  static propTypes = {
    cityId: PropTypes.string,
    dispatch: PropTypes.func.isRequired,
    jobId: PropTypes.string,
    user: PropTypes.object.isRequired,
  }

  state = {
    advices: [],
  }

  componentDidUpdate({cityId: prevCityId, jobId: prevJobId}) {
    const {cityId, dispatch, jobId, user} = this.props
    if (cityId && jobId && (cityId !== prevCityId || jobId !== prevJobId)) {
      dispatch(computeAdvicesForProject(user)).then(({advices = []}) => this.setState({advices}))
    }
  }

  handleCityChange = city => {
    const {cityId: prevCityId} = this.props
    const {cityId} = city || {}
    if (!cityId && !prevCityId || cityId === prevCityId) {
      return
    }
    this.props.dispatch({city, type: SET_CITY})
  }

  handleJobChange = job => {
    const {jobId: prevJobId} = this.props
    const {codeOgr: jobId} = job || {}
    if (!jobId && !prevJobId || jobId === prevJobId) {
      return
    }
    this.props.dispatch({job, type: SET_JOB})
  }

  render() {
    const {user: {profile, projects: [project]}} = this.props
    const {advices} = this.state
    const {city, targetJob} = project

    const navStyle = {
      backgroundColor: colors.BOB_BLUE,
      padding: '8px 90px',
      position: 'relative',
    }
    const logoStyle = {
      height: 24,
      left: 20,
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
    }
    const searchBarStyle = {
      backgroundColor: '#fff',
      borderRadius: 5,
      display: 'flex',
      margin: 'auto',
      maxWidth: MAX_CONTENT_WIDTH,
      overlay: 'hidden',
    }
    const resourcesContainerStyle = {
      columnCount: isMobileVersion ? 1 : 2,
      columnGap: 40,
      margin: 'auto',
      maxWidth: MAX_CONTENT_WIDTH,
      padding: '40px 0',
    }
    return <React.Fragment>
      <nav style={navStyle}>
        <img src={logoProductWhiteImage} alt={config.productName} style={logoStyle} />
        <div style={searchBarStyle} className="no-hover no-focus">
          <JobSuggest value={targetJob} onChange={this.handleJobChange} placeholder="métier" />
          <CitySuggest value={city} onChange={this.handleCityChange} placeholder="ville" />
        </div>
      </nav>
      <div style={resourcesContainerStyle}>
        {city && targetJob ? advices.map(advice => <ResourceAdviceCard
          key={advice.adviceId} userYou={(tu, vous) => vous}
          style={{display: 'inline-block', marginBottom: 40, width: '100%'}}
          {...{advice, profile, project}} />) : null}
      </div>
    </React.Fragment>
  }
}
const ResourcesPage = connect(({user}) => {
  // TODO(pascal): Clear the advices when city/targetJob are changed.
  const {city, targetJob} = user.projects[0]
  const {cityId} = city || {}
  const {codeOgr: jobId} = targetJob || {}
  return {cityId, jobId, user}
})(ResourcesPageBase)


class ResourceAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice, style, userYou} = this.props
    const headerStyle = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE_HOVER,
      borderRadius: '5px 5px 0 0',
      color: '#fff',
      display: 'flex',
      fontWeight: 900,
      padding: 10,
    }
    const cardStyle = {
      borderColor: colors.MODAL_PROJECT_GREY,
      borderRadius: '0 0 5px 5px',
      borderStyle: 'solid',
      borderWidth: '0 1px 1px 1px',
    }

    // TODO(pascal): Display only resources instead of full advice (e.g. drop
    // the extra text introducing the resources in each card).
    return <section style={{fontSize: 16, ...style}}>
      <header style={headerStyle}>
        <AdvicePicto adviceId={advice.adviceId} style={{height: 48, marginRight: 8}} />
        {getAdviceShortTitle(advice, userYou)}
      </header>
      <div style={cardStyle}>
        <ExpandedAdviceCardContent {..._omit(this.props, ['style'])} />
      </div>
    </section>
  }
}

const history = createHistory()

const ravenMiddleware = RavenMiddleware(config.sentryDSN, {release: config.clientVersion}, {
  stateTransformer: function(state) {
    return {
      ...state,
      // Don't send user info to Sentry.
      user: 'Removed with ravenMiddleware stateTransformer',
    }
  },
})
const amplitudeMiddleware = createAmplitudeMiddleware({
  ...actionTypesToLog,
  [SEND_ADVICE_SELECTION]: 'Send advice cards selection for external profile',
  [SET_USER]: 'Show advice cards for external profile',
})
// Enable devTools middleware.
const finalCreateStore = composeWithDevTools(
  // ravenMiddleware needs to be first to correctly catch exception down the line.
  applyMiddleware(ravenMiddleware, thunk, amplitudeMiddleware, routerMiddleware(history)),
)(createStore)


function bootstrapUserReducer(state = {profile: {}, projects: [{}]}, action) {
  if (action.type === SET_USER) {
    if (action.user.projects && action.user.projects[0]) {
      const project = action.user.projects && action.user.projects[0]
      if (project.mobility && !project.city) {
        return {
          ...action.user,
          projects: [{
            ...project,
            ...project.mobility,
          }],
        }
      }
    }
    return action.user
  }
  if (action.type === SET_JOB) {
    return {
      profile: {},
      ...state,
      projects: [{
        ...state.projects[0],
        targetJob: action.job,
      }],
    }
  }
  if (action.type === SET_CITY) {
    return {
      profile: {},
      ...state,
      projects: [{
        ...state.projects[0],
        city: action.city,
      }],
    }
  }
  return state
}


// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    app,
    asyncState,
    router: connectRouter(history),
    user: bootstrapUserReducer,
  })
)
if (module.hot) {
  module.hot.accept(['store/app_reducer'], () => {
    const {app, asyncState} = require('store/app_reducer')
    store.replaceReducer(combineReducers({
      app,
      asyncState,
      router: connectRouter(history),
      user: bootstrapUserReducer,
    }))
  })
}


class App extends React.Component {
  render() {
    return <Provider store={store}>
      <Radium.StyleRoot>
        <div style={{backgroundColor: '#fff'}}>
          <ConnectedRouter history={history}>
            <Switch>
              <Route path={Routes.BOOTSTRAP_PAGE} component={BootstrapPage} />
              <Route path={Routes.RESOURCES_PAGE} component={ResourcesPage} />
            </Switch>
          </ConnectedRouter>
          <Snackbar timeoutMillisecs={4000} />
        </div>
      </Radium.StyleRoot>
    </Provider>
  }
}


export {App}
