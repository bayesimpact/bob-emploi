import PlusIcon from 'mdi-react/PlusIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {computeBobScore} from 'store/score'
import {Markdown} from 'components/theme'

import commentImage from 'images/comment-picto.svg'

import {EvalElementButton} from './advices_recap'
import {BobScoreCircle} from '../connected/project/diagnostic'


class Assessment extends React.Component {
  static propTypes = {
    diagnostic: PropTypes.shape({
      text: PropTypes.string.isRequired,
    }).isRequired,
    diagnosticEvaluations: PropTypes.objectOf(PropTypes.object.isRequired).isRequired,
    onEvaluateSection: PropTypes.func.isRequired,
  }

  state = {
    isCommentShownBySection: {},
  }

  renderCommentButton = (sectionId, alt, Icon) => {
    const {comment} = this.props.diagnosticEvaluations[sectionId] || {}
    const {isCommentShownBySection} = this.state
    const isCommentShown = !!isCommentShownBySection[sectionId]
    return <EvalElementButton
      key={`comment-${sectionId}`}
      isSelected={!!comment || isCommentShown}
      onClick={() => {
        // TODO(florian): focus directly inside the comment box when switching on.
        this.setState({
          isCommentShownBySection: {
            ...isCommentShownBySection,
            [sectionId]: !isCommentShown,
          },
        })
      }}
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

  renderComment = sectionId => {
    const {isCommentShownBySection} = this.state
    const isCommentShown = !!isCommentShownBySection[sectionId]
    if (!isCommentShown) {
      return null
    }

    const {onEvaluateSection, diagnosticEvaluations} = this.props
    const {comment} = diagnosticEvaluations[sectionId] || {}
    const textareaStyle = {
      borderColor: colors.BOB_BLUE,
      fontSize: 14,
      marginTop: 5,
      width: '100%',
    }
    return <textarea
      style={textareaStyle} value={comment || ''}
      onChange={event => onEvaluateSection(sectionId, {comment: event.target.value})}
    />
  }

  render() {
    const {diagnostic} = this.props
    const bobScoreStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      margin: '0 auto 5.6px',
      position: 'relative',
    }
    const titleStyle = {
      fontSize: 18,
      fontWeight: 'bold',
      lineHeight: 1,
      marginLeft: 30,
    }
    const subTitleStyle = {
      fontSize: 15,
      fontWeight: 'bold',
      lineHeight: 1,
      marginBottom: 15,
      marginTop: 20,
    }
    const pepTalkStyle = {
      borderTop: `1px solid ${colors.MODAL_PROJECT_GREY}`,
      fontSize: 14,
      lineHeight: '22px',
      marginBottom: 25,
      position: 'relative',
    }
    const {components = [], percent, shortTitle} = computeBobScore(diagnostic)
    return <div style={{color: colors.DARK_TWO}}>
      <div style={{marginBottom: 20, position: 'relative'}}>
        <div style={bobScoreStyle}>
          <BobScoreCircle
            isAnimated={false}
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
          <Markdown content={diagnostic.text} />
          {this.renderComment('text')}
        </div>
      </div>
      <div>
        {components.map(({observations, percent, shortTitle, topic}) => <div key={topic}>
          <h4 style={{position: 'relative'}}>
            {shortTitle} ({percent}%)
            {this.renderCommentButton(`${topic}-score`, 'Commenter le score')}
            {this.renderComment(`${topic}-score`)}
          </h4>
          <ul style={{position: 'relative'}}>
            {(observations || []).map(({text, isAttentionNeeded}, index) =>
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
