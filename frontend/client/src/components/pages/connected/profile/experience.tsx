import React, {useState, useCallback, useEffect, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import type {DispatchAllActions, RootState} from 'store/actions'
import {diagnoseOnboarding, fetchProjectRequirements,
  setUserProfile} from 'store/actions'
import {localizeOptions, prepareT} from 'store/i18n'
import {PROJECT_EXPERIENCE_OPTIONS, SENIORITY_OPTIONS,
  TRAINING_FULFILLMENT_ESTIMATE_OPTIONS} from 'store/project'
import {useUserExample} from 'store/user'

import {OneField} from 'components/field_set'
import Trans from 'components/i18n_trans'
import RadioGroup from 'components/radio_group'
import type {Focusable} from 'components/select'
import Select from 'components/select'

import type {ProjectStepProps} from './step'
import {OnboardingComment, Step} from './step'


const networkEstimateOptions = [
  {name: prepareT("J'ai de très bons contacts"), value: 3},
  {name: prepareT("J'ai quelques personnes en tête"), value: 2},
  {name: prepareT('Je ne pense pas'), value: 1},
]

const drivingLicenseOptions = [
  {name: prepareT('oui'), value: 'TRUE'},
  {name: prepareT('non'), value: 'FALSE'},
] as const

// TODO: Move to store.
function isSeniorityRequired(previousJobSimilarity?: bayes.bob.PreviousJobSimilarity): boolean {
  return previousJobSimilarity !== 'NEVER_DONE'
}


const getRequirements = (
  jobRequirements: bayes.bob.JobRequirements|undefined,
  requirementId: 'diplomas' | 'drivingLicenses'): readonly bayes.bob.JobRequirement[] => {
  const {[requirementId]: requirements = []} = jobRequirements || {}
  return requirements
}

function hasGroupWithRomeId(job?: bayes.bob.Job): job is {jobGroup: {romeId: string}} {
  return !!(job && job.jobGroup && job.jobGroup.romeId)
}


const emptyObject = {} as const


const NewProjectExperienceStep = (props: ProjectStepProps): React.ReactElement => {
  const {newProject = {}, onSubmit, profile: {gender, hasCarDrivingLicense}} = props
  const {trainingFulfillmentEstimate: projectTrainingEstimate, previousJobSimilarity,
    networkEstimate, seniority, city, targetJob} = newProject
  const dispatch = useDispatch<DispatchAllActions>()
  const isFetchingRequirements = useSelector(
    ({asyncState: {isFetching}}: RootState): boolean => !!isFetching['GET_PROJECT_REQUIREMENTS'],
  )
  const jobRequirements = useSelector(
    ({app: {jobRequirements}}: RootState): {[codeOgr: string]: bayes.bob.JobRequirements} =>
      jobRequirements || emptyObject,
  )
  const {t} = useTranslation()
  const targetJobRequirements =
    targetJob?.codeOgr && jobRequirements?.[targetJob?.codeOgr] || undefined

  const [isValidated, setIsValidated] = useState(false)
  const [isNetworkCommentRead, setIsNetworkCommentRead] = useState(false)
  const readNetworkComment = useCallback((): void => setIsNetworkCommentRead(true), [])
  const [isTrainingCommentRead, setIsTrainingCommentRead] = useState(false)
  const readTrainingComment = useCallback((): void => setIsTrainingCommentRead(true), [])

  const diplomasRequirements = getRequirements(targetJobRequirements, 'diplomas')
  const isTrainingRequired =
    isFetchingRequirements || !diplomasRequirements.length || diplomasRequirements.some(
      ({diploma: {level} = {}}) => level !== 'NO_DEGREE')
  const propsTrainingEstimate =
    projectTrainingEstimate || (!isTrainingRequired && 'NO_TRAINING_REQUIRED') || undefined
  const [trainingFulfillmentEstimate, setTrainingFulfillmentEstimate] =
    useState(propsTrainingEstimate)
  useEffect(
    (): void => setTrainingFulfillmentEstimate(propsTrainingEstimate),
    [propsTrainingEstimate],
  )

  useEffect((): void => {
    if (targetJob?.codeOgr && !targetJobRequirements && hasGroupWithRomeId(targetJob)) {
      dispatch(fetchProjectRequirements({targetJob}))
    }
  }, [dispatch, targetJob, targetJobRequirements])

  const isDrivingLicenseRequired = isFetchingRequirements ||
    !!getRequirements(targetJobRequirements, 'drivingLicenses').length ||
    // Keep this in sync with frontend/server/modules/driving_license.py _license_helps_mobility.
    !!(city && (city.urbanScore && city.urbanScore <= 5 ||
      city.publicTransportationScore && city.publicTransportationScore <= 5))

  const similarityInputRef = useRef<Focusable>(null)
  const seniorityInputRef = useRef<Focusable>(null)
  const trainingEstimateInputRef = useRef<Focusable>(null)
  const drivingLicenseInputRef = useRef<Focusable>(null)
  const networkInputRef = useRef<Focusable>(null)

  const isSimilarityValid = !!previousJobSimilarity
  const isSeniorityValid = !isSeniorityRequired(previousJobSimilarity) ||
    !!seniority && seniority !== 'UNKNOWN_PROJECT_SENIORITY'
  const isTrainingFulfillmentValid = !!trainingFulfillmentEstimate
  const isDrivingLicenseValid = !isDrivingLicenseRequired || hasCarDrivingLicense
  const isNetworkValid = !!networkEstimate
  const isFormValid = isSimilarityValid && isTrainingFulfillmentValid && isSeniorityValid &&
    isDrivingLicenseValid && !!isNetworkValid

  const handleSubmit = useCallback((): void => {
    setIsValidated(true)
    if (!isSimilarityValid) {
      similarityInputRef.current?.focus()
      return
    }
    if (!isSeniorityValid) {
      seniorityInputRef.current?.focus()
      return
    }
    if (!isTrainingFulfillmentValid) {
      trainingEstimateInputRef.current?.focus()
      return
    }
    if (!isDrivingLicenseValid) {
      drivingLicenseInputRef.current?.focus()
      return
    }
    if (!isNetworkValid) {
      networkInputRef.current?.focus()
      return
    }
    if (isFormValid) {
      // TODO(cyrille): Refacto handling changes from profile and project at the same time.
      dispatch(setUserProfile({hasCarDrivingLicense}, true))
      onSubmit({
        networkEstimate,
        previousJobSimilarity,
        seniority,
        trainingFulfillmentEstimate,
      })
    }
  }, [
    dispatch, trainingFulfillmentEstimate, networkEstimate, previousJobSimilarity,
    hasCarDrivingLicense, seniority, onSubmit, isFormValid, isSimilarityValid, isSeniorityValid,
    isTrainingFulfillmentValid, isDrivingLicenseValid, isNetworkValid,
  ])

  const userExample = useUserExample()
  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleSubmit()
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
    if (!previousJobSimilarity) {
      projectDiff.previousJobSimilarity = userExample.projects[0].previousJobSimilarity
    }
    if (!seniority && isSeniorityRequired(projectDiff.previousJobSimilarity)) {
      projectDiff.seniority = userExample.projects[0].seniority
    }
    if (!trainingFulfillmentEstimate) {
      projectDiff.trainingFulfillmentEstimate = userExample.projects[0].trainingFulfillmentEstimate
    }
    if (!networkEstimate) {
      projectDiff.networkEstimate = userExample.projects[0].networkEstimate
    }

    const userDiff: {-readonly [K in keyof bayes.bob.User]?: bayes.bob.User[K]} = {}
    if (!hasCarDrivingLicense && isDrivingLicenseRequired) {
      userDiff.profile = {hasCarDrivingLicense: userExample.profile.hasCarDrivingLicense}
    }
    if (Object.keys(projectDiff).length) {
      userDiff.projects = [projectDiff]
    }
    dispatch(diagnoseOnboarding(userDiff))

    readNetworkComment()
    readTrainingComment()
  }, [
    networkEstimate, previousJobSimilarity, seniority, hasCarDrivingLicense,
    trainingFulfillmentEstimate, handleSubmit, dispatch, isDrivingLicenseRequired, isFormValid,
    readTrainingComment, readNetworkComment, userExample,
  ])

  const handleDrivingLicenseChange = useCallback((value: bayes.OptionalBool): void => {
    dispatch(diagnoseOnboarding({profile: {hasCarDrivingLicense: value}}))
  }, [dispatch])

  const handleChangeNetworkEstimate = useCallback((networkEstimate: number): void => {
    dispatch(diagnoseOnboarding({projects: [{networkEstimate}]}))
    readNetworkComment()
  }, [dispatch, readNetworkComment])

  const handleChangeTrainingFulfillmentEstimate = useCallback(
    (trainingFulfillmentEstimate: bayes.bob.TrainingFulfillmentEstimate): void => {
      dispatch(diagnoseOnboarding({projects: [{trainingFulfillmentEstimate}]}))
      readTrainingComment()
    },
    [dispatch, readTrainingComment],
  )

  const handleChangeSeniority = useCallback((seniority: bayes.bob.ProjectSeniority): void => {
    dispatch(diagnoseOnboarding({projects: [{seniority}]}))
  }, [dispatch])

  const handleChangeSimilarity = useCallback(
    (previousJobSimilarity: bayes.bob.PreviousJobSimilarity): void => {
      dispatch(diagnoseOnboarding({projects: [{
        previousJobSimilarity,
        ...(previousJobSimilarity === 'NEVER_DONE' ? {seniority: 'UNKNOWN_PROJECT_SENIORITY'} : {}),
      }]}))
    },
    [dispatch],
  )

  const needSeniority = isSeniorityRequired(previousJobSimilarity)
  const needLicense = isDrivingLicenseRequired

  const networkLabel = <Trans parent="span">
    Avez-vous un bon réseau&nbsp;?
    Connaissez-vous des gens qui pourraient vous aider à trouver un poste&nbsp;?
  </Trans>
  // Keep in sync with 'isValid' props from list of fieldset below.
  const checks = [
    previousJobSimilarity,
    seniority || !needSeniority,
    (trainingFulfillmentEstimate && isTrainingCommentRead) || !isTrainingRequired,
    hasCarDrivingLicense || !needLicense,
    networkEstimate && isNetworkCommentRead,
  ]
  return <Step
    {...props} fastForward={fastForward}
    title={t('Votre expérience')}
    progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
    onNextButtonClick={handleSubmit}>
    <div>
      <OneField label={t('Avez-vous déjà fait ce métier\u00A0?')}
        isValid={isSimilarityValid} isValidated={isValidated} hasCheck={true}>
        <Select<bayes.bob.PreviousJobSimilarity>
          options={localizeOptions(t, PROJECT_EXPERIENCE_OPTIONS)} value={previousJobSimilarity}
          placeholder={t("choisissez un type d'expérience")} ref={similarityInputRef}
          onChange={handleChangeSimilarity} />
      </OneField>
      {checks[0] && needSeniority ? <OneField
        label={t("Quel est votre niveau d'expérience dans ce métier\u00A0?")}
        isValid={isSeniorityValid} isValidated={isValidated}
        hasCheck={true}>
        <Select<bayes.bob.ProjectSeniority>
          options={localizeOptions(t, SENIORITY_OPTIONS)} value={seniority}
          placeholder={t("choisissez un niveau d'expérience")} ref={seniorityInputRef}
          onChange={handleChangeSeniority} />
      </OneField> : null}
      {checks.slice(0, 2).every((c): boolean => !!c) && isTrainingRequired ? <React.Fragment>
        <OneField
          label={t('Pensez-vous avoir les diplômes requis pour ce métier\u00A0?')}
          hasNoteOrComment={true}
          style={{maxWidth: 600}}
          isValid={!!trainingFulfillmentEstimate} isValidated={isValidated}
          hasCheck={true}>
          <Select<bayes.bob.TrainingFulfillmentEstimate>
            options={localizeOptions(t, TRAINING_FULFILLMENT_ESTIMATE_OPTIONS, {context: gender})}
            placeholder={t('choisissez une qualification')}
            value={trainingFulfillmentEstimate} ref={trainingEstimateInputRef}
            onChange={handleChangeTrainingFulfillmentEstimate} />
        </OneField>
        <OnboardingComment
          field="REQUESTED_DIPLOMA_FIELD" key={trainingFulfillmentEstimate}
          onDone={readTrainingComment}
          shouldShowAfter={!!trainingFulfillmentEstimate} />
      </React.Fragment> : null}
      {checks.slice(0, 3).every((c): boolean => !!c) && needLicense ? <OneField
        label={t('Avez-vous le permis de conduire\u00A0?')}
        style={{maxWidth: 600}}
        isValid={!!hasCarDrivingLicense}
        isValidated={isValidated} hasCheck={true}>
        <RadioGroup<bayes.OptionalBool>
          style={{justifyContent: 'space-around'}}
          onChange={handleDrivingLicenseChange}
          options={localizeOptions(t, drivingLicenseOptions)}
          value={hasCarDrivingLicense}
          ref={drivingLicenseInputRef} />
      </OneField> : null}
      {checks.slice(0, 4).every((c): boolean => !!c) ? <React.Fragment>
        <OneField label={networkLabel}
          isValid={!!networkEstimate}
          isValidated={isValidated}
          hasNoteOrComment={true}
          hasCheck={true}>
          <Select<number>
            options={localizeOptions(t, networkEstimateOptions)}
            value={networkEstimate} ref={networkInputRef}
            placeholder={t('choisissez une estimation de votre réseau')}
            onChange={handleChangeNetworkEstimate} />
        </OneField>
        <OnboardingComment field="NETWORK_FIELD" key={networkEstimate}
          onDone={readNetworkComment}
          shouldShowAfter={!!networkEstimate} />
      </React.Fragment> : null}
    </div>
  </Step>
}


export default React.memo(NewProjectExperienceStep)
