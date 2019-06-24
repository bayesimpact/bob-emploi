import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import {History, createBrowserHistory} from 'history'
import PropTypes from 'prop-types'
import {composeWithDevTools} from 'redux-devtools-extension'
import Radium from 'radium'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import {Route, Switch} from 'react-router-dom'
import {Store, createStore, applyMiddleware, combineReducers} from 'redux'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'


import {createAmplitudeMiddleware} from 'store/amplitude'

import {BilanPage} from './mini/bilan'
import {HubPage} from './mini/hub'
import {QuestionPage} from './mini/question'
import {AnswerType, Question, QUESTIONS_TREE} from './mini/questions_tree'
import {Action, DispatchActions, MINI_ONBOARDING_ANSWER, MINI_ONBOARDING_LOAD,
  MINI_ONBOARDING_RESTART, MINI_ONBOARDING_SET_TOPIC_PRIORITY, RootState, TopicPriority,
  UserState} from './mini/store'
import {ThankYouPage} from './mini/thank_you'

require('styles/mini.css')


interface ConnectedQuestionPageProps extends Question {
  answer: AnswerType
  color: string
  linkTo: string
  title: React.ReactNode
}


interface QuestionPageParams {
  questionUrl: string
  topicUrl: string
}


const ConnectedQuestionPage = connect(
  (
    {user: {answers}}: RootState,
    {match: {params: {questionUrl, topicUrl}}}: RouteComponentProps<QuestionPageParams>,
  ): ConnectedQuestionPageProps => {
    const {color = undefined, questions = [], title = undefined} =
      QUESTIONS_TREE.find(({url}): boolean => url === topicUrl) || {}
    const question: Question = questions.find(({url}): boolean => url === questionUrl)
    return {
      ...question,
      answer: answers[topicUrl] ? answers[topicUrl][questionUrl] : undefined,
      color,
      linkTo: `/mini/${question.nextUrl || ''}`,
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
        type: MINI_ONBOARDING_ANSWER,
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


interface ConnectedPriorityQuestionPageProps
  extends Pick<Question, Exclude<keyof Question, 'url'>> {
  answer: AnswerType
  color: string
  linkTo: string
  title: string
}


interface PriorityQuestionPageParams {
  topicUrl: string
}


const ConnectedPriorityQuestionPage = connect(
  (
    {user: {priorities}}: RootState,
    {match: {params: {topicUrl}}}: RouteComponentProps<PriorityQuestionPageParams>,
  ): ConnectedPriorityQuestionPageProps => {
    const topicIndex = QUESTIONS_TREE.findIndex(({url}): boolean => topicUrl === url)
    const {color, image, nextTopic, talkAboutIt, title} = QUESTIONS_TREE[topicIndex]
    return {
      answer: priorities[topicUrl],
      color: colors.MINI_PEA,
      linkTo: nextTopic ? `/mini/aborder/${nextTopic}` : '/mini/merci',
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
        type: MINI_ONBOARDING_SET_TOPIC_PRIORITY,
      })
    },
  }),
)(QuestionPage)


class MiniOnboardingPageBase extends React.PureComponent<{dispatch: DispatchActions}> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
  }

  public componentDidMount(): void {
    this.props.dispatch({type: MINI_ONBOARDING_LOAD})
  }

  public render(): React.ReactNode {
    return <div style={{fontFamily: 'Open Sans'}}>
      <Switch>
        <Route path="/mini/merci" component={ThankYouPage} />
        <Route path="/mini/bilan" component={BilanPage} />
        <Route path="/mini/aborder/:topicUrl" component={ConnectedPriorityQuestionPage} />
        <Route path="/mini/:topicUrl/:questionUrl" component={ConnectedQuestionPage} />
        <Route path="*" component={HubPage} />
      </Switch>
    </div>
  }
}
const MiniOnboardingPage = connect()(MiniOnboardingPageBase)


const initialUserState = {answers: {}, priorities: {}}


function userReducer(state: UserState = initialUserState, action: Action): UserState {
  if (action.type === MINI_ONBOARDING_ANSWER) {
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
  }
  if (action.type === MINI_ONBOARDING_SET_TOPIC_PRIORITY) {
    return {
      ...state,
      priorities: {
        ...state.priorities,
        [action.topic]: action.priority,
      },
    }
  }
  if (action.type === MINI_ONBOARDING_RESTART) {
    return initialUserState
  }
  return state
}


interface AppState {
  history: History
  store: Store<RootState, Action>
}


class App extends React.PureComponent<{}, AppState> {
  private static createBrowserHistoryAndStore(): AppState {
    const history = createBrowserHistory()

    const ravenMiddleware = RavenMiddleware(config.sentryDSN, {release: config.clientVersion}, {
      stateTransformer: function(state): {} {
        return {
          ...state,
          // Don't send user info to Sentry.
          user: 'Removed with ravenMiddleware stateTransformer',
        }
      },
    })
    const amplitudeMiddleware = createAmplitudeMiddleware({
      [MINI_ONBOARDING_ANSWER]: 'Answer mini onboarding',
      [MINI_ONBOARDING_LOAD]: 'Load mini onboarding',
      [MINI_ONBOARDING_SET_TOPIC_PRIORITY]: 'Mini onboarding set topic priority',
    })
    // Enable devTools middleware.
    const finalCreateStore = composeWithDevTools(applyMiddleware(
      // ravenMiddleware needs to be first to correctly catch exception down the line.
      ravenMiddleware,
      thunk,
      amplitudeMiddleware,
      routerMiddleware(history),
    ))(createStore)

    // Create the store that will be provided to connected components via Context.
    const store = finalCreateStore(
      combineReducers({
        router: connectRouter(history),
        user: userReducer,
      })
    )
    return {history, store}
  }

  public state = App.createBrowserHistoryAndStore()

  public render(): React.ReactNode {
    const {history, store} = this.state
    return <Provider store={store}>
      <Radium.StyleRoot>
        <ConnectedRouter history={history}>
          <Route path="*" component={MiniOnboardingPage} />
        </ConnectedRouter>
      </Radium.StyleRoot>
    </Provider>
  }
}


export {App}
