import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {History, createBrowserHistory} from 'history'
import Storage from 'local-storage-fallback'
import {composeWithDevTools} from 'redux-devtools-extension'
import React, {useEffect, useMemo, useState} from 'react'
import {hot} from 'react-hot-loader/root'
import {connect, Provider, useDispatch, useSelector} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import {Store, createStore, applyMiddleware, combineReducers} from 'redux'
import thunk from 'redux-thunk'
import sha1 from 'sha1'

import createAmplitudeMiddleware from 'store/amplitude'
import {getJsonFromStorage} from 'store/app_reducer'
import createSentryMiddleware from 'store/sentry'

import {useTitleUpdate} from 'components/navigation'
import Snackbar from 'components/snackbar'

import BilanPage from './bilan'
import HubPage from './hub'
import LandingPage from './landing'
import QuestionPage from './question'
import UserLandingPage from './user_landing'
import {AnswerType} from '../answers'
import QUESTIONS_TREE, {Question, TopicId} from '../questions_tree'
import {Action, AppState, DispatchActions, Logger, MiniRootState, Routes,
  TopicPriority, UserState} from '../../store'
import ThankYouPage from './thank_you'

import '../../styles/mini.css'


type ConnectedQuestionPageProps = {question?: undefined} | Question & {
  answer?: AnswerType
  color?: string
  linkTo: string
  title: React.ReactNode
}


interface QuestionPageParams {
  questionUrl: string
  topicUrl: TopicId
}


const ConnectedQuestionPage = connect(
  (
    {user: {answers}}: MiniRootState,
    {match: {params: {questionUrl, topicUrl}}}: RouteComponentProps<QuestionPageParams>,
  ): ConnectedQuestionPageProps => {
    const {color = undefined, questions = [], title = undefined} =
      QUESTIONS_TREE.find(({url}): boolean => url === topicUrl) || {}
    const question: Question|undefined = questions.find(({url}): boolean => url === questionUrl)
    if (!question) {
      return {}
    }
    const topicAnswers = answers[topicUrl]
    return {
      ...question,
      answer: topicAnswers?.[questionUrl],
      color,
      linkTo: question?.nextUrl || Routes.HUB_PAGE,
      title,
    }
  },
  (
    dispatch: DispatchActions,
    {match: {params: {questionUrl, topicUrl}}}: RouteComponentProps<QuestionPageParams>,
  ): {onAnswer: (a: AnswerType) => void} => ({
    onAnswer: (answer: AnswerType): void => {
      dispatch({
        answer,
        question: questionUrl,
        topic: topicUrl,
        type: 'MINI_ONBOARDING_ANSWER',
      })
    },
  }),
)(QuestionPage)


const imageBackgroundStyle = {
  alignItems: 'center',
  borderRadius: 66,
  display: 'flex',
  height: 132,
  justifyContent: 'center',
  margin: '30px auto 15px',
  width: 132,
}


interface ConnectedPriorityQuestionPageProps extends Omit<Question, 'url'> {
  answer?: AnswerType
  color: string
  linkTo: string
  title: string
}


interface PriorityQuestionPageParams {
  topicUrl: TopicId
}


const ConnectedPriorityQuestionPage = connect(
  (
    {user: {priorities}}: MiniRootState,
    {match: {params: {topicUrl}}}: RouteComponentProps<PriorityQuestionPageParams>,
  ): ConnectedPriorityQuestionPageProps => {
    const topicIndex = QUESTIONS_TREE.findIndex(({url}): boolean => topicUrl === url)
    const {color, image, nextTopic, talkAboutIt, title} = QUESTIONS_TREE[topicIndex]
    return {
      answer: typeof topicUrl === 'undefined' ? undefined : priorities[topicUrl],
      color: colors.PEA,
      linkTo: nextTopic ? `/aborder/${nextTopic}` : Routes.THANKS_PAGE,
      numSteps: QUESTIONS_TREE.length,
      numStepsDone: topicIndex,
      // TODO(pascal): Handle non-masculine gender.
      question: talkAboutIt ? <React.Fragment>
        Je suis intéressé·e pour {talkAboutIt.startsWith('aborder') ?
          `${talkAboutIt} avec un professionnel de la Mission Locale` : talkAboutIt}
        <div style={{...imageBackgroundStyle, backgroundColor: color}}>
          <img src={image} alt="" style={{width: 120}} />
        </div>
        <div style={{color}}>{title}</div>
      </React.Fragment> : null,
      title: 'Mes priorités',
      type: 'yes/no/later',
    }
  },
  (
    dispatch: DispatchActions,
    {match: {params: {topicUrl}}}: RouteComponentProps<PriorityQuestionPageParams>,
  ): {onAnswer: (a: AnswerType) => void} => ({
    onAnswer: (answer: AnswerType): void => {
      dispatch({
        priority: answer as TopicPriority,
        topic: topicUrl,
        type: 'MINI_ONBOARDING_SET_TOPIC_PRIORITY',
      })
    },
  }),
)(QuestionPage)


const basename = window.location.pathname.startsWith('/mini') ? '/mini' : '/unml/a-li'


const MiniOnboardingPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchActions>()
  const hasSeenLanding = useSelector(
    ({app: {hasSeenLanding, orgInfo}}: MiniRootState): boolean =>
      !!hasSeenLanding || Object.values(orgInfo).some(Boolean),
  )
  const isUserSupervised = useSelector(
    ({app: {isUserSupervised}}: MiniRootState): boolean => !!isUserSupervised,
  )

  useEffect((): void => {
    const {hash, pathname, search} = window.location
    dispatch({hash: (hash || search).slice(1), type: 'MINI_ONBOARDING_LOAD'})
    if (hash || search) {
      window?.history?.replaceState(null, '', pathname)
    }
  }, [dispatch])

  useTitleUpdate(basename)

  return <div style={{fontFamily: 'Open Sans'}}>
    <Switch>
      <Route path={Routes.THANKS_PAGE} component={ThankYouPage} />
      <Route path={Routes.BILAN_PAGE} component={BilanPage} />
      <Route path={Routes.LANDING_PAGE} component={LandingPage} />
      <Route path={Routes.USER_LANDING_PAGE} component={UserLandingPage} />
      <Route path={Routes.HUB_PAGE} component={HubPage} />
      <Route path={Routes.PRIORITY_PATH} component={ConnectedPriorityQuestionPage} />
      <Route path={Routes.QUESTION_PATH} component={ConnectedQuestionPage} />
      <Redirect to={hasSeenLanding ? isUserSupervised ?
        Routes.HUB_PAGE : Routes.USER_LANDING_PAGE : Routes.LANDING_PAGE} />
    </Switch>
  </div>
}
const MiniOnboardingPage = React.memo(MiniOnboardingPageBase)


const STORAGE_PREFIX = 'ali-'
const initialUserState: UserState = {
  answers: {},
  isUserSupervised: !!Storage.getItem(`${STORAGE_PREFIX}isUserSupervised`),
  orgInfo: {
    advisor: Storage.getItem(`${STORAGE_PREFIX}advisor`) || '',
    city: getJsonFromStorage(`${STORAGE_PREFIX}city`) || {},
    email: Storage.getItem(`${STORAGE_PREFIX}email`) || '',
    milo: Storage.getItem(`${STORAGE_PREFIX}milo`) || '',
  },
  priorities: {},
}


function userReducer(state: UserState = initialUserState, action: Action): UserState {
  switch (action.type) {
    case 'MINI_ONBOARDING_LOAD':
      if (action.hash) {
        const user = JSON.parse(decodeURIComponent(action.hash))
        return {
          ...state,
          ...user,
        }
      }
      return state
    case 'MINI_ONBOARDING_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.topic]: {
            ...(state.answers && state.answers[action.topic]),
            [action.question]: action.answer,
          },
        },
      }
    case 'MINI_ONBOARDING_SET_TOPIC_PRIORITY':
      return {
        ...state,
        priorities: {
          ...state.priorities,
          [action.topic]: action.priority,
        },
      }
    case 'MINI_ONBOARDING_RESTART': {
      const {answers, priorities} = initialUserState
      const {userId: omittedUserId, ...otherState} = state
      return {
        ...otherState,
        answers,
        priorities,
      }
    }
    case 'MINI_ONBOARDING_SAVE':
      if (action.status) {
        return state
      }
      // See README.md#analytics for the design of the user ID.
      return {
        ...state,
        userId: state.userId || sha1(Math.random() + ''),
      }
    case 'MINI_UPDATE_ORG_INFO':
      return {
        ...state,
        orgInfo: {
          ...state.orgInfo,
          ...action.orgInfo,
        },
      }
  }
  return state
}

const initialAppState = {
  isUserSupervised: initialUserState.isUserSupervised,
  orgInfo: initialUserState.orgInfo,
}
function appReducer(state: AppState = initialAppState, action: Action): AppState {
  switch (action.type) {
    case 'MINI_ONBOARDING_FINISH_LANDING': {
      const {isUserSupervised} = action
      Storage.setItem(STORAGE_PREFIX + 'isUserSupervised', isUserSupervised ? '1' : '')
      return {
        ...state,
        hasSeenLanding: true,
        isUserSupervised,
      }
    }
    case 'MINI_UPDATE_ORG_INFO': {
      const {orgInfo} = action
      for (const [key, value] of Object.entries(orgInfo)) {
        if (value && typeof value !== 'string') {
          void (value && Storage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)))
        } else {
          void (value && Storage.setItem(STORAGE_PREFIX + key, value))
        }
      }
      return {
        ...state,
        orgInfo: {
          ...state.orgInfo,
          ...orgInfo,
        },
      }
    }
    case 'MINI_HIDE_TOASTER_MESSAGE': {
      const {errorMessage: omittedErrorMessage, ...otherState} = state
      return otherState
    }
    case 'MINI_DISPLAY_TOASTER_MESSAGE': {
      return {
        ...state,
        errorMessage: action.error,
      }
    }
  }
  return state
}


const MiniOnboardingSnackbar = connect(
  ({app}: MiniRootState): {snack?: string} => ({
    snack: app.errorMessage,
  }),
  (dispatch: DispatchActions) => ({
    onHide: (): void => void dispatch({type: 'MINI_HIDE_TOASTER_MESSAGE'}),
  }),
)(Snackbar)


interface AppComponentState {
  history: History
  store: Store<MiniRootState, Action>
}


const App = (): React.ReactElement => {
  const state = useMemo((): AppComponentState => {
    const history = createBrowserHistory({basename})

    const amplitudeMiddleware = createAmplitudeMiddleware(new Logger({
      MINI_GENERATE_SUMMARY: 'Bilan achevé',
      MINI_ONBOARDING_ANSWER: 'Une question au formulaire répondue',
      MINI_ONBOARDING_LOAD: 'Formulaire ouvert',
      MINI_ONBOARDING_SAVE: 'Bilan sauvegardé par email',
      MINI_ONBOARDING_SET_TOPIC_PRIORITY: 'Une priorité choisie',
      MINI_OPEN_SUMMARY: 'Bilan final affiché',
      MINI_PRINT_SUMMARY: 'Bilan final imprimé',
    }), config.aliAmplitudeToken)
    // Enable devTools middleware.
    const finalCreateStore = composeWithDevTools(applyMiddleware(
      // sentryMiddleware needs to be first to correctly catch exception down the line.
      createSentryMiddleware(),
      thunk,
      amplitudeMiddleware,
      routerMiddleware(history),
    ))(createStore)

    // Create the store that will be provided to connected components via Context.
    const store = finalCreateStore(
      combineReducers({
        app: appReducer,
        router: connectRouter(history),
        user: userReducer,
      }),
    )

    window.addEventListener('beforeunload', (): void => {
      store.dispatch({type: 'MINI_ONBOARDING_UNLOAD'})
    })

    return {history, store}
  }, [])
  const [history] = useState(state.history)
  const [store] = useState(state.store)

  return <Provider store={store}>
    <ConnectedRouter history={history}>
      <Route path="*" component={MiniOnboardingPage} />
    </ConnectedRouter>
    <MiniOnboardingSnackbar timeoutMillisecs={4000} />
  </Provider>
}


export default hot(React.memo(App))
