import {ConnectedRouter, connectRouter, routerMiddleware} from 'connected-react-router'
import createHistory from 'history/createBrowserHistory'
import PropTypes from 'prop-types'
import {composeWithDevTools} from 'redux-devtools-extension'
import Radium from 'radium'
import React from 'react'
import {connect, Provider} from 'react-redux'
import {Route, Switch} from 'react-router-dom'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import RavenMiddleware from 'redux-raven-middleware'
import thunk from 'redux-thunk'

import {createAmplitudeMiddleware} from 'store/amplitude'

import {BilanPage} from './mini/bilan'
import {HubPage} from './mini/hub'
import {QuestionPage} from './mini/question'
import {QUESTIONS_TREE} from './mini/questions_tree'
import {MINI_ONBOARDING_RESTART, ThankYouPage} from './mini/thank_you'

require('styles/mini.css')

const MINI_ONBOARDING_ANSWER = 'MINI_ONBOARDING_ANSWER'
const MINI_ONBOARDING_LOAD = 'MINI_ONBOARDING_LOAD'
const MINI_ONBOARDING_SET_TOPIC_PRIORITY = 'MINI_ONBOARDING_SET_TOPIC_PRIORITY'


const ConnectedQuestionPage = connect(
  ({user: {answers}}, {question, topic: {color, title, url}}) => ({
    ...question,
    answer: answers[url] && answers[url][question.url],
    color,
    linkTo: `/mini/${question.nextUrl || ''}`,
    title,
  }),
  (dispatch, {question, topic: {url}}) => ({
    onAnswer: answer => dispatch({
      answer,
      question: question.url,
      topic: url,
      type: MINI_ONBOARDING_ANSWER,
    }),
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


const ConnectedPriorityQuestionPage = connect(
  ({user: {priorities}}, {topic: {color, image, nextTopic, talkAboutIt, title, url}}) => ({
    answer: priorities[url],
    color: colors.MINI_PEA,
    linkTo: nextTopic ? `/mini/aborder/${nextTopic}` : '/mini/merci',
    // TODO(pascal): Handle non-masculine gender.
    question: <React.Fragment>
      Je suis intéressé pour {talkAboutIt.match(/^aborder/) ?
        `${talkAboutIt} avec un professionnel de la Mission Locale` : talkAboutIt}
      <div style={{...imageBackgroundStyle, backgroundColor: color}}>
        <img src={image} alt="" style={{width: 120}} />
      </div>
      <div style={{color}}>{title}</div>
    </React.Fragment>,
    title: 'Mes priorités',
    type: 'yes/no/later',
  }),
  (dispatch, {topic: {url}}) => ({
    onAnswer: answer => dispatch({
      priority: answer,
      topic: url,
      type: MINI_ONBOARDING_SET_TOPIC_PRIORITY,
    }),
  }),
)(QuestionPage)


class MiniOnboardingPageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
  }

  componentDidMount() {
    this.props.dispatch({type: MINI_ONBOARDING_LOAD})
  }

  renderRoutesForTopic(topic) {
    const {questions = [], url} = topic
    return questions.map(question => <Route
      path={`/mini/${url}/${question.url}`} key={`${url}/${question.url}`}
      render={() => <ConnectedQuestionPage topic={topic} question={question} />} />)
  }

  renderRouteForPriority = (topic, index) => {
    const path = `/mini/aborder/${topic.url}`
    return <Route key={path} path={path} render={() => <ConnectedPriorityQuestionPage
      topic={topic} numSteps={QUESTIONS_TREE.length} numStepsDone={index}
    />} />
  }

  render() {
    return <div style={{fontFamily: 'Open Sans'}}>
      <Switch>
        {[].concat(...QUESTIONS_TREE.map(this.renderRoutesForTopic))}
        {QUESTIONS_TREE.map(this.renderRouteForPriority)}
        <Route path="/mini/merci" component={ThankYouPage} />
        <Route path="/mini/bilan" component={BilanPage} />
        <Route path="*" component={HubPage} />
      </Switch>
    </div>
  }
}
const MiniOnboardingPage = connect()(MiniOnboardingPageBase)


const initialUserState = {answers: {}, priorities: {}}


function userReducer(state = initialUserState, action) {
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


class App extends React.Component {
  static createHistoryAndStore() {
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

  state = App.createHistoryAndStore()

  render() {
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
