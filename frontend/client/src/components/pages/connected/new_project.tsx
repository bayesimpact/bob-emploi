
import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useHistory, useLocation, useParams} from 'react-router'
import {Redirect} from 'react-router-dom'

import {DispatchAllActions, RootState, editFirstProject, onboardingPage} from 'store/actions'
import {flattenProject} from 'store/project'

import isMobileVersion from 'store/mobile'
import CircularProgress from 'components/circular_progress'
import {PageWithNavigationBar, Scrollable} from 'components/navigation'
import {NEW_PROJECT_ID, Routes} from 'components/url'
import {useProjectOnboarding} from './profile/onboarding'


const emptyObject = {} as const


const NewProjectPage = (): React.ReactElement => {
  const {t} = useTranslation()
  const existingProject = useSelector(
    ({user}: RootState): bayes.bob.Project|undefined => user.projects?.[0],
  )
  const featuresEnabled = useSelector(
    ({user: {featuresEnabled}}: RootState): bayes.bob.Features => featuresEnabled || emptyObject,
  )
  const isCreatingProject = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['CREATE_PROJECT_SAVE'],
  )
  const userProfile = useSelector(
    ({user: {profile}}: RootState): bayes.bob.UserProfile => profile || emptyObject,
  )

  const newProject = useMemo(
    (): bayes.bob.Project => flattenProject(existingProject || {}),
    [existingProject],
  )

  const {stepName} = useParams<{stepName: string}>()
  const history = useHistory()
  const {pathname: url} = useLocation()
  const {goBack, goNext, hasNextStep, step, stepCount} = useProjectOnboarding(stepName)
  const pageDom = useRef<Scrollable>(null)
  useEffect((): void => pageDom.current?.scrollTo(0), [stepName])
  const dispatch = useDispatch<DispatchAllActions>()

  const handleSubmit = useCallback((): void => {
    if (!step || !newProject) {
      return
    }
    const {type = undefined} = step || {}
    dispatch(editFirstProject(newProject, t, type))
    dispatch(onboardingPage(url, {profile: userProfile}, newProject))
    goNext()
  }, [dispatch, goNext, newProject, step, t, url, userProfile])

  const handleBack = useCallback((): void => {
    if (!step) {
      return
    }
    // TODO(pascal): Save state when going back as well.
    goBack?.()
  }, [goBack, step])

  // Prevent people from manually going back and editing a complete project.
  const completeProjectId = existingProject && !existingProject.isIncomplete ?
    existingProject.projectId || NEW_PROJECT_ID : undefined
  useEffect((): (() => void) => {
    if (!completeProjectId) {
      return () => void 0
    }
    const timeout = window.setTimeout(
      () => history.push(`${Routes.PROJECT_PAGE}/${completeProjectId}`),
      100,
    )
    return () => window.clearTimeout(timeout)
  }, [completeProjectId, history])

  const spinnerBoxStyle = {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    margin: '20px 0',
  }
  let content
  if (isCreatingProject) {
    content = <div style={spinnerBoxStyle}><CircularProgress /></div>
  } else {
    const {
      component: StepComponent,
      stepNumber,
    } = step || {}
    if (!StepComponent) {
      return <Redirect to="/" />
    }
    content = <StepComponent
      featuresEnabled={featuresEnabled}
      isShownAsStepsDuringOnboarding={true}
      onSubmit={handleSubmit} profile={userProfile}
      onPreviousButtonClick={isMobileVersion ? undefined : handleBack}
      newProject={newProject} totalStepCount={stepCount}
      stepNumber={stepNumber} t={t} isLastOnboardingStep={!hasNextStep} />
  }
  return <PageWithNavigationBar style={{backgroundColor: '#fff'}}
    onBackClick={isMobileVersion ? handleBack : undefined}
    page="new_project" ref={pageDom}>
    <div>{content}</div>
  </PageWithNavigationBar>
}
export default React.memo(NewProjectPage)
