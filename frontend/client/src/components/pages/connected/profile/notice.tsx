import React, {useCallback} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import type {DispatchAllActions, RootState} from 'store/actions'
import {setUserProfile} from 'store/actions'

import {Intro} from 'components/pages/intro'

import type {ProfileStepProps} from './step'
import {Step} from './step'


const noOp = (): void => {
  // Do nothing.
}


// TODO(pascal): Don't show the notice after back-navigation from the succeeding step.
// TODO(sil): Only show the notice to new user when they register.
// TODO(émilie): update handleSubmit and send all the data in AuthUserData.
// TODO(pascal): Drop, as this is almost never used.
const NoticeStep: React.FC<ProfileStepProps> = (props: ProfileStepProps):
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

  return <Step fastForward={noOp} {...props} onNextButtonClick={noOp}>
    <Intro name={userName} onSubmit={handleSubmit} />
  </Step>
}


export default React.memo(NoticeStep)
