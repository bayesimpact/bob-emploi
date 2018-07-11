import React from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'

import {FastForward} from 'components/fast_forward'
import {isMobileVersion} from 'components/mobile'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement} from 'components/phylactery'
import {Button} from 'components/theme'

import {Step} from './step'


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
// TODO(marielaure): Put back tutoiement. See code at ed348de.
// TODO(marielaure): Only show the notice to new user when they register.
class NoticeStepBase extends React.Component {
  static propTypes = {
    onSubmit: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }

  state = {
    isFastForwarded: false,
  }

  handleSubmit = () => {
    const {onSubmit} = this.props
    onSubmit({})
  }

  onFastForward = () => {
    if (!this.state.isFastForwarded) {
      this.setState({isFastForwarded: true})
      return
    }
    this.handleSubmit()
  }

  render() {
    const {user} = this.props
    const boldStyle = {
      color: colors.BOB_BLUE,
    }
    const buttonStyle = {
      maxWidth: 250,
      padding: '12px 20px 13px',
    }
    const discussionStyle = {
      flexGrow: 1,
      flexShrink: 0,
      paddingBottom: 10,
      width: isMobileVersion ? 280 : 'initial',
    }

    return <Step fastForward={this.handleSubmit} {...this.props}>
      <FastForward onForward={this.onFastForward} />
      <Discussion
        style={discussionStyle} isOneBubble={true} isFastForwarded={this.state.isFastForwarded}>
        <DiscussionBubble>
          <BubbleToRead>Bienvenue <strong>{user.profile.name}</strong>&nbsp;!</BubbleToRead>
          <BubbleToRead>
            Je suis <strong style={boldStyle}>{config.productName}</strong>, votre assistant
            personnel pour accélérer votre recherche.
          </BubbleToRead>
          <BubbleToRead>
            Je vais vous poser quelques questions, pour comprendre votre projet et mieux cerner
            où vous en êtes.
          </BubbleToRead>
          <BubbleToRead>
            Cela prendra entre <strong style={boldStyle}>2</strong> et
            <strong style={boldStyle}> 5 minutes</strong> et je pourrai ensuite évaluer votre
            projet et vous aider à le réaliser.
          </BubbleToRead>
          <BubbleToRead>
            Si c'est le bon moment pour vous, commençons le questionnaire&nbsp;!
          </BubbleToRead>
        </DiscussionBubble>
        <NoOpElement style={{margin: '20px auto 0'}}>
          <Button isRound={true} onClick={this.handleSubmit} style={buttonStyle}>
            Commencer le questionnaire
          </Button>
        </NoOpElement>
      </Discussion>
    </Step>
  }
}
const NoticeStep = connect(({user}) => ({user}))(NoticeStepBase)

export {NoticeStep}
