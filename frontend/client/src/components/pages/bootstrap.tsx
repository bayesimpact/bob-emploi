import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import i18n from 'i18next'
import {createBrowserHistory} from 'history'
import _keyBy from 'lodash/keyBy'
import ThumbDownIcon from 'mdi-react/ThumbDownIcon'
import ThumbUpIcon from 'mdi-react/ThumbUpIcon'
import PropTypes from 'prop-types'
import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {hot} from 'react-hot-loader/root'
import {useTranslation} from 'react-i18next'
import {connect, Provider, useDispatch, useSelector} from 'react-redux'
import {Redirect, Route, Switch, useLocation} from 'react-router'
import {Action, createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import useMedia from 'hooks/media'
import {BootstrapAction, BootstrapState, DispatchBootstrapActions, actionTypesToLog,
  computeAdvicesForProject, convertFromProto, convertToProto, displayToasterMessage,
  sendAdviceFeedback, hideToasterMessageAction} from 'store/actions'
import {ValidAdvice, getAdviceShortTitle, isValidAdvice} from 'store/advice'
import createAmplitudeMiddleware from 'store/amplitude'
import {app, asyncState} from 'store/app_reducer'
import {inCityPrefix, lowerFirstLetter, maybeContractPrefix} from 'store/french'
import {init as i18nInit} from 'store/i18n'
import {Logger} from 'store/logging'
import {useAsynceffect} from 'store/promise'
import createSentryMiddleware from 'store/sentry'
import {addProjectIds} from 'store/user'

import {AdvicePicto, ExplorerAdviceCard, ExplorerAdviceCardConfig} from 'components/advisor'
import Button from 'components/button'
import Checkbox from 'components/checkbox'
import ExternalLink from 'components/external_link'
import {Inputable} from 'components/input'
import {Modal, ModalConfig} from 'components/modal'
import {useRadium} from 'components/radium'
import Snackbar from 'components/snackbar'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import {Routes} from 'components/url'

import 'normalize.css'
import 'styles/App.css'

import ResourcesPage, {modulesFromURL} from './bootstrap/resources'
import WaitingPage from './waiting'

i18nInit()


interface SetAdviceIdsAction extends Action<'SET_ADVICE_SELECTION'> {
  adviceIds: readonly string[]
}

interface SetUserAction extends Action<'SET_USER'> {
  user: BootstrapUser
}

interface SetCityAction extends Action<'SET_CITY'> {
  city: bayes.bob.FrenchCity
}

interface SetJobAction extends Action<'SET_JOB'> {
  job: bayes.bob.Job
}

interface SetFeaturesAction extends Action<'SET_FEATURES'> {
  features: bayes.bob.Features
}

interface SetLocaleAction extends Action<'SET_LOCALE'> {
  locale: string
}

type SendAdviceSelectionAction = Action<'SEND_ADVICE_SELECTION'>

type AllActions =
  | BootstrapAction
  | SendAdviceSelectionAction
  | SetAdviceIdsAction
  | SetCityAction
  | SetFeaturesAction
  | SetJobAction
  | SetLocaleAction
  | SetUserAction


type IconProps = Omit<React.ComponentProps<typeof ThumbDownIcon>, 'style'> & {
  style?: RadiumCSSProperties
}


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
  const {t} = useTranslation()

  const handleSendSelection = useCallback((): void => {
    dispatch({type: 'SEND_ADVICE_SELECTION'})
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
          {getAdviceShortTitle(advicesById[adviceId], t)}
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


const BootstrapPageBase = (): React.ReactElement => {
  const user = useSelector(({user}: BootstrapState): bayes.bob.User => user)
  const adviceIds = useSelector(({adviceIds}: BootstrapState) => adviceIds)
  const isEditorEnabled = !adviceIds.length
  const {t} = useTranslation()

  const dispatch = useDispatch<DispatchBootstrapActions>()
  const [badAdvices, setBadAdvices] = useState(new Set<string>())
  const [goodAdvices, setGoodAdvices] = useState(new Set<string>())
  const [cachedSharedUrl, setCachedSharedUrl] = useState<string|undefined>(undefined)
  const [selectedAdvices, setSelectedAdvices] = useState(new Set(adviceIds || []))
  useEffect(() => setSelectedAdvices(new Set(adviceIds || [])), [adviceIds])

  const [actualAdvices, setActualAdvices] = useState<readonly bayes.bob.Advice[]>([])
  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    const response = await dispatch(computeAdvicesForProject(user))
    if (!response || !response.advices || checkIfCanceled()) {
      return
    }
    setActualAdvices(response.advices)
  }, [dispatch, user])

  const advices = useMemo(
    (): readonly ValidAdvice[] => isEditorEnabled ?
      actualAdvices.filter(isValidAdvice) :
      actualAdvices.filter(isValidAdvice).
        filter(({adviceId}): boolean => selectedAdvices.has(adviceId)),
    [actualAdvices, isEditorEnabled, selectedAdvices],
  )
  const advicesById = useMemo(() => _keyBy(advices, 'adviceId'), [advices])

  useAsynceffect(async (checkIfCanceled) => {
    if (!isEditorEnabled || !selectedAdvices.size) {
      return
    }
    const userWithAdviceSelection = {
      adviceIds: [...selectedAdvices],
      user,
    }
    setCachedSharedUrl(undefined)
    const proto = await dispatch(convertToProto(
      'userWithAdviceSelection', userWithAdviceSelection))
    if (!proto || checkIfCanceled()) {
      return
    }
    setCachedSharedUrl(proto)
  }, [dispatch, isEditorEnabled, selectedAdvices, user])

  const project = (user.projects || []).find((p): boolean => !!p)

  const getAdvice = useCallback((adviceId: string): bayes.bob.Advice|undefined => {
    return advices.find(({adviceId: otherAdviceId}): boolean => adviceId === otherAdviceId)
  }, [advices])

  const handleAdviceChangeSelection = useCallback((adviceId: string, isSelected: boolean): void => {
    if (selectedAdvices.has(adviceId) === isSelected) {
      return
    }
    const newSelectedAdvices = new Set(selectedAdvices)
    if (isSelected) {
      newSelectedAdvices.add(adviceId)
    } else {
      newSelectedAdvices.delete(adviceId)
    }
    setSelectedAdvices(newSelectedAdvices)
  }, [selectedAdvices])

  const [badAdviceId, setBadAdviceId] = useState('')
  const hideBadAdviceModal = useCallback((): void => setBadAdviceId(''), [])
  const handleBadAdviceConfirm = useCallback((feedback: string): void => {
    const newBadAdvices = new Set(badAdvices)
    newBadAdvices.add(badAdviceId)
    setBadAdvices(newBadAdvices)
    const newGoodAdvices = new Set(goodAdvices)
    newGoodAdvices.delete(badAdviceId)
    setGoodAdvices(newGoodAdvices)
    setBadAdviceId('')
    const advice = getAdvice(badAdviceId)
    dispatch(sendAdviceFeedback(project, advice, {feedback}, t, 1))
  }, [badAdviceId, badAdvices, getAdvice, goodAdvices, dispatch, project, t])

  const handleThumbUp = useCallback((adviceId: string): void => {
    const advice = getAdvice(adviceId)
    if (!advice || !advice.adviceId) {
      return
    }
    const newGoodAdvices = new Set(goodAdvices)
    newGoodAdvices.add(advice.adviceId)
    setGoodAdvices(newGoodAdvices)
    const newBadAdvices = new Set(badAdvices)
    newBadAdvices.delete(advice.adviceId)
    setBadAdvices(newBadAdvices)
    dispatch(sendAdviceFeedback(project, advice, {}, t, 5))
  }, [badAdvices, dispatch, getAdvice, goodAdvices, project, t])

  if (!project || !advices) {
    return <div>{t('Chargement…')}</div>
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
      isShown={!!badAdviceId}
      onClose={hideBadAdviceModal}
      onConfirm={handleBadAdviceConfirm} />
    <div style={{margin: '0 300px'}}>
      {advices.
        filter(({adviceId}: ValidAdvice): boolean =>
          !modulesFromURL.size || modulesFromURL.has(adviceId) || modulesFromURL.has('all')).
        map((advice: ValidAdvice): React.ReactNode => <BootstrapAdviceCard
          key={advice.adviceId} advice={advice} isSelectable={isEditorEnabled}
          isSelected={selectedAdvices.has(advice.adviceId)} isBad={badAdvices.has(advice.adviceId)}
          isGood={goodAdvices.has(advice.adviceId)}
          onChangeSelection={handleAdviceChangeSelection}
          onThumbDown={setBadAdviceId}
          onThumbUp={handleThumbUp}
          project={project} />)}
    </div>
    {isEditorEnabled ?
      <Selection
        selectedAdvices={selectedAdvices} advicesById={advicesById} user={user}
        cachedSharedUrl={cachedSharedUrl || null} style={selectionStyle} /> : null}
  </React.Fragment>
}
const BootstrapPage = React.memo(BootstrapPageBase)


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
  const {t} = useTranslation()
  const media = useMedia()
  const [isExpanded, setIsExpanded] = useState(media === 'print')

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
      display: 'block',
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
      <button
        style={buttonStyle} onClick={handleChangeSelection}
        aria-label={isSelected ? t('Retirer de la sélection') : t('Ajouter à la sélection')}>
        <Checkbox isSelected={isSelected} />
      </button>
      <button style={buttonStyle} onClick={handleThumbUp} aria-checked={isGood} role="checkbox">
        <HoverableThumbUpIcon
          style={isGood ? selectedThumbStyle : thumbStyle} aria-label={t("C'est un bon conseil")} />
      </button>
      <button style={buttonStyle} onClick={handleThumbDown} aria-checked={isBad} role="checkbox">
        <HoverableThumbDownIcon
          style={isBad ? selectedThumbStyle : thumbStyle}
          aria-label={t("C'est un mauvais conseil")} />
      </button>
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

const history = createBrowserHistory()

const amplitudeMiddleware = createAmplitudeMiddleware(new Logger({
  ...actionTypesToLog,
  SEND_ADVICE_SELECTION: 'Send advice cards selection for external profile',
  SET_USER: 'Show advice cards for external profile',
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

const initState: BootstrapUser = {
  featuresEnabled: {allModules: !!modulesFromURL.size},
  profile: {},
  projects: [{}],
}
function bootstrapUserReducer(state = initState, action: AllActions): BootstrapUser {
  if (action.type === 'SET_USER') {
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
  if (action.type === 'SET_JOB') {
    return {
      ...state,
      projects: [{
        ...state.projects[0],
        targetJob: action.job,
      }],
    }
  }
  if (action.type === 'SET_CITY') {
    return {
      ...state,
      projects: [{
        ...state.projects[0],
        city: action.city,
      }],
    }
  }
  if (action.type === 'SET_FEATURES') {
    return {
      ...state,
      featuresEnabled: action.features,
    }
  }
  if (action.type === 'SET_LOCALE') {
    return {
      ...state,
      profile: {
        ...state.profile,
        locale: action.locale,
      },
    }
  }
  return state
}

const adviceSelectionReducer = (state: readonly string[] = [], action: AllActions):
readonly string[] => {
  if (action.type === 'SET_ADVICE_SELECTION') {
    return action.adviceIds
  }
  return state
}


// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(
  combineReducers({
    adviceIds: adviceSelectionReducer,
    app,
    asyncState,
    router: connectRouter(history),
    user: bootstrapUserReducer,
  }),
)
if (module.hot) {
  module.hot.accept(['store/app_reducer'], async (): Promise<void> => {
    const nextAppReducerModule = await import('store/app_reducer')
    store.replaceReducer(combineReducers({
      adviceIds: adviceSelectionReducer,
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


const fetchUserInput = async (hashString: string, dispatch: DispatchBootstrapActions) => {
  try {
    return hashString.startsWith('{') ?
      await parseJsonAsync<InputUser>(hashString) :
      await dispatch(convertFromProto('userWithAdviceSelection', hashString))
  } catch (error) {
    dispatch(displayToasterMessage(`${error.message} en parsant ${hashString}`))
  }
}

const installationPage: Record<string, React.ComponentType<unknown>> = {}
// Add a page available from /conseiller/..., usually to install a bookmarklet.
export const addInstallationPage = (
  path: string, component: React.ComponentType<unknown>): void => {
  if (installationPage[path]) {
    throw new Error(`${Routes.BOOTSTRAP_ROOT}${path} is already defined`)
  }
  installationPage[path] = component
}


const UserConnectedPageBase = (): React.ReactElement => {
  const {hash} = useLocation()
  const dispatch = useDispatch<DispatchBootstrapActions>()

  useAsynceffect(async (checkIfCanceled): Promise<void> => {
    if (hash.length <= 1) {
      return
    }
    const hashString = decodeURIComponent(hash.slice(1))
    const userInput = await fetchUserInput(hashString, dispatch)
    if (!userInput || checkIfCanceled()) {
      return
    }
    if (isUserWithAdviceSelection(userInput)) {
      if (!userInput.user) {
        return
      }
      dispatch({type: 'SET_USER', user: addProjectIds(userInput.user)})
      dispatch({adviceIds: userInput.adviceIds || [], type: 'SET_ADVICE_SELECTION'})
    } else {
      dispatch({
        type: 'SET_USER',
        user: addProjectIds(userInput),
      })
    }
  }, [dispatch, hash])

  const {i18n} = useTranslation()
  useEffect((): void => {
    dispatch({locale: i18n.language, type: 'SET_LOCALE'})
  }, [dispatch, i18n.language])

  return <Switch>
    <Route path={Routes.BOOTSTRAP_PAGE} component={BootstrapPage} />
    <Route path={Routes.RESOURCES_PAGE} component={ResourcesPage} />
    {Object.entries(installationPage).map(([path, component]) =>
      <Route key={path} path={`${Routes.BOOTSTRAP_ROOT}${path}`} component={component} />)}
    <Redirect to={Routes.RESOURCES_PAGE} />
  </Switch>
}
const UserConnectedPage = React.memo(UserConnectedPageBase)

const App = () => <Provider store={store}>
  <div style={{backgroundColor: '#fff', color: colors.DARK_TWO}}>
    <ConnectedRouter history={history}>
      <Suspense fallback={<WaitingPage />}>
        <UserConnectedPage />
      </Suspense>
    </ConnectedRouter>
    <BootstrapSnackbar timeoutMillisecs={4000} />
  </div>
</Provider>



export default hot(React.memo(App))
