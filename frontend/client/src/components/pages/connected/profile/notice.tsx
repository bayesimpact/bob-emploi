import React from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'

import {DispatchAllActions, RootState, setUserProfile} from 'store/actions'

import {FastForward} from 'components/fast_forward'
import {RadioGroup} from 'components/pages/connected/form_utils'
import {isMobileVersion} from 'components/mobile'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  QuestionBubble} from 'components/phylactery'
import {Button} from 'components/theme'

import {ProfileStepProps, Step} from './step'

const tutoiementOptions = [
  {name: 'oui, pourquoi pas', value: true},
  {name: 'non, je ne préfère pas', value: false},
]


interface StepConnectedProps {
  user: bayes.bob.User
}

interface StepProps extends StepConnectedProps, ProfileStepProps {
  dispatch: DispatchAllActions
}


interface StepState {
  canTutoie?: boolean
  isFastForwarded?: boolean
}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
// TODO(marielaure): Only show the notice to new user when they register.
class NoticeStepBase extends React.PureComponent<StepProps, StepState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }

  public state: StepState = {
    isFastForwarded: false,
  }

  private handleSubmit = (): void => {
    const {dispatch, onSubmit} = this.props
    const {canTutoie} = this.state
    dispatch(setUserProfile({canTutoie}, true))
    onSubmit({})
  }

  private handleChangeTutoiement = (canTutoie): void => this.setState({canTutoie})

  private onFastForward = (): void => {
    const {canTutoie, isFastForwarded} = this.state
    if (!isFastForwarded) {
      this.setState({isFastForwarded: true})
      return
    }
    if (typeof canTutoie !== 'boolean') {
      this.setState({canTutoie: Math.random() < .5})
      return
    }
    this.handleSubmit()
  }

  public render(): React.ReactNode {
    const {user: {profile: {name: userName = ''} = {}}} = this.props
    const {canTutoie} = this.state
    const userYou = (tu: string, vous: string): string => canTutoie ? tu : vous
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
        style={discussionStyle} isFastForwarded={this.state.isFastForwarded}>
        <DiscussionBubble>
          <BubbleToRead>Bienvenue <strong>{userName}</strong>&nbsp;!</BubbleToRead>
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
            Et pour commencer, peut-on se tutoyer&nbsp;?
          </BubbleToRead>
        </DiscussionBubble>
        <QuestionBubble isDone={typeof canTutoie === 'boolean'}>
          <RadioGroup style={{justifyContent: 'space-between', margin: 20}}
            onChange={this.handleChangeTutoiement}
            options={tutoiementOptions} value={canTutoie} />
        </QuestionBubble>
        <DiscussionBubble>
          <BubbleToRead>
            D'accord, c'est noté.
          </BubbleToRead>
          <BubbleToRead>
            Si c'est le bon moment pour {userYou('toi', 'vous')}, commençons le questionnaire&nbsp;!
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
const NoticeStep = connect(({user}: RootState): StepConnectedProps => ({user}))(NoticeStepBase)

export {NoticeStep}
