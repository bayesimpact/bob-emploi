import {TFunction} from 'i18next'
import _pick from 'lodash/pick'
import _range from 'lodash/range'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'
import {useDispatch} from 'react-redux'

import {DispatchAllActions, diagnoseOnboarding} from 'store/actions'
import {localizeOptions, prepareT} from 'store/i18n'
import {weeklyApplicationOptions} from 'store/job'
import {getJobSearchLengthMonths, userExample} from 'store/user'

import {Trans} from 'components/i18n'
import {FieldSet, LocalizedSelectOption, Select,
  SelectOption} from 'components/pages/connected/form_utils'
import {OnboardingComment, ProjectStepProps, Step} from './step'


// 2635200000 = 1000 * 60 * 60 * 24 * 30.5
const MILLIS_IN_MONTH = 2635200000

const jobSearchLengthMonthsOptions = [
  {name: (t: TFunction): string => t("Je n'ai pas encore commencé"), value: -1},
]
_range(1, 19).forEach((monthsAgo): void => {
  jobSearchLengthMonthsOptions.push({
    name: (t: TFunction): string => t('{{monthsAgo}} mois', {count: monthsAgo, monthsAgo}),
    value: monthsAgo,
  })
})
jobSearchLengthMonthsOptions.push({
  name: (t: TFunction): string => t('Plus de {{monthsAgo}} mois', {monthsAgo: 18}),
  value: 19,
})


interface WihtName {
  name: (T: TFunction) => string
}


function localizeFuncOptions<T extends WihtName>(
  t: TFunction, options: readonly T[],
): readonly (Omit<T, 'name'> & {name: string})[] {
  return options.map(({name, ...other}) => ({name: name(t), ...other}))
}


// TODO(cyrille): Move to store.
const weeklyOfferOptions: readonly LocalizedSelectOption<bayes.bob.NumberOfferEstimateOption>[] = [
  {name: prepareT('0 ou 1 offre intéressante par semaine'), value: 'LESS_THAN_2'},
  {name: prepareT('2 à 5 offres intéressantes par semaine'), value: 'SOME'},
  {name: prepareT('6 à 15 offres intéressantes  par semaine'), value: 'DECENT_AMOUNT'},
  {name: prepareT('Plus de 15 offres intéressantes par semaine'), value: 'A_LOT'},
]


// TODO(cyrille): Drop this function and use the above once we're sure both date and bool fields are
// correct.
const getJobSearch = (project: bayes.bob.Project): bayes.bob.Project => {
  const length = getJobSearchLengthMonths(project)
  return {
    jobSearchHasNotStarted: project.jobSearchHasNotStarted || length < 0,
    jobSearchLengthMonths: length,
  }
}

const updateJobSearchLength = (jobSearchLengthMonths: number): bayes.bob.Project => {
  // TODO(cyrille): Drop length in months once field is removed.
  const projectState: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} =
    {jobSearchLengthMonths}
  if (jobSearchLengthMonths < 0) {
    projectState.jobSearchHasNotStarted = true
  } else {
    projectState.jobSearchStartedAt =
      new Date(new Date().getTime() - MILLIS_IN_MONTH * jobSearchLengthMonths).toISOString()
  }
  return projectState
}


const NewProjectJobsearchStepBase = (props: ProjectStepProps): React.ReactElement => {
  const {onSubmit, newProject = {}, t} = props

  const dispatch = useDispatch<DispatchAllActions>()
  const [isValidated, setIsValidated] = useState(false)
  const [applicationCommentRead, setApplicationCommentRead] = useState(false)

  const isFormValid = useMemo((): boolean => {
    // TODO(cyrille): Drop jobSearchLengthMonths once old users have been migrated.
    const {
      jobSearchHasNotStarted = undefined,
      jobSearchLengthMonths = undefined,
      jobSearchStartedAt = undefined,
      totalInterviewCount = undefined,
      weeklyApplicationsEstimate = undefined,
      weeklyOffersEstimate = undefined,
    } = newProject || {}
    return !!(totalInterviewCount && weeklyApplicationsEstimate &&
              weeklyOffersEstimate &&
              (jobSearchStartedAt || jobSearchLengthMonths && jobSearchLengthMonths >= 0) ||
              (jobSearchHasNotStarted || jobSearchLengthMonths === -1))
  }, [newProject])

  const handleSubmit = useCallback((): void => {
    setIsValidated(true)
    const {jobSearchHasNotStarted, jobSearchStartedAt, jobSearchLengthMonths,
      totalInterviewCount, weeklyApplicationsEstimate, weeklyOffersEstimate,
    } = newProject
    if (isFormValid) {
      onSubmit({
        jobSearchHasNotStarted,
        // TODO(cyrille): Drop once every user has the two other fields set.
        jobSearchLengthMonths,
        jobSearchStartedAt,
        totalInterviewCount,
        weeklyApplicationsEstimate,
        weeklyOffersEstimate,
      })
    }
  }, [isFormValid, onSubmit, newProject])

  const fastForward = useCallback((): void => {
    const {
      jobSearchHasNotStarted = undefined,
      jobSearchLengthMonths = undefined,
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
    if (!jobSearchLengthMonths && !jobSearchHasNotStarted && !jobSearchStartedAt) {
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
  }, [dispatch, isFormValid, handleSubmit, newProject])

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

  const {totalInterviewCount, weeklyApplicationsEstimate, weeklyOffersEstimate} = newProject
  const interviewsLabel = <Trans parent="span">
    Combien d'entretiens d'embauche avez-vous obtenus <strong style={{fontWeight: 'bold'}}>
      depuis que vous cherchez ce métier
    </strong>&nbsp;?
  </Trans>
  const {jobSearchHasNotStarted, jobSearchLengthMonths} = getJobSearch(newProject)
  // Keep in sync with 'isValid' props from list of fieldset below.
  const checks = [
    jobSearchLengthMonths,
    weeklyOffersEstimate || jobSearchHasNotStarted,
    (applicationCommentRead && weeklyApplicationsEstimate) || jobSearchHasNotStarted,
    totalInterviewCount || jobSearchHasNotStarted,
  ]
  return <Step
    {...props} fastForward={fastForward}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}
    progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
    title={t('Votre recherche')}>
    <FieldSet
      label={t('Depuis combien de temps avez-vous commencé à postuler à des offres pour ce ' +
        'métier\u00A0?')}
      isValid={!!jobSearchLengthMonths} isValidated={isValidated}
      hasCheck={true}>
      <Select<number>
        options={localizeFuncOptions(t, jobSearchLengthMonthsOptions)}
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
        options={[{name: t("Aucun pour l'instant"), value: -1}].
          concat(new Array(20).fill(0).map((unused, index): SelectOption<number> => ({
            name: (index + 1) + '',
            value: index + 1,
          }))).
          concat([{name: t('Plus de 20'), value: 21}])} />
    </FieldSet> : null}
  </Step>
}
NewProjectJobsearchStepBase.propTypes = {
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
const NewProjectJobsearchStep = React.memo(NewProjectJobsearchStepBase)


export {NewProjectJobsearchStep, weeklyOfferOptions}
