import {stringify} from 'query-string'
import {useCallback} from 'react'
import {useHistory} from 'react-router-dom'
import {useDispatch} from 'react-redux'

import useFastForward from 'hooks/fast_forward'

import type {ProjectReviewActionType} from 'store/actions'
import {reviewProject} from 'store/actions'

import {Routes} from 'components/url'


const useProjectReview = (
  url: string, project: bayes.bob.Project, actionType: ProjectReviewActionType): (() => void) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const goToPage = useCallback((): void => {
    dispatch(reviewProject(actionType, project))
    if (url.startsWith(Routes.PROJECT_PAGE)) {
      history.push(url)
    } else {
      const {
        diagnostic: {categoryId: diagnosticId = ''} = {},
        targetJob: {jobGroup: {romeId: jobId = ''} = {}} = {},
        city: {name: cityName = '', regionId = ''} = {},
      } = project
      const city = `${cityName}, ${regionId}`
      window.location.href = url + `?${stringify({city, diagnosticId, jobId})}`
    }
  }, [actionType, dispatch, project, url, history])
  useFastForward((): void => goToPage(), [goToPage])
  return goToPage
}

export default useProjectReview
