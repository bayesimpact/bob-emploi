import PropTypes from 'prop-types'
import React, {useCallback} from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, setUserProfile} from 'store/actions'

import {Intro} from 'components/pages/intro'

import {ProfileStepProps, Step} from './step'


interface StepConnectedProps {
  user: bayes.bob.User
}

interface StepProps extends StepConnectedProps, ProfileStepProps {
  dispatch: DispatchAllActions
}


const noOp = (): void => {
  // Do nothing.
}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
// TODO(marielaure): Only show the notice to new user when they register.
const NoticeStepBase: React.FC<StepProps> = (props: StepProps): React.ReactElement => {
  const {dispatch, onSubmit, user: {profile: {name: userName = ''} = {}}} = props
  const handleSubmit = useCallback((canTutoie: boolean): Promise<boolean> => {
    dispatch(setUserProfile({canTutoie}, true))
    onSubmit && onSubmit({})
    return Promise.resolve(true)
  }, [dispatch, onSubmit])

  return <Step fastForward={noOp} {...props}>
    <Intro name={userName} onSubmit={handleSubmit} />
  </Step>
}
NoticeStepBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
}
const NoticeStep = connect(({user}: RootState): StepConnectedProps => ({user}))(NoticeStepBase)


export {NoticeStep}
