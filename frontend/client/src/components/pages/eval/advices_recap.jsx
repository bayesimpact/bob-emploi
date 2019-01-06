import _groupBy from 'lodash/groupBy'
import _mapValues from 'lodash/mapValues'
import Radium from 'radium'
import React from 'react'
import PropTypes from 'prop-types'

import optimizeImage from 'images/optimize-picto.svg'
import commentImage from 'images/comment-picto.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twoStarsImage from 'images/2-stars-picto.svg'

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

  render() {
    const {advices, adviceEvaluations, moduleNewScores, onRescoreAdvice,
      onEvaluateAdvice, profile, project, style} = this.props
    const containerStyle = {
      backgroundColor: '#fff',
      padding: 10,
      ...style,
    }
    const adviceGroups = _groupBy(advices, 'numStars')
    const groupKeys = Object.keys(ADVICE_GROUP_PROPS).sort().reverse()
    return <div style={containerStyle}>
      <div>
        {groupKeys.map(numStars => (
          <AdvicesRecapSection
            key={`section-${numStars}-stars`} advices={adviceGroups[numStars] || []}
            {...{adviceEvaluations, moduleNewScores, numStars,
              onEvaluateAdvice, onRescoreAdvice, profile, project}} />
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
  }

  constructor(props) {
    super(props)
    this.state = {
      isCommentShownByAdviceId: _mapValues(props.adviceEvaluations, function(adviceEvaluation) {
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
      return <EvalElementButton
        key={`rescore-${advice.adviceId}-${value}-stars`}
        isPreselected={value === numStars}
        isSelected={value === newScore}
        onClick={() => onRescoreAdvice(advice.adviceId, value)}>
        <img src={image} alt={`${numStars}*`} />
      </EvalElementButton>
    })
  }

  renderOptimizeButton = advice => {
    const {adviceEvaluations, onEvaluateAdvice} = this.props
    const adviceEvaluation = adviceEvaluations[advice.adviceId] || {}
    const shouldBeOptimized = adviceEvaluation.shouldBeOptimized
    return <EvalElementButton
      key={`optimize-${advice.adviceId}`}
      isSelected={shouldBeOptimized}
      onClick={() => onEvaluateAdvice(advice.adviceId, {shouldBeOptimized: !shouldBeOptimized})}>
      <img src={optimizeImage} alt="À optimiser" />
    </EvalElementButton>
  }

  renderCommentButton = advice => {
    const {adviceEvaluations} = this.props
    const adviceEvaluation = adviceEvaluations[advice.adviceId] || {}
    const {comment} = adviceEvaluation
    const {isCommentShownByAdviceId} = this.state
    const isCommentShown = !!isCommentShownByAdviceId[advice.adviceId]
    return <EvalElementButton
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
    </EvalElementButton>
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
      borderColor: colors.BOB_BLUE,
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
    </div>
  }

  renderExtraAdvices() {
    const {advices, moduleNewScores, numStars, onRescoreAdvice} = this.props
    const advicesShown = new Set(advices.map(({adviceId}) => adviceId))
    const rescoredAdvices = Object.keys(moduleNewScores)
    const extraAdvices = rescoredAdvices.filter(
      adviceId => !advicesShown.has(adviceId) &&
      (moduleNewScores[adviceId] + '') === numStars)
    const extraAdviceStyle = {
      border: `solid 1px ${colors.BOB_BLUE}`,
      margin: '5px 0',
      padding: 6,
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {extraAdvices.map(adviceId => <div key={adviceId} style={extraAdviceStyle}>
        <div style={{alignItems: 'center', display: 'flex'}}>
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


class EvalElementButtonBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    isPreselected: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  render() {
    const {children, isPreselected, isSelected, onClick, style} = this.props
    const containerStyle = {
      ':hover': {
        filter: 'initial',
        opacity: 1,
      },
      cursor: 'pointer',
      filter: isSelected ? 'initial' : 'grayscale(100%)',
      opacity: (isPreselected && !isSelected) ? .5 : 1,
      padding: 5,
      ...style,
    }
    return <div onClick={onClick} style={containerStyle}>
      {children}
    </div>
  }
}
const EvalElementButton = Radium(EvalElementButtonBase)


export {AdvicesRecap, EvalElementButton}
