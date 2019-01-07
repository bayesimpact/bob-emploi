import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

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

import {QUESTIONS_TREE} from './questions_tree'


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


class BilanCard extends React.Component {
  static propTypes = {
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

  renderPriority(priority) {
    if (!priority) {
      return null
    }
    const isLater = priority === 'later'
    return <div style={{
      // TODO(pascal): Check with UNML if we enforce this color when printing
      // with -webkit-print-color-adjust
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

  renderAnswer(title, type, legendImage, style, answerMap) {
    const {answers, topic: {questions}} = this.props
    const columnStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      textAlign: 'center',
      ...style,
    }
    const question = questions.find(({type: questionType}) => questionType === type)
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

  render() {
    const {priority, style, topic: {color, image, title}} = this.props
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      width: '21.25em',
      ...style,
    }
    const cardStyle = {
      backgroundColor: '#fff',
      border: priority === true ? `1px solid ${colors.MINI_PEA}` : 'initial',
      borderRadius: '0.9375em',
      boxShadow: '0 0.625em 0.9375em 0 rgba(0, 0, 0, 0.2)',
      fontWeight: 600,
      height: '20.3125em',
      position: 'relative',
      textAlign: 'center',
    }
    const answersStyle = {
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


class NoteLines extends React.Component {
  static propTypes = {
    count: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {count, style} = this.props
    const lineStyle = {
      borderBottom: `dotted 2px ${colors.MINI_FOOTER_GREY}`,
      height: '2.5em',
    }
    return <div style={style}>
      {new Array(count).fill().map((unused, index) => <div style={lineStyle} key={index} />)}
    </div>
  }
}


class BilanPageBase extends React.Component {
  static propTypes = {
    answers: PropTypes.object.isRequired,
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }).isRequired,
    priorities: PropTypes.object.isRequired,
  }

  state = {
    isPrinting: this.props.location.pathname.match(/imprimer/),
  }

  componentDidMount() {
    if (this.state.isPrinting) {
      window.print()
    }
  }

  render() {
    const {answers, priorities} = this.props
    const sortedTopics = QUESTIONS_TREE
    const scoreTopic = ({url}) => {
      const priority = priorities[url]
      if (!priority) {
        return -1
      }
      if (priority === 'later') {
        return 0
      }
      return 1
    }
    sortedTopics.sort((topicA, topicB) => scoreTopic(topicB) - scoreTopic(topicA))
    const pageStyle = {
      fontSize: this.state.isPrinting ? '9.4px' : 'initial',
      margin: 'auto',
      maxWidth: '71.625em',
      padding: '0 1.3125em',
    }
    const titleStyle = {
      color: colors.MINI_PEA,
      fontSize: '3.875em',
      fontWeight: 'normal',
    }
    const cardsContainerStyle = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      margin: '-1.3125em',
    }
    const notesStyle = {
      backgroundColor: '#fff',
      borderRadius: '1.875em',
      boxShadow: '0 0.625em 0.9375em 0 rgba(0, 0, 0, 0.2)',
      flex: 1,
      padding: '1.875em',
    }
    const notesTitleStyle = {
      color: colors.MINI_PEA,
      fontSize: '1.1875em',
      fontWeight: 'normal',
      margin: 0,
    }
    const logoContainerStyle = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 3.75em',
    }
    return <div style={pageStyle}>
      <h1 style={titleStyle}>Mon bilan</h1>
      <div style={cardsContainerStyle}>
        {sortedTopics.map(topic => <BilanCard
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
    </div>
  }
}
const BilanPage = connect(({user: {answers, priorities}}, {location: {hash}}) => {
  if (hash) {
    try {
      return JSON.parse(decodeURIComponent(hash.substring(1)))
    } catch (unusedError) {
      // Ignore the error.
    }
  }
  return {answers, priorities}
})(BilanPageBase)


export {BilanPage}
