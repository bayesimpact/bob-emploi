import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {History, createBrowserHistory} from 'history'
import Storage from 'local-storage-fallback'
import PropTypes from 'prop-types'
import {composeWithDevTools} from 'redux-devtools-extension'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Redirect, Route, Switch} from 'react-router-dom'
import {Store, createStore, applyMiddleware, combineReducers} from 'redux'
import thunk from 'redux-thunk'
import sha1 from 'sha1'

import {createAmplitudeMiddleware} from 'store/amplitude'
import {createSentryMiddleware} from 'store/sentry'

import {useTitleUpdate} from 'components/navigation'
import {Snackbar} from 'components/snackbar'

import {BilanPage} from './mini/bilan'
import {HubPage} from './mini/hub'
import {LandingPage} from './mini/landing'
import {QuestionPage} from './mini/question'
import {UserLandingPage} from './mini/user_landing'
import {AnswerType, Question, QUESTIONS_TREE, TopicId} from './mini/questions_tree'
import {Action, AppState, DispatchActions, Logger, MiniRootState, PageProps, Routes,
  TopicPriority, UserState} from './mini/store'
import {ThankYouPage} from './mini/thank_you'

require('styles/mini.css')


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
      color: colors.MINI_PEA,
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


// TODO(cyrille): Drop the component once MiniOnboardingPage is a functional component.
const TitleUpdate: React.FC<{}> = (): null => {
  useTitleUpdate(basename)
  return null
}

class MiniOnboardingPageBase extends React.PureComponent<PageProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    hasSeenLanding: PropTypes.bool.isRequired,
    isUserSupervised: PropTypes.bool.isRequired,
  }

  public componentDidMount(): void {
    this.props.dispatch({hash: window.location.hash.slice(1), type: 'MINI_ONBOARDING_LOAD'})
  }

  public render(): React.ReactNode {
    return <div style={{fontFamily: 'Open Sans'}}>
      <TitleUpdate />
      <Switch>
        <Route path={Routes.THANKS_PAGE} component={ThankYouPage} />
        <Route path={Routes.BILAN_PAGE} component={BilanPage} />
        <Route path={Routes.LANDING_PAGE} component={LandingPage} />
        <Route path={Routes.USER_LANDING_PAGE} component={UserLandingPage} />
        <Route path={Routes.HUB_PAGE} component={HubPage} />
        <Route path={Routes.PRIORITY_PATH} component={ConnectedPriorityQuestionPage} />
        <Route path={Routes.QUESTION_PATH} component={ConnectedQuestionPage} />
        <Redirect to={this.props.hasSeenLanding ? this.props.isUserSupervised ?
          Routes.HUB_PAGE : Routes.USER_LANDING_PAGE : Routes.LANDING_PAGE} />
      </Switch>
    </div>
  }
}
const MiniOnboardingPage =
  connect(({app: {hasSeenLanding, isUserSupervised, orgInfo}}: MiniRootState) => ({
    hasSeenLanding: !!hasSeenLanding || Object.values(orgInfo).some(Boolean),
    isUserSupervised: !!isUserSupervised,
  }))(MiniOnboardingPageBase)


const STORAGE_PREFIX = 'ali-'
const initialUserState: UserState = {
  answers: {},
  isUserSupervised: !!Storage.getItem(`${STORAGE_PREFIX}isUserSupervised`),
  orgInfo: {
    advisor: Storage.getItem(`${STORAGE_PREFIX}advisor`) || '',
    departement: Storage.getItem(`${STORAGE_PREFIX}departement`) || '',
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
      Object.entries(orgInfo).forEach(([key, value]: [string, string|undefined]): void =>
        void (value && Storage.setItem(STORAGE_PREFIX + key, value)))
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


class App extends React.PureComponent<{}, AppComponentState> {
  private static createBrowserHistoryAndStore(): AppComponentState {
    const history = createBrowserHistory({basename})

    const amplitudeMiddleware = createAmplitudeMiddleware(new Logger({
      MINI_GENERATE_SUMMARY: 'Bilan achevé',
      MINI_ONBOARDING_ANSWER: 'Une question au formulaire répondue',
      MINI_ONBOARDING_LOAD: 'Formulaire ouvert',
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
    return {history, store}
  }

  public state = App.createBrowserHistoryAndStore()

  public render(): React.ReactNode {
    const {history, store} = this.state
    return <Provider store={store}>
      <ConnectedRouter history={history}>
        <Route path="*" component={MiniOnboardingPage} />
      </ConnectedRouter>
      <MiniOnboardingSnackbar timeoutMillisecs={4000} />
    </Provider>
  }
}


export {App}
