import CheckboxBlankOutlineIcon from 'mdi-react/CheckboxBlankOutlineIcon'
import CheckboxMarkedOutlineIcon from 'mdi-react/CheckboxMarkedOutlineIcon'
import PropTypes from 'prop-types'
import React, {useEffect, useMemo, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'
import {useLocation} from 'react-router'

import greyFacesImage from '../../images/grey-faces.png'
import greyLevelsImage from '../../images/grey-levels.svg'
import greyTriangleImage from '../../images/grey-triangle.svg'
import greyYesNoImage from '../../images/grey-yes-no.svg'
import level1Image from '../../images/level-1.svg'
import level2Image from '../../images/level-2.svg'
import level3Image from '../../images/level-3.svg'
import level4Image from '../../images/level-4.svg'
import aliLogo from '../../images/logo-ali.svg'
import logoRDMLImage from '../../images/logo_reseau_de_ml_largeur.jpg'
import notAtAllImage from '../../images/not-at-all.png'
import notReallyImage from '../../images/not-really.png'
import yellowCheckImage from '../../images/yellow-check.svg'
import yellowCrossImage from '../../images/yellow-cross.svg'
import yesImage from '../../images/yes.png'
import yesClearlyImage from '../../images/yes-clearly.png'

import Button from '../button'
import POSSIBLE_ANSWERS, {AnswerType, QuestionType} from '../answers'
import QUESTIONS_TREE, {Question, Topic} from '../questions_tree'
import SaveButton from '../save_button'
import {DispatchActions, MiniRootState, Routes, TopicPriority, UserState,
  makeUrlUser} from '../../store'


type ImageProps = Pick<React.HTMLProps<HTMLImageElement>, 'alt'|'src'>


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


interface AnswerProps {
  answerMap: {readonly [answer: string]: ImageProps}
  answers: {
    readonly [questionUrl: string]: AnswerType
  }
  legendImage: string
  style: React.CSSProperties
  questions: Topic['questions']
  title: string
  type: QuestionType
}


const AnswerBase = (props: AnswerProps): React.ReactElement => {
  const {answerMap, answers, legendImage, style, title, questions, type} = props
  const columnStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    textAlign: 'center',
    ...style,
  }), [style])
  const question = questions.find(({type: questionType}): boolean => questionType === type)
  const answer = question && answers[question.url]
  return <div style={columnStyle}>
    <span style={{color: colors.COOL_GREY, marginBottom: '0.5em'}}>{title}</span>
    {answer === undefined ? null : <React.Fragment>
      {answerMap && answerMap[answer + ''] ?
        <img alt={answer + ''} style={{height: '1.875em'}} {...answerMap[answer + '']} /> :
        <span>{answer + ''}</span>}
      <img src={greyTriangleImage} alt="" style={{margin: '0.5em', width: '0.5em'}} />
    </React.Fragment>}
    <img src={legendImage} alt="" style={{height: '1.25em'}} />
  </div>
}
const Answer = React.memo(AnswerBase)


interface BilanCardProps {
  answers: {
    readonly [questionUrl: string]: AnswerType
  }
  priority?: TopicPriority
  style?: React.CSSProperties
  topic: Topic
}


const answersStyle: React.CSSProperties = {
  bottom: '1.5625em',
  display: 'flex',
  left: '0.625em',
  position: 'absolute',
  right: '0.625em',
}


const BilanCardBase = (props: BilanCardProps): React.ReactElement => {
  const {answers, priority, style, topic: {color, image, questions, title}} = props
  const priorityRender = useMemo((): React.ReactNode => {
    if (!priority) {
      return null
    }
    const isLater = priority === 'later'
    return <div style={{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ['WebkitPrintColorAdjust' as any]: 'exact',
      backgroundColor: isLater ? colors.FOOTER_GREY : colors.PEA,
      borderRadius: '0.9375em',
      color: '#fff',
      padding: '0.9375em 2.1875em',
      position: 'absolute',
      right: 0,
      top: 0,
    }}>
      {isLater ? 'Et aussi…' : 'Priorité'}
    </div>
  }, [priority])

  const containerStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    width: '21.25em',
    ...style,
  }), [style])
  const cardStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: '#fff',
    border: priority === true ? `1px solid ${colors.PEA}` : 'initial',
    borderRadius: '0.9375em',
    boxShadow: '0 0.625em 0.9375em 0 rgba(0, 0, 0, 0.2)',
    fontWeight: 600,
    height: '20.3125em',
    position: 'relative',
    textAlign: 'center',
  }), [priority])
  return <div style={containerStyle}>
    <div style={cardStyle}>
      {priorityRender}
      <div style={{color, fontSize: '1.1875em', margin: '1.579em auto', width: '13.16em'}}>
        <img src={image} alt="" style={{width: '5.26em'}} /><br />
        {title}
      </div>
      <div style={answersStyle}>
        <Answer
          title="Ma situation" type="yes/no" legendImage={greyYesNoImage} style={{flex: 1}}
          answerMap={yesNoMap} answers={answers} questions={questions} />
        <Answer
          title="Je me sens" type="confidence" legendImage={greyFacesImage} style={{flex: 1}}
          answerMap={facesMap} answers={answers} questions={questions} />
        <Answer
          title="Je maîtrise" type="levels" legendImage={greyLevelsImage}
          style={{flex: 1}} answerMap={levelsMap} answers={answers} questions={questions} />
      </div>
    </div>
    <NoteLines count={2} style={{padding: '0 1.25em'}} />
  </div>
}
BilanCardBase.propTypes = {
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
const BilanCard = React.memo(BilanCardBase)


interface NoteLinesProps {
  count: number
  style?: React.CSSProperties
}


const lineStyle = {
  borderBottom: `dotted 2px ${colors.FOOTER_GREY}`,
  height: '2.5em',
}


const NoteLinesBase = (props: NoteLinesProps): React.ReactElement => {
  const {count, style} = props
  return <div style={style}>
    {Array.from(
      {length: count},
      (unused, index): React.ReactNode => <div style={lineStyle} key={index} />,
    )}
  </div>
}
NoteLinesBase.propTypes = {
  count: PropTypes.number.isRequired,
  style: PropTypes.object,
}
const NoteLines = React.memo(NoteLinesBase)


interface AnswersAsTextProps {
  answer: AnswerType|undefined
  type: QuestionType
}


const answerStyle = {
  display: 'inline-block',
  minWidth: '20%',
}
const checkboxStyle = {
  marginRight: '.2em',
  verticalAlign: 'middle',
}


const AnswersAsTextBase = (props: AnswersAsTextProps): React.ReactElement => {
  const {type, answer} = props
  const possibleAnswers = POSSIBLE_ANSWERS[type]
  return <div style={{color: colors.BROWN}}>
    {possibleAnswers.map(({name, value}, index): React.ReactNode => <span
      key={index} style={answerStyle}>
      {value === answer ?
        <CheckboxMarkedOutlineIcon size="1em" style={checkboxStyle} /> :
        <CheckboxBlankOutlineIcon size="1em" style={checkboxStyle} />}
      {name}
    </span>)}
  </div>
}
const AnswersAsText = React.memo(AnswersAsTextBase)


const BilanPage = (): React.ReactElement => {
  const {answers, priorities, orgInfo: {advisor = '', city = {}, milo = ''} = {}} =
    useSelector(({user}: MiniRootState): UserState => user)
  const user = useSelector(({user}: MiniRootState): string => makeUrlUser(user))
  const dispatch = useDispatch<DispatchActions>()
  const {pathname} = useLocation()
  const [isPrinting] = useState(/imprimer/.test(pathname))

  useEffect((): void => {
    if (isPrinting) {
      dispatch({type: 'MINI_PRINT_SUMMARY'})
      window.print()
    } else {
      dispatch({type: 'MINI_OPEN_SUMMARY'})
    }
  }, [dispatch, isPrinting])

  const renderAsText = (sortedTopics: readonly Topic[]): React.ReactNode => {
    if (!isPrinting) {
      return
    }
    const pageStyle: React.CSSProperties = {
      breakBefore: 'page',
      fontSize: 11,
    }
    const topicHeaderStyle: React.CSSProperties & {WebkitPrintColorAdjust: 'exact'} = {
      WebkitPrintColorAdjust: 'exact',
      backgroundColor: colors.LIGHT_BROWN,
      fontWeight: 'bold',
      textAlign: 'center',
    }
    return <div style={pageStyle}>
      {sortedTopics.map((topic: Topic): React.ReactNode => <div key={`text-${topic.url}`}>
        <div style={topicHeaderStyle}>
          {topic.title}
        </div>
        <ol style={{margin: 0}}>
          {topic.questions.map(({question, type, url}: Question): React.ReactNode =>
            <li key={`text-question-${topic.url}-${url}`} style={{marginBottom: '1em'}}>
              <div>
                {question}
              </div>
              <AnswersAsText type={type} answer={(answers[topic.url] || {})[url]} />
            </li>,
          )}
        </ol>
        <ul style={{listStyleType: '➢', margin: 0}}>
          <li style={{marginBottom: '1em'}}>
            {/* TODO(pascal): Factorize with identical text in mini_onboarding.jsx. */}
            Je suis intéressé pour {topic.talkAboutIt.startsWith('aborder') ?
              `${topic.talkAboutIt} avec un professionnel de la Mission Locale` : topic.talkAboutIt}
            <AnswersAsText type="yes/no/later" answer={priorities[topic.url]} />
          </li>
        </ul>
      </div>)}
    </div>
  }

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
  const sortedTopics = [...QUESTIONS_TREE].
    sort((topicA, topicB): number => scoreTopic(topicB) - scoreTopic(topicA))
  const pageStyle: React.CSSProperties = {
    fontSize: isPrinting ? '9.4px' : 'initial',
    margin: 'auto',
    maxWidth: '71.625em',
    padding: '0 1.3125em',
  }
  const headerStyle = {
    alignItems: 'flex-end',
    display: 'flex',
    margin: '3em 0 4.2em',
  }
  const titleStyle: React.CSSProperties = {
    color: colors.PEA,
    flex: 'none',
    fontSize: '3.875em',
    fontWeight: 'normal',
    lineHeight: 1,
    margin: 0,
  }
  const flexFillerStyle = {
    flex: 1,
  }
  const orgInfoStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '1.2em',
    fontStyle: 'italic',
    textAlign: 'right',
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
    color: colors.PEA,
    fontSize: '1.1875em',
    fontWeight: 'normal',
    margin: 0,
  }
  const logoContainerStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 3.75em',
  }
  return <div style={pageStyle}>
    <header style={headerStyle}>
      <img style={{marginRight: '1em', width: '4.5em'}} src={aliLogo} alt="" />
      <h1 style={titleStyle}>Mon bilan</h1>
      <div style={flexFillerStyle} />
      {advisor || milo || city ? <div style={orgInfoStyle}>
        Réalisé{advisor ? ` avec ${advisor}` : ''}<br />
        à la Mission&nbsp;Locale{milo ? ` de ${milo}` : ''}
        {city ? ` (${city.departementId})` : ''}
      </div> : null}
    </header>
    <div style={cardsContainerStyle}>
      {sortedTopics.map((topic: Topic): React.ReactElement<BilanCardProps> => <BilanCard
        key={topic.url} topic={topic} priority={priorities[topic.url]}
        answers={answers[topic.url] || {}} style={{margin: '1.3125em'}} />)}
    </div>
    <div style={{display: 'flex', margin: '1.875em 0'}}>
      <div style={notesStyle}>
        <h2 style={notesTitleStyle}>Notes libres</h2>
        <NoteLines count={4} />
      </div>
      <div style={logoContainerStyle}>
        {isPrinting ? null : <React.Fragment>
          <SaveButton />
          <div style={{flex: 1}} />
          <Button
            style={{padding: '15px 30px'}}
            target="_blank" to={`${Routes.BILAN_PAGE}/imprimer#${user}`}>
            Imprimer
          </Button>
        </React.Fragment>}
        <div style={{flex: 1}} />
        <img
          alt="Le réseau des missions locales" src={logoRDMLImage}
          style={{margin: '1.25em', width: '13.125em'}} />
      </div>
    </div>
    {renderAsText(sortedTopics)}
  </div>
}


export default React.memo(BilanPage)
