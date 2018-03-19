import PropTypes from 'prop-types'
import React from 'react'

import commentImage from 'images/comment-picto.svg'

import {EvalElementButton} from './advices_recap'
import {BobScoreCircle, ComponentScore} from '../project/diagnostic'
import {computeNewBobScore} from 'store/score'
import {Colors, Markdown} from 'components/theme'


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

  renderCommentButton = (sectionId, style) => {
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
        position: 'absolute',
        right: 0,
        top: 0,
        ...style,
      }}
    >
      <img src={commentImage} alt="Commenter" />
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
      borderColor: Colors.BOB_BLUE,
      fontSize: 14,
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
      borderTop: `1px solid ${Colors.MODAL_PROJECT_GREY}`,
      fontSize: 14,
      lineHeight: '22px',
      marginBottom: 25,
      position: 'relative',
    }
    const subDiagnosticsStyle = {
      marginTop: 13,
      paddingBottom: 20,
    }
    const componentStyle = {
      borderTop: `1px solid ${Colors.MODAL_PROJECT_GREY}`,
      marginBottom: 25,
      // TODO(cyrille):
      // Find a way to leave low opacity on div while comment/button are fully opaque.
      opacity: 1,
      paddingTop: 24,
      position: 'relative',
    }
    const {components, percent, title} = computeNewBobScore(diagnostic)
    return <div style={{color: Colors.DARK_TWO}}>
      <div style={{marginBottom: 20, position: 'relative'}}>
        <div style={bobScoreStyle}>
          <BobScoreCircle
            isAnimated={false}
            percent={percent}
            radius={47.15}
            scoreSize={20}
            strokeWidth={3.1}
          />
          <div style={titleStyle}>{title}</div>
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
        <div style={subDiagnosticsStyle}>
          <div style={{alignItems: 'center', display: 'flex', flexDirection: 'column'}}>
            {components.map((component, index) => {
              return <ComponentScore
                component={component}
                isFirstSubmetric={index === 0}
                isTextShown={true}
                key={index}
                style={componentStyle}
                userYou={(tu, vous) => vous}
              >
                {this.renderCommentButton(component.topic, {opacity: 1, top: 20})}
                {this.renderComment(component.topic)}
              </ComponentScore>
            })}
          </div>
        </div>
      </div>
    </div>
  }
}

export {Assessment}
