import PropTypes from 'prop-types'
import React, {useCallback} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, setUserProfile} from 'store/actions'

import {Intro} from 'components/pages/intro'

import {ProfileStepProps, Step} from './step'


const noOp = (): void => {
  // Do nothing.
}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
// TODO(sil): Only show the notice to new user when they register.
const NoticeStepBase: React.FC<ProfileStepProps> = (props: ProfileStepProps):
React.ReactElement => {
  const {onSubmit} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const userName = useSelector(
    ({user: {profile: {name: userName = ''} = {}} = {}}: RootState): string => userName)
  const handleSubmit = useCallback(
    ({locale}: bayes.bob.AuthUserData): Promise<boolean> => {
      dispatch(setUserProfile({locale}, true))
      onSubmit?.({})
      return Promise.resolve(true)
    },
    [dispatch, onSubmit],
  )

  return <Step fastForward={noOp} {...props}>
    <Intro name={userName} onSubmit={handleSubmit} />
  </Step>
}
NoticeStepBase.propTypes = {
  onSubmit: PropTypes.func.isRequired,
}
const NoticeStep = React.memo(NoticeStepBase)


export {NoticeStep}
