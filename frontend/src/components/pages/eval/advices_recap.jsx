import Radium from 'radium'
import React from 'react'
import ReactHeight from 'react-height'
import PropTypes from 'prop-types'
import _ from 'underscore'

import optimizeImage from 'images/optimize-picto.svg'
import commentImage from 'images/comment-picto.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twoStarsImage from 'images/2-stars-picto.svg'

import {AdviceCard} from 'components/advisor'
import {Colors, LabeledToggle, Styles} from 'components/theme'

import {ADVICE_SCORES} from './score_levels'


const ADVICE_GROUP_PROPS = {
  '1': {
    title: 'À regarder',
  },
  '2': {
    image: twoStarsImage,
    title: '2 étoiles',
  },
  '3': {
    image: threeStarsImage,
    title: '3 étoiles',
  },
}


class AdvicesRecap extends React.Component {
  static propTypes = {
    adviceEvaluations: PropTypes.objectOf(PropTypes.object.isRequired).isRequired,
    advices: PropTypes.array.isRequired,
    moduleNewScores: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
    onEvaluateAdvice: PropTypes.func.isRequired,
    onRescoreAdvice: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  state = {
    showAdviceCards: false,
  }

  render() {
    const {advices, adviceEvaluations, moduleNewScores,onRescoreAdvice,
      onEvaluateAdvice, profile, project, style} = this.props
    const {showAdviceCards} = this.state
    const containerStyle = {
      backgroundColor: '#fff',
      padding: 10,
      ...style,
    }
    const adviceGroups = _.groupBy(advices, 'numStars')
    const groupKeys = Object.keys(ADVICE_GROUP_PROPS).sort().reverse()
    return <div style={containerStyle}>
      <LabeledToggle
        label="Afficher les cartes des conseils"
        type="checkbox" isSelected={showAdviceCards}
        onClick={() => this.setState({showAdviceCards: !showAdviceCards})} />
      <div>
        {groupKeys.map(numStars => (
          <AdvicesRecapSection
            key={`section-${numStars}-stars`} profile={profile}
            project={project} advices={adviceGroups[numStars] || []}
            adviceEvaluations={adviceEvaluations}
            onEvaluateAdvice={onEvaluateAdvice}
            onRescoreAdvice={onRescoreAdvice} moduleNewScores={moduleNewScores}
            numStars={numStars} showAdviceCards={showAdviceCards} />
        ))}
      </div>
    </div>
  }
}

class AdvicesRecapSection extends React.Component {
  static propTypes = {
    adviceEvaluations: PropTypes.objectOf(PropTypes.object.isRequired).isRequired,
    advices: PropTypes.array.isRequired,
    moduleNewScores: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
    numStars: PropTypes.oneOf(Object.keys(ADVICE_GROUP_PROPS)).isRequired,
    onEvaluateAdvice: PropTypes.func.isRequired,
    onRescoreAdvice: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    showAdviceCards: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = {
      isCommentShownByAdviceId: _.mapObject(props.adviceEvaluations, function(adviceEvaluation) {
        return !!adviceEvaluation.comment
      }),
    }
  }

  handleAddAdvice = adviceId => {
    const {numStars, onRescoreAdvice} = this.props
    onRescoreAdvice(adviceId, numStars)
    if (this.extraAdviceInput) {
      this.extraAdviceInput.value = ''
    }
  }

  renderRescoreButtons = advice => {
    const {moduleNewScores, numStars, onRescoreAdvice} = this.props
    const newScore = moduleNewScores[advice.adviceId] + ''
    return ADVICE_SCORES.map(({image, value}) => {
      return <RescoreAdviceButton
        key={`rescore-${advice.adviceId}-${value}-stars`}
        isPreselected={value === numStars}
        isSelected={value === newScore}
        onClick={() => onRescoreAdvice(advice.adviceId, value)}>
        <img src={image} alt={`${numStars}*`} />
      </RescoreAdviceButton>
    })
  }

  renderOptimizeButton = advice => {
    const {adviceEvaluations, onEvaluateAdvice} = this.props
    const adviceEvaluation = adviceEvaluations[advice.adviceId] || {}
    const shouldBeOptimized = adviceEvaluation.shouldBeOptimized
    return <RescoreAdviceButton
      key={`optimize-${advice.adviceId}`}
      isSelected={shouldBeOptimized}
      onClick={() => onEvaluateAdvice(advice.adviceId, {shouldBeOptimized: !shouldBeOptimized})}>
      <img src={optimizeImage} alt="À optimiser" />
    </RescoreAdviceButton>
  }

  renderCommentButton = advice => {
    const {adviceEvaluations} = this.props
    const adviceEvaluation = adviceEvaluations[advice.adviceId] || {}
    const {comment} = adviceEvaluation
    const {isCommentShownByAdviceId} = this.state
    const isCommentShown = !!isCommentShownByAdviceId[advice.adviceId]
    return <RescoreAdviceButton
      key={`comment-${advice.adviceId}`}
      isSelected={!!comment || isCommentShown}
      onClick={() => {
        // TODO(florian): focus directly inside the comment box when switching on.
        this.setState({
          isCommentShownByAdviceId: {
            ...isCommentShownByAdviceId,
            [advice.adviceId]: !isCommentShown,
          },
        })
      }}>
      <img src={commentImage} alt="Commenter" />
    </RescoreAdviceButton>
  }

  renderComment = advice => {
    const {isCommentShownByAdviceId} = this.state
    const isCommentShown = !!isCommentShownByAdviceId[advice.adviceId]
    if (!isCommentShown) {
      return null
    }

    const {adviceEvaluations, onEvaluateAdvice} = this.props
    const adviceEvaluation = adviceEvaluations[advice.adviceId] || {}
    const {comment} = adviceEvaluation
    const textareaStyle = {
      borderColor: Colors.SKY_BLUE,
      fontSize: 14,
      marginTop: -10,
      width: '100%',
    }
    return <textarea
      style={textareaStyle} value={comment || ''}
      onChange={event => onEvaluateAdvice(advice.adviceId, {comment: event.target.value})}
    />
  }

  renderAdvice = advice => {
    const {profile, project, showAdviceCards} = this.props
    return <div key={advice.adviceId}>
      <div style={{display: 'flex', fontSize: 15, padding: 5}}>
        <span style={{flex: 1}}>
          {advice.adviceId}
        </span>
        {this.renderRescoreButtons(advice)}
        {this.renderOptimizeButton(advice)}
        {this.renderCommentButton(advice)}
      </div>
      {this.renderComment(advice)}
      {showAdviceCards ? <ScaledAdvice
        scale={.5} advice={advice} profile={profile} project={project}
        style={{marginLeft: 60}} /> : null}
    </div>
  }

  renderExtraAdvices() {
    const {advices, moduleNewScores, numStars, onRescoreAdvice} = this.props
    const advicesShown = _.object(
      advices.map(({adviceId}) => adviceId), new Array(advices.length).fill(true))
    const rescoredAdvices = _.keys(moduleNewScores)
    const extraAdvices = rescoredAdvices.filter(
      adviceId => !advicesShown[adviceId] &&
      (moduleNewScores[adviceId] + '') === numStars)
    const extraAdviceStyle = {
      border: `solid 1px ${Colors.SKY_BLUE}`,
      margin: '5px 0',
      padding: 6,
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {extraAdvices.map(adviceId => <div key={adviceId} style={extraAdviceStyle}>
        <div style={{...Styles.CENTER_FONT_VERTICALLY, alignItems: 'center', display: 'flex'}}>
          <span style={{flex: 1}}>{adviceId}</span>
          <span
            style={{cursor: 'pointer', padding: 5}}
            onClick={() => onRescoreAdvice(adviceId, '')}>×</span>
        </div>
      </div>)}
      <input
        ref={dom => {
          this.extraAdviceInput = dom
        }} style={{fontSize: 14, marginTop: 10, padding: 8}}
        placeholder="+ Saisir un autre conseil à ajouter"
        onKeyPress={event => (event.key === 'Enter') && this.handleAddAdvice(event.target.value)} />
    </div>
  }

  render() {
    const {advices, numStars} = this.props
    const {image, title} = ADVICE_GROUP_PROPS[numStars]
    const headerStyle = {
      display: 'flex',
      justifyContent: 'center',
      'padding': '15px 0px',
    }
    return <div>
      <div style={headerStyle}>
        {image
          ? <img src={image} style={{height: 63, width: 63}} alt={title} />
          : <span style={{fontSize: 36, fontWeight: 'bold'}}>{title}</span>
        }
      </div>
      {advices.map(this.renderAdvice)}
      {this.renderExtraAdvices()}
    </div>
  }
}


class RescoreAdviceButtonBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    isPreselected: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
  }

  render() {
    const {children ,isPreselected, isSelected, onClick} = this.props
    const containerStyle = {
      ':hover': {
        filter: 'initial',
        opacity: 1,
      },
      cursor: 'pointer',
      filter: isSelected ? 'initial': 'grayscale(100%)',
      opacity: (isPreselected && !isSelected) ? .5 : 1,
      padding: 5,
    }
    return <span onClick={onClick} style={containerStyle}>
      {children}
    </span>
  }
}
const RescoreAdviceButton = Radium(RescoreAdviceButtonBase)


class ScaledAdvice extends React.Component {
  static propTypes = {
    scale: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  state = {
    height: '',
  }

  render() {
    const {scale, style, ...extraProps} = this.props
    const adviceCardStyle = {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }
    const height = this.state.height
    const wrapperStyle = {
      height: height ? height * scale : 'initial',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }
    return <div style={wrapperStyle}>
      <ReactHeight
        style={{width: (100 / scale) + '%'}}
        onHeightReady={height => this.setState({height})}>
        <AdviceCard {...extraProps} style={adviceCardStyle} />
      </ReactHeight>
    </div>
  }
}


export {AdvicesRecap}
