import _memoize from 'lodash/memoize'
import PlusIcon from 'mdi-react/PlusIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {colorFromPercent, computeBobScore} from 'store/score'
import {BobScoreCircle, Markdown, Textarea} from 'components/theme'

import commentImage from 'images/comment-picto.svg'

import {EvalElementButton} from './advices_recap'


interface AssessmentProps {
  diagnostic: bayes.bob.Diagnostic
  diagnosticEvaluations: {
    [sectionId: string]: bayes.bob.GenericEvaluation
  }
  onEvaluateSection: (sectionId: string, evaluation: bayes.bob.GenericEvaluation) => void
}


interface AssessmentState {
  [sectionId: string]: boolean
}

class Assessment extends React.PureComponent<AssessmentProps, AssessmentState> {
  public static propTypes = {
    diagnostic: PropTypes.shape({
      categoryId: PropTypes.string,
      text: PropTypes.string,
    }).isRequired,
    diagnosticEvaluations: PropTypes.objectOf(PropTypes.object.isRequired).isRequired,
    onEvaluateSection: PropTypes.func.isRequired,
  }

  public state = {}

  private handleToggleShowComment = _memoize((sectionId: string): (() => void) => (): void => {
    const commentState = `isCommentShown-${sectionId}`
    this.setState({[commentState]: !this.state[commentState]})
  })

  private handleEvaluateSectionComment = _memoize(
    (sectionId: string): ((comment: string) => void) =>
      (comment: string): void => this.props.onEvaluateSection(sectionId, {comment}))

  private renderCommentButton = (sectionId: string, alt?: string, Icon?): React.ReactNode => {
    const {comment = ''} = this.props.diagnosticEvaluations[sectionId] || {}
    const {[`isCommentShown-${sectionId}`]: isCommentShown = false}: AssessmentState = this.state
    return <EvalElementButton
      key={`comment-${sectionId}`}
      isSelected={!!comment || isCommentShown}
      onClick={this.handleToggleShowComment(sectionId)}
      style={{
        padding: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      }}
    >
      {Icon ? <Icon color={colors.ROBINS_EGG} /> :
        <img src={commentImage} alt={alt || 'Commenter'} title={alt || 'Commenter'} />}
    </EvalElementButton>
  }

  private renderComment = (sectionId: string): React.ReactNode => {
    const {[`isCommentShown-${sectionId}`]: isCommentShown}: AssessmentState = this.state
    if (!isCommentShown) {
      return null
    }

    const {diagnosticEvaluations} = this.props
    const {comment = ''} = diagnosticEvaluations[sectionId] || {}
    const textareaStyle = {
      borderColor: colors.BOB_BLUE,
      fontSize: 14,
      marginTop: 5,
      width: '100%',
    }
    return <Textarea
      style={textareaStyle} value={comment}
      onChange={this.handleEvaluateSectionComment(sectionId)}
    />
  }

  public render(): React.ReactNode {
    const {diagnostic} = this.props
    const {categoryId, text} = diagnostic
    const bobScoreStyle: React.CSSProperties = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      margin: '0 auto 5.6px',
      position: 'relative',
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 18,
      fontWeight: 'bold',
      lineHeight: 1,
      marginLeft: 30,
    }
    const subTitleStyle: React.CSSProperties = {
      fontSize: 15,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: 15,
      marginTop: 20,
    }
    const pepTalkStyle: React.CSSProperties = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontSize: 14,
      lineHeight: '22px',
      marginBottom: 25,
      position: 'relative',
    }
    const {components = [], percent, shortTitle} = computeBobScore(diagnostic)
    return <div style={{color: colors.DARK_TWO, display: 'flex', flexDirection: 'column'}}>
      <div style={{alignSelf: 'center', fontWeight: 'bold', marginBottom: 10}}>
        BobThink&nbsp;: {categoryId || 'Aucun'}
        {this.renderCommentButton('think')}
        {this.renderComment('think')}
      </div>
      <div style={{marginBottom: 20, position: 'relative'}}>
        <div style={bobScoreStyle}>
          <BobScoreCircle
            isAnimated={false}
            color={colorFromPercent(percent)}
            percent={percent}
            radius={47.15}
            scoreSize={20}
            strokeWidth={3.1}
          />
          <Markdown style={titleStyle} content={shortTitle} />
        </div>
        {this.renderCommentButton('title')}
        {this.renderComment('title')}
      </div>
      <div >
        <div style={pepTalkStyle}>
          <div style={subTitleStyle}>Synthèse</div>
          {this.renderCommentButton('text')}
          <Markdown content={text} />
          {this.renderComment('text')}
        </div>
      </div>
      <div>
        {components.map(({observations, percent, shortTitle, topic}): React.ReactNode =>
          <div key={topic}>
            <h4 style={{position: 'relative'}}>
              {shortTitle} ({percent}%)
              {this.renderCommentButton(`${topic}-score`, 'Commenter le score')}
              {this.renderComment(`${topic}-score`)}
            </h4>
            <ul style={{position: 'relative'}}>
              {(observations || []).map(({text, isAttentionNeeded}, index): React.ReactNode =>
                <li key={index} style={{color: isAttentionNeeded ? colors.RED_PINK : 'initial'}}>
                  {text}
                </li>
              )}
              {this.renderCommentButton(
                `${topic}-observations`, 'Ajouter des observations', PlusIcon)}
              {this.renderComment(`${topic}-observations`)}
            </ul>
          </div>)}
      </div>
    </div>
  }
}

export {Assessment}
