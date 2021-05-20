import {useCallback} from 'react'
import {useHistory} from 'react-router-dom'
import {useDispatch} from 'react-redux'

import useFastForward from 'hooks/fast_forward'

import {ProjectReviewActionType, reviewProject} from 'store/actions'


const useProjectReview = (
  url: string, project: bayes.bob.Project, actionType: ProjectReviewActionType): (() => void) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const goToPage = useCallback((): void => {
    dispatch(reviewProject(actionType, project))
    history.push(url)
  }, [actionType, dispatch, project, url, history])
  useFastForward((): void => goToPage(), [goToPage])
  return goToPage
}

export default useProjectReview
