import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import i18n from 'i18next'
import {createBrowserHistory} from 'history'
import _keyBy from 'lodash/keyBy'
import ThumbDownIcon from 'mdi-react/ThumbDownIcon'
import ThumbUpIcon from 'mdi-react/ThumbUpIcon'
import PropTypes from 'prop-types'
import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {WithTranslation, useTranslation, withTranslation} from 'react-i18next'
import {connect, Provider, useDispatch, useSelector} from 'react-redux'
import {Route, RouteComponentProps, Switch} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'
import {Action, createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import {BootstrapAction, BootstrapState, DispatchBootstrapActions, actionTypesToLog,
  computeAdvicesForProject, convertUserWithAdviceSelectionFromProto,
  convertUserWithAdviceSelectionToProto, displayToasterMessage,
  sendAdviceFeedback, hideToasterMessageAction} from 'store/actions'
import {ValidAdvice, getAdviceShortTitle, isValidAdvice} from 'store/advice'
import {createAmplitudeMiddleware} from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {inCityPrefix, lowerFirstLetter, maybeContractPrefix} from 'store/french'
import {init as i18nInit} from 'store/i18n'
import {Logger} from 'store/logging'
import {makeCancelable} from 'store/promise'
import {createSentryMiddleware} from 'store/sentry'
import {addProjectIds} from 'store/user'

import {AdvicePicto, ExpandedAdviceCardProps, ExpandedAdviceCardContent, ExplorerAdviceCard,
  ExplorerAdviceCardConfig} from 'components/advisor'
import {Modal, ModalConfig} from 'components/modal'
import {isMobileVersion} from 'components/mobile'
import {useRadium} from 'components/radium'
import {Snackbar} from 'components/snackbar'
import {CitySuggest, JobSuggest} from 'components/suggestions'
import {Button, Checkbox, Inputable, ExternalLink, MAX_CONTENT_WIDTH,
  SmoothTransitions, Textarea} from 'components/theme'
import {Routes} from 'components/url'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=#fff'

import 'normalize.css'
import 'styles/App.css'

import {WaitingPage} from './waiting'

const SET_CITY = 'SET_CITY'
const SET_JOB = 'SET_JOB'
const SET_USER = 'SET_USER'
const SEND_ADVICE_SELECTION = 'SEND_ADVICE_SELECTION'


i18nInit()


interface SetUserAction extends Action<typeof SET_USER> {
  user: BootstrapUser
}

interface SetCityAction extends Action<typeof SET_CITY> {
  city: bayes.bob.FrenchCity
}

interface SetJobAction extends Action<typeof SET_JOB> {
  job: bayes.bob.Job
}

type SendAdviceSelectionAction = Action<typeof SEND_ADVICE_SELECTION>

type AllActions =
  | BootstrapAction
  | SendAdviceSelectionAction
  | SetCityAction
  | SetJobAction
  | SetUserAction


type IconProps = Omit<GetProps<typeof ThumbDownIcon>, 'style'> & {style?: RadiumCSSProperties}


const HoverableThumbDownIconBase = (props: IconProps): React.ReactElement => {
  const [radiumProps] = useRadium<SVGSVGElement, IconProps>(props)
  return <ThumbDownIcon {...radiumProps} />
}
const HoverableThumbDownIcon = React.memo(HoverableThumbDownIconBase)
const HoverableThumbUpIconBase = (props: IconProps): React.ReactElement => {
  const [radiumProps] = useRadium<SVGSVGElement, IconProps>(props)
  return <ThumbUpIcon {...radiumProps} />
}
const HoverableThumbUpIcon = React.memo(HoverableThumbUpIconBase)


function parseJsonAsync<T>(jsonText: string): Promise<T> {
  return new Promise((resolve): void => resolve(JSON.parse(jsonText)))
}


interface ProjectAndAdvice {
  advice?: bayes.bob.Advice
  project?: bayes.bob.Project
}


interface PageConnectedProps {
  user: bayes.bob.User
}


interface PageProps extends PageConnectedProps, RouteComponentProps, WithTranslation {
  dispatch: DispatchBootstrapActions
}


interface PageState {
  advices: readonly ValidAdvice[]
  advicesById: {readonly [adviceId: string]: bayes.bob.Advice}
  badAdvices: ReadonlySet<string>
  cachedSharedUrl: string | null
  goodAdvices: ReadonlySet<string>
  isBadAdviceModalShown: boolean
  isEditorEnabled: boolean
  onBadAdviceConfirmed: ((feedback: string) => void) | null
  selectedAdvices: ReadonlySet<string>
}

const getShareFragment = (
  selectedAdvices: ReadonlySet<string>, user: bayes.bob.User,
  cachedSharedUrl: string|null): string => {
  if (cachedSharedUrl) {
    return cachedSharedUrl
  }
  const userWithAdviceSelection = {
    adviceIds: [...selectedAdvices],
    user: user,
  }
  // While the server is computing the proto version, use the JSON one.
  return JSON.stringify(userWithAdviceSelection)
}

interface SelectionProps {
  advicesById: {readonly [adviceId: string]: bayes.bob.Advice}
  cachedSharedUrl: string|null
  selectedAdvices: ReadonlySet<string>
  style: React.CSSProperties
  user: bayes.bob.User
}
const SelectionBase = (props: SelectionProps): React.ReactElement => {
  const {advicesById, cachedSharedUrl, selectedAdvices = new Set([]), style,
    user, user: {profile: {email = '', name = undefined} = {}} = {}} = props
  const dispatch = useDispatch<DispatchBootstrapActions>()

  const handleSendSelection = useCallback((): void => {
    dispatch({type: SEND_ADVICE_SELECTION})
  }, [dispatch])

  const containerStyle: React.CSSProperties = {
    color: colors.CHARCOAL_GREY,
    margin: '35px 10px',
    ...style,
  }
  const adviceStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: colors.BACKGROUND_GREY,
    borderRadius: 5,
    display: 'flex',
    fontWeight: 'bold',
    marginTop: 10,
    padding: '15px 8px 15px 15px',
  }
  const noteStyle: React.CSSProperties = {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  }
  const maybeS = selectedAdvices.size > 1 ? 's' : ''
  const subject = 'Quelques conseils pour votre recherche'
  const {origin, pathname} = window.location
  const body = "Voici quelques conseils que j'ai sélectionnés pour vous parmi les conseils " +
    `de ${config.productName} :\n\n` +
    `${origin}${pathname}#${encodeURIComponent(
      getShareFragment(selectedAdvices, user, cachedSharedUrl))}`
  const mailtoLink = `mailto:${email}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  return <div style={containerStyle}>
    {selectedAdvices.size ? <nav>
      <div style={{color: colors.DARK, fontSize: 18, fontWeight: 500, marginBottom: 15}}>
        Conseil{maybeS} sélectionné{maybeS} ({selectedAdvices.size})&nbsp;:
      </div>
      {[...selectedAdvices].
        filter((adviceId: string): boolean => !!advicesById[adviceId]).
        map((adviceId: string): React.ReactNode => <div
          style={adviceStyle} key={`menu-${adviceId}`}>
          <AdvicePicto adviceId={adviceId} style={{height: 34, marginRight: 10, width: 34}} />
          {getAdviceShortTitle(advicesById[adviceId])}
        </div>)}
      <ExternalLink
        href={mailtoLink} style={{margin: '40px 0 25px'}}
        onClick={handleSendSelection}>
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
SelectionBase.propTypes = {
  advicesById: PropTypes.object.isRequired,
  cachedSharedUrl: PropTypes.string,
  selectedAdvices: PropTypes.object,
  style: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
}
const Selection = React.memo(SelectionBase)


interface ProfileSectionProps {
  profile?: bayes.bob.UserProfile
}

const ProfileSectionBase = ({profile}: ProfileSectionProps): React.ReactElement => {
  const {lastName = undefined, name = undefined} = profile || {}
  const containerStyle: React.CSSProperties = {
    backgroundColor: colors.BACKGROUND_GREY,
    borderRadius: 5,
    color: colors.DARK,
    padding: '15px 20px',
  }
  // TODO(pascal): Add more profile info.
  return <div style={containerStyle}>
    <div style={{fontSize: 18, fontWeight: 'bold'}}>
      {name} {lastName}
    </div>
  </div>
}
ProfileSectionBase.propTypes = {
  profile: PropTypes.object.isRequired,
}
const ProfileSection = React.memo(ProfileSectionBase)


// Input to bootstrap can either be a User (when coming from iMilo), or a UserWithAdviceSelection
// when coming back from a selection done with this page.
type InputUser = bayes.bob.User | bayes.bob.UserWithAdviceSelection


function isUserWithAdviceSelection(u: InputUser): u is bayes.bob.UserWithAdviceSelection {
  return !!(u as bayes.bob.UserWithAdviceSelection).user
}

function getLocation(city: bayes.bob.FrenchCity): string|null {
  if (!city || !city.name) {
    return null
  }
  const {cityName, prefix} = inCityPrefix(city.name, i18n.getFixedT(i18n.language))
  return ' ' + prefix + cityName
}

function getInJobGroup(targetJob: bayes.bob.Job): string|null {
  if (!targetJob || !targetJob.jobGroup || !targetJob.jobGroup.name) {
    return null
  }
  return ` en ${lowerFirstLetter(targetJob.jobGroup.name)}`
}

const selectionStyle = {
  position: 'fixed',
  right: 0,
  top: 0,
  width: 300,
} as const

class BootstrapPageBase extends React.PureComponent<PageProps, PageState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: ReactRouterPropTypes.location.isRequired,
    user: PropTypes.object.isRequired,
  }

  public state: PageState = {
    advices: [],
    advicesById: {},
    badAdvices: new Set<string>(),
    cachedSharedUrl: null,
    goodAdvices: new Set<string>(),
    isBadAdviceModalShown: false,
    isEditorEnabled: true,
    onBadAdviceConfirmed: null,
    selectedAdvices: new Set<string>(),
  }

  public componentDidMount(): void {
    const {dispatch, location} = this.props
    if (location.hash.length <= 1) {
      return
    }
    const hashString = decodeURIComponent(location.hash.slice(1))
    const protoPromise: Promise<InputUser|void> =
      hashString.startsWith('{') ?
        parseJsonAsync<InputUser>(hashString) :
        dispatch(convertUserWithAdviceSelectionFromProto(hashString))
    protoPromise.
      catch((error): void => {
        dispatch(displayToasterMessage(`${error.message} en parsant ${hashString}`))
      }).
      then((userInput: InputUser | void): void => {
        if (!userInput) {
          return
        }
        if (isUserWithAdviceSelection(userInput)) {
          if (!userInput.user) {
            return
          }
          const selectedAdvices = new Set(userInput.adviceIds || [])
          this.setState({
            cachedSharedUrl: null,
            isEditorEnabled: false,
            selectedAdvices,
          })
          dispatch({type: SET_USER, user: addProjectIds(userInput.user)})
          this.updateCachedSharedUrl(selectedAdvices)
        } else {
          dispatch({
            type: SET_USER,
            user: addProjectIds(userInput),
          })
        }
      })
  }

  public componentDidUpdate({user: prevUser}: PageProps): void {
    const {dispatch, user} = this.props
    const {isEditorEnabled, selectedAdvices} = this.state
    if (user !== prevUser) {
      dispatch(computeAdvicesForProject(user)).then((response): void => {
        if (!response) {
          return
        }
        const {advices} = response
        const maybeSelectedAdvices = isEditorEnabled ?
          advices :
          (advices || []).filter(({adviceId}): boolean =>
            !!adviceId && selectedAdvices.has(adviceId))
        this.setState({
          advices: (maybeSelectedAdvices || []).filter(isValidAdvice),
          advicesById: _keyBy(advices, 'adviceId'),
          cachedSharedUrl: null,
        })
        if (selectedAdvices) {
          this.updateCachedSharedUrl(selectedAdvices)
        }
      })
    }
  }

  private getProjectAndAdvice = (adviceId: string): ProjectAndAdvice => {
    const project = (this.props.user.projects || []).find((p): boolean => !!p)
    const advice = this.state.advices.find(
      ({adviceId: otherAdviceId}): boolean => adviceId === otherAdviceId)
    return {advice, project}
  }

  private handleAdviceChangeSelection = (adviceId: string, isSelected: boolean): void => {
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

  private updateCachedSharedUrl(selectedAdvices: ReadonlySet<string>): void {
    const {dispatch, user} = this.props
    if (this.state.isEditorEnabled && selectedAdvices.size) {
      const userWithAdviceSelection = {
        adviceIds: [...selectedAdvices],
        user,
      }
      dispatch(convertUserWithAdviceSelectionToProto(userWithAdviceSelection)).
        then((proto: string | void): void => {
          if (!proto) {
            return
          }
          if (user !== this.props.user || selectedAdvices !== this.state.selectedAdvices) {
            return
          }
          this.setState({cachedSharedUrl: proto})
        })
    }
  }

  private handleThumbDown = (adviceId: string): void => {
    const {t} = this.props
    const {advice, project} = this.getProjectAndAdvice(adviceId)
    this.setState({
      isBadAdviceModalShown: true,
      onBadAdviceConfirmed: (feedback: string): void => {
        const {dispatch} = this.props
        const badAdvices = new Set(this.state.badAdvices)
        badAdvices.add(adviceId)
        const goodAdvices = new Set(this.state.goodAdvices)
        goodAdvices.delete(adviceId)
        this.setState({
          badAdvices,
          goodAdvices,
          isBadAdviceModalShown: false,
          onBadAdviceConfirmed: null,
        })
        dispatch(sendAdviceFeedback(project, advice, {feedback}, t, 1))
      },
    })
  }

  private handleThumbUp = (adviceId: string): void => {
    const {dispatch, t} = this.props
    const {advice, project} = this.getProjectAndAdvice(adviceId)
    const goodAdvices = new Set(this.state.goodAdvices)
    if (!advice || !advice.adviceId) {
      return
    }
    goodAdvices.add(advice.adviceId)
    const badAdvices = new Set(this.state.badAdvices)
    badAdvices.delete(advice.adviceId)
    this.setState({badAdvices, goodAdvices})
    dispatch(sendAdviceFeedback(project, advice, {}, t, 5))
  }

  private handleCloseBadAdviceModal = (): void => this.setState({isBadAdviceModalShown: false})

  public render(): React.ReactNode {
    const {user} = this.props
    const {advices, advicesById, badAdvices, goodAdvices, isBadAdviceModalShown,
      isEditorEnabled, onBadAdviceConfirmed, selectedAdvices} = this.state
    const project = (user.projects || []).find((p): boolean => !!p)
    if (!project || !advices) {
      return <div>Chargement…</div>
    }
    const {lastName = undefined, name = undefined} = user.profile || {}
    const headerStyle: React.CSSProperties = {
      fontSize: 30,
      padding: 20,
      textAlign: 'center',
    }
    return <React.Fragment>
      {isEditorEnabled ? null : <header style={headerStyle}>
        Conseils pour le projet
        {(name && lastName) ? ` ${maybeContractPrefix('de ', "d'", name)} ${lastName}` : null} de
        trouver un emploi
        {getInJobGroup(project.targetJob || {})}
        {getLocation(project.city || {})}
      </header>}
      {isEditorEnabled ? <div style={{left: 0, padding: 20, position: 'fixed', top: 0, width: 300}}>
        <ProfileSection profile={user.profile} />
        <hr />
        <div style={{marginTop: 20}}>
          Avez-vous fait le point avec ce jeune sur sa situation et ses priorités&nbsp;?
          <div style={{marginTop: 20, textAlign: 'center'}}>
            <ExternalLink href="/unml/a-li/">
              <Button>
                Aller sur A-Li
              </Button>
            </ExternalLink>
          </div>
        </div>
      </div> : null}
      <BadAdviceModal
        isShown={isBadAdviceModalShown}
        onClose={this.handleCloseBadAdviceModal}
        onConfirm={onBadAdviceConfirmed || undefined} />
      <div style={{margin: '0 300px'}}>
        {advices.map((advice: ValidAdvice): React.ReactNode => <BootstrapAdviceCard
          key={advice.adviceId} advice={advice} isSelectable={isEditorEnabled}
          isSelected={selectedAdvices.has(advice.adviceId)} isBad={badAdvices.has(advice.adviceId)}
          isGood={goodAdvices.has(advice.adviceId)}
          onChangeSelection={this.handleAdviceChangeSelection}
          onThumbDown={this.handleThumbDown}
          onThumbUp={this.handleThumbUp}
          project={project} />)}
      </div>
      {isEditorEnabled ?
        <Selection

          selectedAdvices={selectedAdvices} advicesById={advicesById} user={user}
          cachedSharedUrl={this.state.cachedSharedUrl} style={selectionStyle} /> : null}
    </React.Fragment>
  }
}
const BootstrapPage =
  connect(({user}: BootstrapState): PageConnectedProps => ({user}))(
    withTranslation()(BootstrapPageBase))


type BadAdviceModalProps = Omit<ModalConfig, 'children' | 'style'> & {
  onConfirm?: (feedback: string) => void
}


const BadAdviceModalBase = (props: BadAdviceModalProps): React.ReactElement => {
  const {isShown, onConfirm, ...modalProps} = props
  const [feedback, setFeedback] = useState('')

  const textarea = useRef<Inputable>(null)
  useEffect((): void => {
    if (isShown) {
      textarea.current?.focus()
    }
  }, [isShown])

  const handleConfirm = useCallback((): void => {
    onConfirm?.(feedback)
  }, [feedback, onConfirm])

  // TODO(sil): Prettify the text.
  return <Modal {...modalProps} isShown={isShown} style={{margin: '0 10px', padding: 25}}>
    <div style={{maxWidth: 600}}>
      Dites-nous ce qui ne va pas dans ce conseil.<br />
      <em>
        Notez que pour des raisons de confidentialité, en recevant votre
        retour nous n'aurons aucun contexte : ni les données de
        l'utilisateur, ni les données fournies par Bob. Donc n'hésitez pas à
        rajouter des détails dans votre retour ci-dessous.
      </em>
    </div>
    <Textarea
      ref={textarea}
      value={feedback}
      style={{height: 180, padding: 10, width: '100%'}}
      onChange={setFeedback} />
    <div style={{textAlign: 'center'}}>
      <Button onClick={handleConfirm}>
        Valider
      </Button>
    </div>
  </Modal>
}
const BadAdviceModal = React.memo(BadAdviceModalBase)


interface CardProps extends Omit<ExplorerAdviceCardConfig, 'style' | 'onClick' | 'howToSeeMore'> {
  isBad?: boolean
  isGood?: boolean
  isSelectable?: boolean
  isSelected?: boolean
  onChangeSelection: (adviceId: string, isSelected: boolean) => void
  onThumbDown: (adviceId: string) => void
  onThumbUp: (adviceId: string) => void
}


const BootstrapAdviceCardBase = (props: CardProps): React.ReactElement => {
  const {advice: {adviceId}, isBad, isGood, isSelectable, isSelected, onChangeSelection,
    onThumbDown, onThumbUp} = props
  const [isExpanded, setIsExpanded] = useState(false)

  const handleChangeSelection = useCallback(
    (): void => onChangeSelection(adviceId, !isSelected),
    [adviceId, isSelected, onChangeSelection],
  )

  const handleExpand = useCallback((): void => setIsExpanded(true), [])
  const handleThumbUp = useCallback((): void => onThumbUp(adviceId), [adviceId, onThumbUp])
  const handleThumbDown = useCallback((): void => onThumbDown(adviceId), [adviceId, onThumbDown])

  const selectButtons = ((): React.ReactNode => {
    if (!isSelectable) {
      return null
    }
    const buttonStyle = {
      cursor: 'pointer',
      padding: 15,
    }
    const thumbStyle = {
      ':hover': {fill: colors.GREYISH_BROWN},
      'fill': colors.COOL_GREY,
      'width': 20,
      ...SmoothTransitions,
    }
    const selectedThumbStyle = {
      ...thumbStyle,
      ':hover': {fill: colors.BOB_BLUE},
      'fill': colors.BOB_BLUE,
    }
    return <div style={{marginLeft: 10}}>
      <div style={buttonStyle} onClick={handleChangeSelection}>
        <Checkbox isSelected={isSelected} onClick={handleChangeSelection} />
      </div>
      <div style={buttonStyle} onClick={handleThumbUp}>
        <HoverableThumbUpIcon style={isGood ? selectedThumbStyle : thumbStyle} />
      </div>
      <div style={buttonStyle} onClick={handleThumbDown}>
        <HoverableThumbDownIcon style={isBad ? selectedThumbStyle : thumbStyle} />
      </div>
    </div>
  })()

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
      {...props} style={style}
      onClick={isExpanded ? undefined : handleExpand}
      howToSeeMore={isExpanded ? null : 'Cliquez pour voir le contenu'}
    />
    {selectButtons}
  </div>
}
BootstrapAdviceCardBase.propTypes = {
  advice: PropTypes.object.isRequired,
  isBad: PropTypes.bool,
  isGood: PropTypes.bool,
  isSelectable: PropTypes.bool,
  isSelected: PropTypes.bool,
  onChangeSelection: PropTypes.func.isRequired,
  onThumbDown: PropTypes.func.isRequired,
  onThumbUp: PropTypes.func.isRequired,
}
const BootstrapAdviceCard = React.memo(BootstrapAdviceCardBase)


const emptyProject: bayes.bob.Project = {}


const ResourcesPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchBootstrapActions>()
  const user = useSelector(({user}: BootstrapState): bayes.bob.User => user)
  const {city, targetJob} = user.projects && user.projects[0] || {}
  const {cityId = undefined} = city || {}
  const {codeOgr: jobId = undefined} = targetJob || {}

  const [adviceModules, setAdviceModules] = useState<readonly ValidAdvice[]>([])

  useEffect((): (() => void) => {
    if (!cityId || !jobId) {
      return (): void => void 0
    }
    setAdviceModules([])
    const cancelable = makeCancelable(dispatch(computeAdvicesForProject(user)))
    cancelable.promise.then((response: void | bayes.bob.Advices): void => {
      if (response && response.advices) {
        setAdviceModules(response.advices.filter(isValidAdvice))
      }
    })
    return cancelable.cancel
  }, [cityId, dispatch, jobId, user])

  const handleCityChange = useCallback((city: bayes.bob.FrenchCity|null): void => {
    const {cityId: newCityId = undefined} = city || {}
    if (!newCityId || newCityId === cityId) {
      return
    }
    dispatch({city, type: SET_CITY})
  }, [dispatch, cityId])

  const handleJobChange = useCallback((job: bayes.bob.Job|null): void => {
    const {codeOgr: newJobId = undefined} = job || {}
    if (!newJobId || newJobId === jobId) {
      return
    }
    dispatch({job, type: SET_JOB})
  }, [dispatch, jobId])

  const {profile, projects: [project = emptyProject] = []} = user

  const navStyle: React.CSSProperties = {
    backgroundColor: colors.BOB_BLUE,
    padding: '8px 90px',
    position: 'relative',
  }
  const logoStyle: React.CSSProperties = {
    height: 24,
    left: 20,
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
  }
  const searchBarStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 5,
    display: 'flex',
    margin: 'auto',
    maxWidth: MAX_CONTENT_WIDTH,
  }
  const resourcesContainerStyle: React.CSSProperties = {
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
        <JobSuggest value={targetJob} onChange={handleJobChange} placeholder="métier" />
        <CitySuggest value={city} onChange={handleCityChange} placeholder="ville" />
      </div>
    </nav>
    <div style={resourcesContainerStyle}>
      {city && targetJob ? adviceModules.map((advice: ValidAdvice): React.ReactNode =>
        <ResourceAdviceCard
          key={advice.adviceId}
          style={{display: 'inline-block', marginBottom: 40, width: '100%'}}
          {...{advice, profile, project}} />) : null}
    </div>
  </React.Fragment>
}
const ResourcesPage = React.memo(ResourcesPageBase)


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


const ResourceAdviceCardBase = (props: ExpandedAdviceCardProps): React.ReactElement => {
  const {advice, style, ...cardContentProps} = props
  const {t} = useTranslation()
  const containerStyle = useMemo((): React.CSSProperties => ({
    fontSize: 16,
    ...style,
  }), [style])
  // TODO(pascal): Display only resources instead of full advice (e.g. drop
  // the extra text introducing the resources in each card).
  return <section style={containerStyle}>
    <header style={headerStyle}>
      <AdvicePicto adviceId={advice.adviceId} style={{height: 48, marginRight: 8}} />
      {getAdviceShortTitle(advice, t)}
    </header>
    <div style={cardStyle}>
      <ExpandedAdviceCardContent {...cardContentProps} {...{advice}} />
    </div>
  </section>
}
ResourceAdviceCardBase.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
  }).isRequired,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
}
const ResourceAdviceCard = React.memo(ResourceAdviceCardBase)


const history = createBrowserHistory()

const amplitudeMiddleware = createAmplitudeMiddleware(new Logger({
  ...actionTypesToLog,
  [SEND_ADVICE_SELECTION]: 'Send advice cards selection for external profile',
  [SET_USER]: 'Show advice cards for external profile',
}))
// Enable devTools middleware.
const finalCreateStore = composeWithDevTools(
  // sentryMiddleware needs to be first to correctly catch exception down the line.
  applyMiddleware(createSentryMiddleware(), thunk, amplitudeMiddleware, routerMiddleware(history)),
)(createStore)


type BootstrapUser = bayes.bob.User & {
  profile: bayes.bob.UserProfile
  projects: [bayes.bob.Project & {mobility?: {
    areaType?: bayes.bob.AreaType
    city?: bayes.bob.FrenchCity
  }}]
}


function bootstrapUserReducer(
  state: BootstrapUser = {profile: {}, projects: [{}]}, action: AllActions): BootstrapUser {
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
  }),
)
if (module.hot) {
  module.hot.accept(['store/app_reducer'], (): void => {
    const nextAppReducerModule = require('store/app_reducer')
    store.replaceReducer(combineReducers({
      app: nextAppReducerModule.app as typeof app,
      asyncState: nextAppReducerModule.asyncState as typeof asyncState,
      router: connectRouter(history),
      user: bootstrapUserReducer,
    }))
  })
}


const BootstrapSnackbar = connect(
  ({asyncState}: BootstrapState): {snack?: string} => ({
    snack: asyncState.errorMessage,
  }),
  (dispatch: DispatchBootstrapActions) => ({
    onHide: (): void => void dispatch(hideToasterMessageAction),
  }),
)(Snackbar)


const App = (): React.ReactElement => <Provider store={store}>
  <div style={{backgroundColor: '#fff', color: colors.DARK_TWO}}>
    <ConnectedRouter history={history}>
      <Suspense fallback={<WaitingPage />}>
        <Switch>
          <Route path={Routes.BOOTSTRAP_PAGE} component={BootstrapPage} />
          <Route path={Routes.RESOURCES_PAGE} component={ResourcesPage} />
        </Switch>
      </Suspense>
    </ConnectedRouter>
    <BootstrapSnackbar timeoutMillisecs={4000} />
  </div>
</Provider>
const AppMemo = React.memo(App)


export {AppMemo as App}
