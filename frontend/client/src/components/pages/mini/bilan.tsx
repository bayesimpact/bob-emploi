import CheckboxBlankOutlineIcon from 'mdi-react/CheckboxBlankOutlineIcon'
import CheckboxMarkedOutlineIcon from 'mdi-react/CheckboxMarkedOutlineIcon'
import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import greyFacesImage from 'images/mini/grey-faces.png'
import greyLevelsImage from 'images/mini/grey-levels.svg'
import greyTriangleImage from 'images/mini/grey-triangle.svg'
import greyYesNoImage from 'images/mini/grey-yes-no.svg'
import level1Image from 'images/mini/level-1.svg'
import level2Image from 'images/mini/level-2.svg'
import level3Image from 'images/mini/level-3.svg'
import level4Image from 'images/mini/level-4.svg'
import logoRDMLImage from 'images/mini/logo_reseau_de_ml_largeur.jpg'
import notAtAllImage from 'images/mini/not-at-all.png'
import notReallyImage from 'images/mini/not-really.png'
import yellowCheckImage from 'images/mini/yellow-check.svg'
import yellowCrossImage from 'images/mini/yellow-cross.svg'
import yesImage from 'images/mini/yes.png'
import yesClearlyImage from 'images/mini/yes-clearly.png'

import {RootState, TopicPriority} from './store'
import {AnswerType, QUESTIONS_TREE, QuestionType, Topic, TopicId} from './questions_tree'


const facesMap = {
  '-1': {
    alt: 'Pas très bien',
    src: notReallyImage,
  },
  '-2': {
    alt: 'Pas bien du tout',
    src: notAtAllImage,
  },
  '1': {
    alt: 'Plutôt bien',
    src: yesImage,
  },
  '2': {
    alt: 'Très bien',
    src: yesClearlyImage,
  },
}

const yesNoMap = {
  false: {
    alt: 'Problématique',
    src: yellowCrossImage,
  },
  true: {
    alt: 'OK',
    src: yellowCheckImage,
  },
}

const levelsMap = {
  '-1': {
    alt: 'Pas très bien',
    src: level2Image,
  },
  '-2': {
    alt: 'Pas bien du tout',
    src: level1Image,
  },
  '1': {
    alt: 'Plutôt bien',
    src: level3Image,
  },
  '2': {
    alt: 'Très bien',
    src: level4Image,
  },
}


interface BilanCardProps {
  answers: {}
  priority?: TopicPriority
  style?: React.CSSProperties
  topic: Topic
}


class BilanCard extends React.PureComponent<BilanCardProps> {
  public static propTypes = {
    answers: PropTypes.object.isRequired,
    priority: PropTypes.oneOf([false, true, 'later']),
    style: PropTypes.object,
    topic: PropTypes.shape({
      color: PropTypes.string.isRequired,
      image: PropTypes.string.isRequired,
      questions: PropTypes.arrayOf(PropTypes.shape({
        type: PropTypes.oneOf(['yes/no', 'confidence', 'levels']).isRequired,
        url: PropTypes.string.isRequired,
      }).isRequired).isRequired,
      title: PropTypes.string.isRequired,
    }).isRequired,
  }

  public renderPriority(priority?: TopicPriority): React.ReactNode {
    if (!priority) {
      return null
    }
    const isLater = priority === 'later'
    return <div style={{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ['WebkitPrintColorAdjust' as any]: 'exact',
      backgroundColor: isLater ? colors.MINI_FOOTER_GREY : colors.MINI_PEA,
      borderRadius: '0.9375em',
      color: '#fff',
      padding: '0.9375em 2.1875em',
      position: 'absolute',
      right: 0,
      top: 0,
    }}>
      {isLater ? 'Et aussi…' : 'Priorité'}
    </div>
  }

  public renderAnswer(
    title: string, type: QuestionType, legendImage: string,
    style: React.CSSProperties, answerMap): React.ReactNode {
    const {answers, topic: {questions}} = this.props
    const columnStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      textAlign: 'center',
      ...style,
    }
    const question = questions.find(({type: questionType}): boolean => questionType === type)
    const answer = question && answers[question.url]
    return <div style={columnStyle}>
      <span style={{color: colors.COOL_GREY, marginBottom: '0.5em'}}>{title}</span>
      {answer === undefined ? null : <React.Fragment>
        {answerMap && answerMap[answer] ?
          <img alt={answer} style={{height: '1.875em'}} {...answerMap[answer]} /> :
          <span>{answer + ''}</span>}
        <img src={greyTriangleImage} alt="" style={{margin: '0.5em', width: '0.5em'}} />
      </React.Fragment>}
      <img src={legendImage} alt="" style={{height: '1.25em'}} />
    </div>
  }

  public render(): React.ReactNode {
    const {priority, style, topic: {color, image, title}} = this.props
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      width: '21.25em',
      ...style,
    }
    const cardStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      border: priority === true ? `1px solid ${colors.MINI_PEA}` : 'initial',
      borderRadius: '0.9375em',
      boxShadow: '0 0.625em 0.9375em 0 rgba(0, 0, 0, 0.2)',
      fontWeight: 600,
      height: '20.3125em',
      position: 'relative',
      textAlign: 'center',
    }
    const answersStyle: React.CSSProperties = {
      bottom: '1.5625em',
      display: 'flex',
      left: '0.625em',
      position: 'absolute',
      right: '0.625em',
    }
    return <div style={containerStyle}>
      <div style={cardStyle}>
        {this.renderPriority(priority)}
        <div style={{color, fontSize: '1.1875em', margin: '1.579em auto', width: '13.16em'}}>
          <img src={image} alt="" style={{width: '5.26em'}} /><br />
          {title}
        </div>
        <div style={answersStyle}>
          {this.renderAnswer('Ma situation', 'yes/no', greyYesNoImage, {flex: 1}, yesNoMap)}
          {this.renderAnswer('Je me sens', 'confidence', greyFacesImage, {flex: 1}, facesMap)}
          {this.renderAnswer('Je maîtrise', 'levels', greyLevelsImage, {flex: 1}, levelsMap)}
        </div>
      </div>
      <NoteLines count={2} style={{padding: '0 1.25em'}} />
    </div>
  }
}


interface NoteLinesProps {
  count: number
  style?: React.CSSProperties
}


class NoteLines extends React.PureComponent<NoteLinesProps> {
  public static propTypes = {
    count: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {count, style} = this.props
    const lineStyle = {
      borderBottom: `dotted 2px ${colors.MINI_FOOTER_GREY}`,
      height: '2.5em',
    }
    return <div style={style}>
      {new Array(count).fill(0).
        map((unused, index): React.ReactNode => <div style={lineStyle} key={index} />)}
    </div>
  }
}


interface AnswerOption {
  name: string
  value: AnswerType
}


// TODO(pascal): Combine with content in question.jsx.
const POSSIBLE_ANSWERS: {[type in QuestionType]: AnswerOption[]} = {
  'confidence': [
    {name: 'Non pas du tout', value: -2},
    {name: 'Non pas vraiment', value: -1},
    {name: 'Oui plutôt', value: 1},
    {name: 'Oui tout à fait', value: 2},
  ],
  'levels': [
    {name: 'Non pas du tout', value: -2},
    {name: 'Non pas vraiment', value: -1},
    {name: 'Oui plutôt', value: 1},
    {name: 'Oui tout à fait', value: 2},
  ],
  'yes/no': [
    {name: 'Oui', value: true},
    {name: 'Non', value: false},
  ],
  'yes/no/later': [
    {name: 'Oui', value: true},
    {name: 'Non', value: false},
    {name: 'Peut-être plus tard', value: 'later'},
  ],
}


interface BilanPageInnerProps {
  answers: {}
  priorities: {
    [topicUrl in TopicId]?: TopicPriority
  }
}


type BilanPageProps = BilanPageInnerProps & RouteComponentProps<{}>


class BilanPageBase extends React.PureComponent<BilanPageProps, {isPrinting: boolean}> {
  public static propTypes = {
    answers: PropTypes.object.isRequired,
    location: ReactRouterPropTypes.location.isRequired,
    priorities: PropTypes.object.isRequired,
  }

  public state = {
    isPrinting: !!this.props.location.pathname.match(/imprimer/),
  }

  public componentDidMount(): void {
    if (this.state.isPrinting) {
      window.print()
    }
  }

  private renderAnswersAsText(type: QuestionType, answer, key: string): React.ReactNode {
    const possibleAnswers = POSSIBLE_ANSWERS[type]
    const answerStyle = {
      display: 'inline-block',
      minWidth: '20%',
    }
    const checkboxStyle = {
      marginRight: '.2em',
      verticalAlign: 'middle',
    }
    return <div style={{color: colors.MINI_BROWN}}>
      {possibleAnswers.map(({name, value}, index): React.ReactNode => <span
        key={`${key}-${index}`} style={answerStyle}>
        {value === answer ?
          <CheckboxMarkedOutlineIcon size="1em" style={checkboxStyle} /> :
          <CheckboxBlankOutlineIcon size="1em" style={checkboxStyle} />}
        {name}
      </span>)}
    </div>
  }

  private renderAsText(sortedTopics): React.ReactNode {
    if (!this.state.isPrinting) {
      return
    }
    const {answers, priorities} = this.props
    const pageStyle: React.CSSProperties = {
      breakBefore: 'page',
      fontSize: 11,
    }
    const topicHeaderStyle: React.CSSProperties & {WebkitPrintColorAdjust: 'exact'} = {
      WebkitPrintColorAdjust: 'exact',
      backgroundColor: colors.MINI_LIGHT_BROWN,
      fontWeight: 'bold',
      textAlign: 'center',
    }
    return <div style={pageStyle}>
      {sortedTopics.map((topic): React.ReactNode => <div key={`text-${topic.url}`}>
        <div style={topicHeaderStyle}>
          {topic.title}
        </div>
        <ol style={{margin: 0}}>
          {topic.questions.map(({question, type, url}): React.ReactNode =>
            <li key={`text-question-${topic.url}-${url}`} style={{marginBottom: '1em'}}>
              <div>
                {question}
              </div>
              {this.renderAnswersAsText(
                type, (answers[topic.url] || {})[url], `text-question-${topic.url}-${url}`)}
            </li>
          )}
        </ol>
        <ul style={{listStyleType: '➢', margin: 0}}>
          <li style={{marginBottom: '1em'}}>
            {/* TODO(pascal): Factorize with identical text in mini_onboarding.jsx. */}
            Je suis intéressé pour {topic.talkAboutIt.startsWith('aborder') ?
              `${topic.talkAboutIt} avec un professionnel de la Mission Locale` : topic.talkAboutIt}
            {this.renderAnswersAsText(
              'yes/no/later', priorities[topic.url], `text-question-${topic.url}-priority`)}
          </li>
        </ul>
      </div>)}
    </div>
  }

  public render(): React.ReactNode {
    const {answers, priorities} = this.props
    const sortedTopics = QUESTIONS_TREE
    const scoreTopic = ({url}: Topic): number => {
      const priority = priorities[url]
      if (!priority) {
        return -1
      }
      if (priority === 'later') {
        return 0
      }
      return 1
    }
    sortedTopics.sort((topicA, topicB): number => scoreTopic(topicB) - scoreTopic(topicA))
    const pageStyle: React.CSSProperties = {
      fontSize: this.state.isPrinting ? '9.4px' : 'initial',
      margin: 'auto',
      maxWidth: '71.625em',
      padding: '0 1.3125em',
    }
    const titleStyle: React.CSSProperties = {
      color: colors.MINI_PEA,
      fontSize: '3.875em',
      fontWeight: 'normal',
    }
    const cardsContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      margin: '-1.3125em',
    }
    const notesStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      borderRadius: '1.875em',
      boxShadow: '0 0.625em 0.9375em 0 rgba(0, 0, 0, 0.2)',
      flex: 1,
      padding: '1.875em',
    }
    const notesTitleStyle: React.CSSProperties = {
      color: colors.MINI_PEA,
      fontSize: '1.1875em',
      fontWeight: 'normal',
      margin: 0,
    }
    const logoContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 3.75em',
    }
    return <div style={pageStyle}>
      <h1 style={titleStyle}>Mon bilan</h1>
      <div style={cardsContainerStyle}>
        {sortedTopics.map((topic: Topic): React.ReactElement<BilanCard> => <BilanCard
          key={topic.url} topic={topic} priority={priorities[topic.url]}
          answers={answers[topic.url] || {}} style={{margin: '1.3125em'}} />)}
      </div>
      <div style={{display: 'flex', margin: '1.875em 0'}}>
        <div style={notesStyle}>
          <h2 style={notesTitleStyle}>Notes libres</h2>
          <NoteLines count={4} />
        </div>
        <div style={logoContainerStyle}>
          <img
            alt="Le réseau des missions locales" src={logoRDMLImage}
            style={{margin: '1.25em', width: '13.125em'}} />
        </div>
      </div>
      {this.renderAsText(sortedTopics)}
    </div>
  }
}
const BilanPage = connect(
  (
    {user: {answers, priorities}}: RootState,
    {location: {hash}}: RouteComponentProps,
  ): BilanPageInnerProps => {
    if (hash) {
      try {
        return JSON.parse(decodeURIComponent(hash.slice(1)))
      } catch (unusedError) {
        // Ignore the error.
      }
    }
    return {answers, priorities}
  }
)(BilanPageBase)


export {BilanPage}
