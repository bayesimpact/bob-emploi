import _pick from 'lodash/pick'
import _range from 'lodash/range'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import {useDispatch} from 'react-redux'

import {DispatchAllActions, diagnoseOnboarding} from 'store/actions'
import {localizeOptions, prepareT} from 'store/i18n'
import {weeklyApplicationOptions, weeklyOfferOptions} from 'store/job'
import {getJobSearchLengthMonths, useUserExample} from 'store/user'

import FieldSet from 'components/field_set'
import Trans from 'components/i18n_trans'
import Select, {SelectOption} from 'components/select'
import {OnboardingComment, ProjectStepProps, Step} from './step'


// 2,635,200,000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2_635_200_000

const jobSearchLengthMonthsOptions = [
  {name: prepareT("Je n'ai pas encore commencé"), value: -1},
  ..._range(1, 19).map((monthsAgo) => ({
    name: prepareT('{{monthsAgo}} mois', {count: monthsAgo, monthsAgo}),
    value: monthsAgo,
  })),
  {
    name: prepareT('Plus de {{monthsAgo}} mois', {monthsAgo: 18}),
    value: 19,
  },
] as const


const updateJobSearchLength = (jobSearchLengthMonths: number): bayes.bob.Project => {
  const projectState: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
  if (jobSearchLengthMonths < 0) {
    // TODO(cyrille): Clear up the other fields (interview count, applications estimate).
    projectState.jobSearchHasNotStarted = true
  } else {
    projectState.jobSearchStartedAt =
      new Date(Date.now() - MILLIS_IN_MONTH * jobSearchLengthMonths).toISOString()
  }
  return projectState
}


const NewProjectJobsearchStep = (props: ProjectStepProps): React.ReactElement => {
  const {onSubmit, newProject = {}, t} = props

  const dispatch = useDispatch<DispatchAllActions>()
  const [isValidated, setIsValidated] = useState(false)
  const [applicationCommentRead, setApplicationCommentRead] = useState(false)

  const isFormValid = useMemo((): boolean => {
    const {
      jobSearchHasNotStarted = undefined,
      jobSearchStartedAt = undefined,
      totalInterviewCount = undefined,
      weeklyApplicationsEstimate = undefined,
      weeklyOffersEstimate = undefined,
    } = newProject || {}
    return jobSearchHasNotStarted || !!(
      totalInterviewCount && weeklyApplicationsEstimate && weeklyOffersEstimate &&
      jobSearchStartedAt)
  }, [newProject])

  const handleSubmit = useCallback((): void => {
    setIsValidated(true)
    const {jobSearchHasNotStarted, jobSearchStartedAt,
      totalInterviewCount, weeklyApplicationsEstimate, weeklyOffersEstimate,
    } = newProject
    if (isFormValid) {
      onSubmit({
        jobSearchHasNotStarted,
        jobSearchStartedAt,
        totalInterviewCount,
        weeklyApplicationsEstimate,
        weeklyOffersEstimate,
      })
    }
  }, [isFormValid, onSubmit, newProject])

  const userExample = useUserExample()
  const fastForward = useCallback((): void => {
    const {
      jobSearchHasNotStarted = undefined,
      jobSearchStartedAt = undefined,
      totalInterviewCount = undefined,
      weeklyApplicationsEstimate = undefined,
      weeklyOffersEstimate = undefined,
    } = newProject || {}
    if (isFormValid) {
      handleSubmit()
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
    if (!jobSearchHasNotStarted && !jobSearchStartedAt) {
      Object.assign(
        projectDiff,
        _pick(userExample.projects[0], ['jobSearchStartedAt', 'jobSearchHasNotStarted']))
    }
    if (!totalInterviewCount) {
      projectDiff.totalInterviewCount = userExample.projects[0].totalInterviewCount
    }
    if (!weeklyApplicationsEstimate) {
      projectDiff.weeklyApplicationsEstimate = userExample.projects[0].weeklyApplicationsEstimate
    }
    if (!weeklyOffersEstimate) {
      projectDiff.weeklyOffersEstimate = userExample.projects[0].weeklyOffersEstimate
    }
    dispatch(diagnoseOnboarding({projects: [projectDiff]}))

    setApplicationCommentRead(true)
  }, [dispatch, isFormValid, handleSubmit, newProject, userExample])

  const handleSearchLengthChange = useCallback((jobSearchLengthMonths: number): void => {
    dispatch(diagnoseOnboarding({projects: [updateJobSearchLength(jobSearchLengthMonths)]}))
  }, [dispatch])

  const handleChangeWeeklyOffersEstimate = useCallback(
    (weeklyOffersEstimate: bayes.bob.NumberOfferEstimateOption): void => {
      dispatch(diagnoseOnboarding({projects: [{weeklyOffersEstimate}]}))
    },
    [dispatch])
  const handleChangeWeeklyApplicationsEstimate = useCallback(
    (weeklyApplicationsEstimate: bayes.bob.NumberOfferEstimateOption): void => {
      if (applicationCommentRead) {
        setApplicationCommentRead(false)
      }
      dispatch(diagnoseOnboarding({projects: [{weeklyApplicationsEstimate}]}))
    },
    [applicationCommentRead, dispatch])
  const handleChangeTotalInterviewCount = useCallback((totalInterviewCount: number): void => {
    dispatch(diagnoseOnboarding({projects: [{totalInterviewCount}]}))
  }, [dispatch])

  // Handle the event marking the comment as read.
  //
  // NOTE: If there ever are any other commented fields,
  // add the field name as a parameter to the function and memoize it.
  const handleCommentRead = useCallback((): void => setApplicationCommentRead(true), [])

  const {targetJob, jobSearchHasNotStarted, totalInterviewCount, weeklyApplicationsEstimate,
    weeklyOffersEstimate} = newProject
  const interviewsLabel = targetJob ?
    <Trans parent="span">
      Combien d'entretiens d'embauche avez-vous obtenus <strong style={{fontWeight: 'bold'}}>
        depuis que vous cherchez ce métier
      </strong>&nbsp;?
    </Trans> : <Trans parent="span">
      Combien d'entretiens d'embauche avez-vous obtenus <strong style={{fontWeight: 'bold'}}>
        depuis que vous avez commencé votre recherche
      </strong>&nbsp;?
    </Trans>
  const jobSearchLengthMonths = getJobSearchLengthMonths(newProject)
  // Keep in sync with 'isValid' props from list of fieldset below.
  const checks = [
    jobSearchLengthMonths,
    weeklyOffersEstimate || jobSearchHasNotStarted,
    (applicationCommentRead && weeklyApplicationsEstimate) || jobSearchHasNotStarted,
    totalInterviewCount || jobSearchHasNotStarted,
  ]
  const numInterviewsOptions = useMemo(() => ([
    {name: t("Aucun pour l'instant"), value: -1},
    ...Array.from({length: 20}, (unused, index): SelectOption<number> => ({
      name: (index + 1) + '',
      value: index + 1,
    })),
    {name: t('Plus de 20'), value: 21},
  ]), [t])
  return <Step
    {...props} fastForward={fastForward}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}
    progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
    title={t('Votre recherche')}>
    <FieldSet
      label={targetJob ?
        t('Depuis combien de temps avez-vous commencé à postuler à des offres pour ce ' +
          'métier\u00A0?') :
        t("Depuis combien de temps avez-vous commencé votre recherche d'emploi\u00A0?")
      }
      isValid={!!jobSearchLengthMonths} isValidated={isValidated}
      hasCheck={true}>
      <Select<number>
        options={localizeOptions(t, jobSearchLengthMonthsOptions)}
        value={jobSearchLengthMonths}
        placeholder={t('sélectionnez la durée de votre recherche')}
        areUselessChangeEventsMuted={false} onChange={handleSearchLengthChange} />
    </FieldSet>
    {checks[0] && !jobSearchHasNotStarted ? <FieldSet
      label={t('En moyenne, combien trouvez-vous de nouvelles offres qui vous conviennent par ' +
        'semaine\u00A0?')}
      isValid={!!weeklyOffersEstimate} isValidated={isValidated}
      hasCheck={true}>
      <Select options={localizeOptions(t, weeklyOfferOptions)} value={weeklyOffersEstimate}
        placeholder={t("sélectionnez le nombre d'offres que vous avez trouvées")}
        onChange={handleChangeWeeklyOffersEstimate} />
    </FieldSet> : null}
    {checks.slice(0, 2).every((c): boolean => !!c) && !jobSearchHasNotStarted ? <React.Fragment>
      <FieldSet
        label={t('En moyenne, combien de candidatures faites-vous par semaine\u00A0?')}
        isValid={!!weeklyApplicationsEstimate} isValidated={isValidated}
        hasNoteOrComment={true} hasCheck={true}>
        <Select
          options={localizeOptions(t, weeklyApplicationOptions)}
          value={weeklyApplicationsEstimate}
          placeholder={t('sélectionnez le nombre de candidatures que vous avez faites')}
          onChange={handleChangeWeeklyApplicationsEstimate} />
      </FieldSet>
      <OnboardingComment
        field="WEEKLY_APPLICATION_FIELD" shouldShowAfter={!!weeklyApplicationsEstimate}
        key={weeklyApplicationsEstimate}
        onDone={handleCommentRead} />
    </React.Fragment> : null}
    {checks.slice(0, 3).every((c): boolean => !!c) && !jobSearchHasNotStarted ? <FieldSet
      label={interviewsLabel}
      isValid={!!totalInterviewCount} isValidated={isValidated}
      hasCheck={true}>
      <Select<number>
        onChange={handleChangeTotalInterviewCount}
        value={totalInterviewCount}
        placeholder={t("sélectionnez le nombre d'entretiens que vous avez obtenus")}
        options={numInterviewsOptions} />
    </FieldSet> : null}
  </Step>
}
NewProjectJobsearchStep.propTypes = {
  newProject: PropTypes.shape({
    jobSearchHasNotStarted: PropTypes.bool,
    jobSearchLengthMonths: PropTypes.number,
    jobSearchStartedAt: PropTypes.string,
    totalInterviewCount: PropTypes.number,
    weeklyApplicationsEstimate: PropTypes.string,
    weeklyOffersEstimate: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}


export default React.memo(NewProjectJobsearchStep)
