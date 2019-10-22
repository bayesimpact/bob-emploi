import React from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'

import {DispatchAllActions, RootState, setUserProfile} from 'store/actions'

import {Intro} from 'components/pages/intro'

import {ProfileStepProps, Step} from './step'


interface StepConnectedProps {
  user: bayes.bob.User
}

interface StepProps extends StepConnectedProps, ProfileStepProps {
  dispatch: DispatchAllActions
}


const noOp = (): void => {}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
// TODO(marielaure): Only show the notice to new user when they register.
class NoticeStepBase extends React.PureComponent<StepProps> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    user: PropTypes.object.isRequired,
  }

  private handleSubmit = (canTutoie: boolean): Promise<boolean> => {
    const {dispatch, onSubmit} = this.props
    dispatch(setUserProfile({canTutoie}, true))
    onSubmit && onSubmit({})
    return Promise.resolve(true)
  }

  public render(): React.ReactNode {
    const {user: {profile: {name: userName = ''} = {}}} = this.props
    return <Step fastForward={noOp} {...this.props}>
      <Intro name={userName} onSubmit={this.handleSubmit} />
    </Step>
  }
}
const NoticeStep = connect(({user}: RootState): StepConnectedProps => ({user}))(NoticeStepBase)

export {NoticeStep}
