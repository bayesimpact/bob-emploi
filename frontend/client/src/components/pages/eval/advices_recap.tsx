import _groupBy from 'lodash/groupBy'
import _mapKeys from 'lodash/mapKeys'
import _mapValues from 'lodash/mapValues'
import _memoize from 'lodash/memoize'
import Radium from 'radium'
import React from 'react'
import PropTypes from 'prop-types'

import {ValidAdvice, isValidAdvice} from 'store/advice'

import {Textarea} from 'components/theme'
import optimizeImage from 'images/optimize-picto.svg'
import commentImage from 'images/comment-picto.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twoStarsImage from 'images/2-stars-picto.svg'

import {ADVICE_SCORES} from './score_levels'


const ADVICE_GROUP_PROPS = {
  '1': {
    image: '',
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

const emptyArray = [] as const

interface AdvicesRecapProps {
  adviceEvaluations: {
    [adviceId: string]: bayes.bob.AdviceEvaluation
  }
  advices: readonly bayes.bob.Advice[]
  moduleNewScores: {
    [adviceId: string]: number
  }
  onEvaluateAdvice: (adviceId: string, evaluation: bayes.bob.AdviceEvaluation) => void
  onRescoreAdvice: (adviceId: string, newScore: string) => void
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
  style?: React.CSSProperties
}


class AdvicesRecap extends React.PureComponent<AdvicesRecapProps> {
  public static propTypes = {
    adviceEvaluations: PropTypes.objectOf(PropTypes.object.isRequired).isRequired,
    advices: PropTypes.array.isRequired,
    moduleNewScores: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
    onEvaluateAdvice: PropTypes.func.isRequired,
    onRescoreAdvice: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {advices, adviceEvaluations, moduleNewScores, onRescoreAdvice,
      onEvaluateAdvice, profile, project, style} = this.props
    const containerStyle = {
      backgroundColor: '#fff',
      padding: 10,
      ...style,
    }
    const adviceGroups: {[numStars: number]: readonly bayes.bob.Advice[]} =
      _groupBy(advices, 'numStars')
    const groupKeys = Object.keys(ADVICE_GROUP_PROPS).sort().reverse()
    return <div style={containerStyle}>
      <div>
        {groupKeys.map((numStars: string): React.ReactNode => (
          <AdvicesRecapSection
            key={`section-${numStars}-stars`} advices={adviceGroups[numStars] || emptyArray}
            {...{adviceEvaluations, moduleNewScores, numStars,
              onEvaluateAdvice, onRescoreAdvice, profile, project}} />
        ))}
      </div>
    </div>
  }
}


interface AdvicesRecapSectionProps {
  adviceEvaluations: {
    [adviceId: string]: bayes.bob.AdviceEvaluation
  }
  advices: bayes.bob.Advice[]
  moduleNewScores: {
    [adviceId: string]: number
  }
  numStars: string
  onEvaluateAdvice: (adviceId: string, evaluation: bayes.bob.AdviceEvaluation) => void
  onRescoreAdvice: (adviceId: string, newScore: string) => void
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
}


interface AdvicesRecapSectionState {
  [adviceId: string]: boolean
}


class AdvicesRecapSection
  extends React.Component<AdvicesRecapSectionProps, AdvicesRecapSectionState> {
  public static propTypes = {
    adviceEvaluations: PropTypes.objectOf(PropTypes.shape({
      comment: PropTypes.string,
    }).isRequired).isRequired,
    advices: PropTypes.array.isRequired,
    moduleNewScores: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
    numStars: PropTypes.oneOf(Object.keys(ADVICE_GROUP_PROPS)).isRequired,
    onEvaluateAdvice: PropTypes.func.isRequired,
    onRescoreAdvice: PropTypes.func.isRequired,
  }

  public state = _mapKeys(
    _mapValues(this.props.adviceEvaluations, ({comment}): boolean => !!comment),
    (comment: boolean, adviceId: string): string => `isCommentShown-${adviceId}`)

  private extraAdviceInput: React.RefObject<HTMLInputElement> = React.createRef()

  private handleAddAdvice = (adviceId: string): void => {
    const {numStars, onRescoreAdvice} = this.props
    onRescoreAdvice(adviceId, numStars)
    if (this.extraAdviceInput.current) {
      this.extraAdviceInput.current.value = ''
    }
  }

  private handleRescoreAdvice = _memoize(
    (adviceId, value): (() => void) => (): void => this.props.onRescoreAdvice(adviceId, value),
    (adviceId, value): string => `${adviceId}:${value}`)

  private handleToggleAdviceToOptimize = _memoize((adviceId: string): (() => void) =>
    (): void => {
      const {adviceEvaluations: {[adviceId]: {shouldBeOptimized = false} = {}},
        onEvaluateAdvice} = this.props
      onEvaluateAdvice(adviceId, {shouldBeOptimized: !shouldBeOptimized})
    })

  private handleToggleCommentShown = _memoize((adviceId: string): (() => void) => (): void => {
    // TODO(florian): focus directly inside the comment box when switching on.
    const commentState = `isCommentShown-${adviceId}`
    this.setState({[commentState]: !this.state[commentState]})
  })

  private handleCommentAdvice = _memoize((adviceId: string): ((string) => void) =>
    (comment: string): void => this.props.onEvaluateAdvice(adviceId, {comment}))

  private handleExtraInputKeyPress = ({key, target}): void => {
    (key === 'Enter') && this.handleAddAdvice((target as HTMLInputElement).value)
  }

  private renderRescoreButtons = ({adviceId}: ValidAdvice): React.ReactNode => {
    const {moduleNewScores, numStars} = this.props
    const newScore = moduleNewScores[adviceId] + ''
    return ADVICE_SCORES.map(({image, value}): React.ReactNode => {
      return <EvalElementButton
        key={`rescore-${adviceId}-${value}-stars`}
        isPreselected={value === numStars}
        isSelected={value === newScore}
        onClick={this.handleRescoreAdvice(adviceId, value)}>
        <img src={image} alt={`${numStars}*`} />
      </EvalElementButton>
    })
  }

  private renderOptimizeButton = ({adviceId}: ValidAdvice): React.ReactNode => {
    const {adviceEvaluations} = this.props
    const adviceEvaluation = adviceEvaluations[adviceId] || {}
    const shouldBeOptimized = adviceEvaluation.shouldBeOptimized
    return <EvalElementButton
      key={`optimize-${adviceId}`}
      isSelected={shouldBeOptimized}
      onClick={this.handleToggleAdviceToOptimize(adviceId)}>
      <img src={optimizeImage} alt="À optimiser" />
    </EvalElementButton>
  }

  private renderCommentButton = ({adviceId}: ValidAdvice): React.ReactNode => {
    const {adviceEvaluations} = this.props
    const adviceEvaluation = adviceEvaluations[adviceId] || {}
    const {comment} = adviceEvaluation
    const {[`isCommentShown-${adviceId}`]: isCommentShown = false} = this.state
    return <EvalElementButton
      key={`comment-${adviceId}`}
      isSelected={!!comment || isCommentShown}
      onClick={this.handleToggleCommentShown(adviceId)}>
      <img src={commentImage} alt="Commenter" />
    </EvalElementButton>
  }

  private renderComment = ({adviceId}: ValidAdvice): React.ReactNode => {
    const {[`isCommentShown-${adviceId}`]: isCommentShown} = this.state
    if (!isCommentShown) {
      return null
    }

    const {adviceEvaluations} = this.props
    const adviceEvaluation = adviceEvaluations[adviceId] || {}
    const {comment} = adviceEvaluation
    const textareaStyle = {
      borderColor: colors.BOB_BLUE,
      fontSize: 14,
      marginTop: -10,
      width: '100%',
    }
    return <Textarea
      style={textareaStyle} value={comment || ''} onChange={this.handleCommentAdvice(adviceId)} />
  }

  private renderAdvice = (advice: bayes.bob.Advice): React.ReactNode => {
    if (!isValidAdvice(advice)) {
      return
    }
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

  private renderExtraAdvices(): React.ReactNode {
    const {advices, moduleNewScores, numStars} = this.props
    const advicesShown =
      new Set(advices.filter(isValidAdvice).map(({adviceId}): string => adviceId))
    const rescoredAdvices = Object.keys(moduleNewScores)
    const extraAdvices = rescoredAdvices.filter(
      (adviceId: string): boolean => !advicesShown.has(adviceId) &&
      (moduleNewScores[adviceId] + '') === numStars)
    const extraAdviceStyle = {
      border: `solid 1px ${colors.BOB_BLUE}`,
      margin: '5px 0',
      padding: 6,
    }
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {extraAdvices.map((adviceId): React.ReactNode => <div key={adviceId} style={extraAdviceStyle}>
        <div style={{alignItems: 'center', display: 'flex'}}>
          <span style={{flex: 1}}>{adviceId}</span>
          <span
            style={{cursor: 'pointer', padding: 5}}
            onClick={this.handleRescoreAdvice(adviceId, '')}>×</span>
        </div>
      </div>)}
      <input
        ref={this.extraAdviceInput} style={{fontSize: 14, marginTop: 10, padding: 8}}
        placeholder="+ Saisir un autre conseil à ajouter"
        onKeyPress={this.handleExtraInputKeyPress} />
    </div>
  }

  public render(): React.ReactNode {
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


interface EvalElementButtonProps {
  children: React.ReactNode
  isPreselected?: boolean
  isSelected?: boolean
  onClick: () => void
  style?: React.CSSProperties
}


class EvalElementButtonBase extends React.PureComponent<EvalElementButtonProps> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    isPreselected: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
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
