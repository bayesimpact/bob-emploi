
import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useParams} from 'react-router'
import {Redirect} from 'react-router-dom'

import {DispatchAllActions, RootState, editFirstProject} from 'store/actions'
import {flattenProject} from 'store/project'

import {isMobileVersion} from 'components/mobile'
import {CircularProgress} from 'components/theme'
import {PageWithNavigationBar, Scrollable} from 'components/navigation'
import {Routes} from 'components/url'
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

  const {stepName} = useParams()
  const {goBack, goNext, step, stepCount} = useProjectOnboarding(stepName)
  const pageDom = useRef<Scrollable>(null)
  useEffect((): void => pageDom.current?.scrollTo(0), [stepName])
  const dispatch = useDispatch<DispatchAllActions>()

  const handleSubmit = useCallback((): void => {
    if (!step || !newProject) {
      return
    }
    const {type = undefined} = step || {}
    dispatch(editFirstProject(newProject, t, type))
    goNext()
  }, [dispatch, goNext, newProject, step, t])

  const handleBack = useCallback((): void => {
    if (!step) {
      return
    }
    // TODO(pascal): Save state when going back as well.
    goBack?.()
  }, [goBack, step])

  // Prevent people from manually going back and creating another project.
  if (existingProject && !existingProject.isIncomplete) {
    return <Redirect to={`${Routes.PROJECT_PAGE}/${existingProject.projectId}`} />
  }
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
      stepNumber={stepNumber} t={t} />
  }
  return <PageWithNavigationBar style={{backgroundColor: '#fff'}}
    onBackClick={isMobileVersion ? handleBack : undefined}
    page="new_project" ref={pageDom}>
    <div>{content}</div>
  </PageWithNavigationBar>
}
export default React.memo(NewProjectPage)
