import {TFunction} from 'i18next'
// eslint-disable-next-line you-dont-need-lodash-underscore/omit
import _omit from 'lodash/omit'
import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useRef, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, diagnoseOnboarding} from 'store/actions'
import {lowerFirstLetter, ofJobName} from 'store/french'
import {localizeOptions} from 'store/i18n'
import {genderizeJob} from 'store/job'
import {PROJECT_KIND_OPTIONS, PROJECT_LOCATION_AREA_TYPE_OPTIONS,
  PROJECT_PASSIONATE_OPTIONS} from 'store/project'
import {userExample} from 'store/user'

import adieLogo from 'images/adie-logo.png'
import afeLogo from 'images/afe-ico.png'
import afpaLogo from 'images/afpa-ico.png'
import capEmploiLogo from 'images/cap-emploi-ico.png'
import hanploiLogo from 'images/hanploi-ico.jpg'
import pixisLogo from 'images/pixis-ico.png'
import poleEmploiLogo from 'images/ple-emploi-ico.png'

import {Trans} from 'components/i18n'
import {CitySuggest, Focusable, JobSuggest} from 'components/suggestions'
import {ExternalLink, LabeledToggle, WithNote, Styles} from 'components/theme'
import {FieldSet, Select} from 'components/pages/connected/form_utils'

import {OnboardingComment, ProjectStepProps, Step} from './step'


const _CREATION_TOOLS: readonly Tool[] = [
  {
    description: (t): string => t('pour réféchir, définir et affiner une idée.'),
    from: 'Pôle emploi',
    logo: poleEmploiLogo,
    name: "Activ'crea",
    url: 'http://www.pole-emploi.fr/candidat/activ-crea-@/article.jspz?id=325937',
  },
  {
    description: (t): string => t('pour calculer vos charges en micro-entreprise.'),
    from: 'Agence France Entrepreneur',
    logo: afeLogo,
    name: 'Afecreation',
    url: 'https://www.afecreation.fr/pid11436/calculatrice-de-charges-micro-entrepreneur.html?espace=1',
  },
  {
    description: (t): string => t('pour financer sa micro-entreprise'),
    from: "Association pour le Droit à l'Initiative Économique",
    logo: adieLogo,
    name: 'Adie',
    url: 'https://www.adie.org?utm_source=bob-emploi',
  },
]


interface CreationArgs {
  description?: (t: TFunction) => string
  title: (t: TFunction) => string
  tools: readonly Tool[]
}


const _CREATION_ARGS: CreationArgs = {
  title: (t): string => t("Nous ne traitons pas encore bien la création d'entreprise"),
  tools: _CREATION_TOOLS,
}


const _REORIENTATION_TOOLS: readonly Tool[] = [
  {
    description: (t): string => t('pour explorer des centaines de métiers.'),
    from: 'Pixis.co',
    logo: pixisLogo,
    name: 'Pixis',
    url: 'https://pixis.co',
  },
  {
    description: (t): string => t("un questionnaire complet pour s'orienter."),
    from: 'Association pour la Formation Professionnelle des Adultes',
    logo: afpaLogo,
    name: 'Afpa',
    url: 'https://www.afpa.fr/id-metiers',
  },
]


const linkInheritStyle = {
  color: 'inherit',
  textDecoration: 'inherit',
}

interface Tool {
  description: (t: TFunction) => string
  from: React.ReactNode
  logo: string
  name: string
  url: string
}

const getHandicapSpecificTools = (departementId: string): readonly Tool[] => [
  {
    description: (t): string =>
      t("service public d'aide aux personnes en situation de handicap pour l'emploi"),
    from: "Association de Gestion du Fonds pour l'Insertion professionnelle " +
      'des Personnes Handicapées',
    logo: capEmploiLogo,
    name: 'Cap emploi',
    url: departementId ? `https://www.capemploi-${departementId}.com` :
      'https://www.agefiph.fr/annuaire',
  },
  {
    description: (t): string => t('experts en recrutement des personnes en situation de handicap'),
    from: <Trans parent={null}>
      <ExternalLink style={linkInheritStyle} href="tel:+33144524069">
        01 44 52 40 69
      </ExternalLink><br />
      Du lundi au vendredi<br />
      de 9h30 à 13h et de 14h à 17h30
    </Trans>,
    logo: hanploiLogo,
    name: 'Hanploi',
    url: 'https://www.hanploi.com',
  },
]


const _REORIENTATION_ARGS: CreationArgs = {
  title: (t: TFunction): string =>
    t('Nous ne traitons pas encore bien la reconversion professionnelle'),
  tools: _REORIENTATION_TOOLS,
} as const


const jobUnknownStyle: React.CSSProperties = {marginBottom: 25}


// Fields to reset when changing the job.
const resetProjectForJobChange: bayes.bob.Project = {
  jobSearchHasNotStarted: undefined,
  jobSearchLengthMonths: undefined,
  jobSearchStartedAt: undefined,
  networkEstimate: undefined,
  passionateLevel: undefined,
  previousJobSimilarity: undefined,
  seniority: undefined,
  totalInterviewCount: undefined,
  trainingFulfillmentEstimate: undefined,
  weeklyApplicationsEstimate: undefined,
  weeklyOffersEstimate: undefined,
} as const


const NewProjectGoalStepBase = (props: ProjectStepProps): React.ReactElement => {
  const {newProject, newProject: {
    areaType, city, hasClearProject, kind, passionateLevel, targetJob,
  }, onSubmit, profile: {gender = undefined, hasHandicap = undefined} = {}} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const {i18n, t} = useTranslation()
  const defaultProjectProps = useSelector(
    ({app: {defaultProjectProps = undefined}}: RootState): bayes.bob.Project|undefined =>
      defaultProjectProps,
  )
  const [isCompanyCreationShown, setIsCompanyCreationShown] = useState(false)
  const [isReorientationShown, setIsReorientationShown] = useState(false)
  const hideCompanyCreation = useCallback((): void => setIsCompanyCreationShown(false), [])
  const hideReorientation = useCallback((): void => setIsReorientationShown(false), [])

  const [isCityCommentRead, setIsCityCommentRead] = useState(!!city)
  const [isJobCommentRead, setIsJobCommentRead] = useState(!!targetJob)
  const [isJobUnknown, setIsJobUnknown] = useState(!targetJob && !!hasClearProject)
  const [isValidated, setIsValidated] = useState(false)

  const [freshProject] = useState((): bayes.bob.Project|undefined => {
    if (!defaultProjectProps) {
      return
    }
    const fieldsToKeep = (Object.keys(newProject) as readonly (keyof bayes.bob.Project)[]).
      filter((k: keyof bayes.bob.Project): boolean => !!newProject[k])
    _omit(defaultProjectProps, fieldsToKeep)
  })
  useEffect((): void => {
    if (!freshProject) {
      return
    }
    dispatch(diagnoseOnboarding({projects: [freshProject]}))
  }, [dispatch, freshProject])

  const jobSuggestRef = useRef<Focusable>(null)

  const isJobReallyUnknown = isJobUnknown
  const isFormValid = !!(
    kind && (targetJob || isJobReallyUnknown) && city && areaType &&
    (passionateLevel || isJobReallyUnknown)
  )

  const handleSubmit = useCallback((): void => {
    setIsValidated(true)
    if (!isFormValid) {
      return
    }
    if (kind === 'CREATE_OR_TAKE_OVER_COMPANY' && !isCompanyCreationShown) {
      setIsCompanyCreationShown(true)
      return
    }
    if (kind === 'REORIENTATION' && !isReorientationShown && !isJobUnknown) {
      setIsReorientationShown(true)
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} =
      {areaType, city, hasClearProject, kind, passionateLevel, targetJob}
    onSubmit(projectDiff)
  }, [
    isFormValid, isJobUnknown, areaType, city, hasClearProject, kind, passionateLevel,
    targetJob, isCompanyCreationShown, isReorientationShown, onSubmit,
  ])

  const handleJobSuggestChange = useCallback((job: bayes.bob.Job|null): void => {
    if (!job) {
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} =
      {targetJob: job}
    if (isJobCommentRead) {
      setIsJobCommentRead(false)
    }
    projectDiff.hasClearProject = 'TRUE'
    if (targetJob?.codeOgr !== job.codeOgr) {
      Object.assign(projectDiff, resetProjectForJobChange)
    }
    dispatch(diagnoseOnboarding({projects: [projectDiff]}))
  }, [dispatch, isJobCommentRead, targetJob])

  const handleCitySuggestChange = useCallback((city: bayes.bob.FrenchCity|null): void => {
    if (!city) {
      return
    }
    if (isCityCommentRead) {
      setIsCityCommentRead(false)
    }
    dispatch(diagnoseOnboarding({projects: [{city}]}))
  }, [dispatch, isCityCommentRead])

  // TODO(cyrille): Factorize this with all project steps.
  const handleChange = useCallback(
    <K extends keyof bayes.bob.Project>(field: K, value: bayes.bob.Project[K]): void => {
      const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} =
        {[field]: value}
      if (field === 'kind' && value === 'CREATE_OR_TAKE_OVER_COMPANY' && !areaType) {
        // Set the area type by default as we don't ask for it for this kind.
        projectDiff.areaType = 'CITY'
      }
      dispatch(diagnoseOnboarding({projects: [projectDiff]}))
    }, [areaType, dispatch])

  const handleChangeAreaType = useCallback(
    (value: bayes.bob.AreaType): void => handleChange('areaType', value),
    [handleChange],
  )
  const handleChangeKind = useCallback(
    (value: bayes.bob.ProjectKind): void => handleChange('kind', value),
    [handleChange],
  )
  const handleChangePassionateLevel = useCallback(
    (value: bayes.bob.PassionateLevel): void => handleChange('passionateLevel', value),
    [handleChange],
  )

  // TODO(cyrille): Harmonize this amongst different steps.
  const readCityComment = useCallback((): void => setIsCityCommentRead(true), [])
  const readJobComment = useCallback((): void => setIsJobCommentRead(true), [])

  const handleChangeJobUnknown = useCallback((): void => {
    setIsJobUnknown(!isJobUnknown)
    if (isJobUnknown) {
      jobSuggestRef.current?.focus()
    }
    dispatch(diagnoseOnboarding({projects: [{
      hasClearProject: isJobUnknown ? undefined : 'FALSE',
      ...resetProjectForJobChange,
      targetJob: undefined,
    }]}))
  }, [dispatch, isJobUnknown])

  const fastForward = useCallback((): void => {
    if (isFormValid) {
      handleSubmit()
      return
    }
    const projectDiff: {-readonly [K in keyof bayes.bob.Project]?: bayes.bob.Project[K]} = {}
    if (!kind) {
      projectDiff.kind = userExample.projects[0].kind
    }
    if (!isJobUnknown) {
      if (!targetJob) {
        projectDiff.targetJob = userExample.projects[0].targetJob
        Object.assign(projectDiff, resetProjectForJobChange)
      }
      if (!passionateLevel) {
        projectDiff.passionateLevel = userExample.projects[0].passionateLevel
      }
    }
    if (!city) {
      projectDiff.city = userExample.projects[0].city
    }
    projectDiff.hasClearProject = isJobUnknown ? 'FALSE' : 'TRUE'
    if (!areaType) {
      projectDiff.areaType = userExample.projects[0].areaType
    }
    setIsCityCommentRead(true)
    setIsJobCommentRead(true)
    dispatch(diagnoseOnboarding({projects: [projectDiff]}))
  }, [
    dispatch, areaType, city, handleSubmit, isFormValid, isJobUnknown, kind, passionateLevel,
    targetJob,
  ])

  // TODO(pascal): Move out as a separate component.
  const renderTool = ({description, from, logo, name, url}: Tool): React.ReactNode => {
    const containerStyle = {
      border: `solid 1px ${colors.SILVER}`,
      borderRadius: 4,
      display: 'flex',
      marginBottom: 20,
    }
    const logoContainerStyle = {
      alignItems: 'center',
      borderRight: `solid 1px ${colors.SILVER}`,
      display: 'flex',
      padding: 15,
    }
    return <div style={containerStyle} key={name}>
      <div style={logoContainerStyle}>
        <img src={logo} alt="" style={{width: 50}} />
      </div>
      <div style={{flex: 1, padding: 20}}>
        <strong>{name}</strong>
        <div>{description(t)}</div>
        <div style={{color: colors.WARM_GREY, fontStyle: 'italic'}}>
          {from}
        </div>
        <div style={{marginTop: 10}}>
          <ExternalLink href={url}>{t('Accéder au site')}</ExternalLink>
        </div>
      </div>
    </div>
  }

  // TODO(pascal): Move out as a separate component.
  const renderUnsupportedProjectKind =
  ({description = undefined, title, tools}: CreationArgs, hide: () => void): React.ReactElement => {
    return <Step
      {...props} title={title(t)}
      fastForward={fastForward} progressInStep={.9}
      onNextButtonClick={isFormValid ? handleSubmit : undefined}
      onPreviousButtonClick={hide}>

      <div style={{fontSize: 14}}>
        <div>
          <Trans parent="span">
            {{productName: config.productName}} se concentre aujourd'hui surtout sur la reprise d'un
            emploi.</Trans><br />
          {description ? <React.Fragment><span>{description(t)}</span><br /></React.Fragment> :
            null}
          <Trans parent="span">
            Nous travaillons dur pour améliorer nos fonctionnalités, mais
            en attendant voici quelques ressources gratuites qui pourraient vous être utiles&nbsp;!
          </Trans>
        </div>

        <div style={{marginTop: 30}}>
          {tools.map(renderTool)}
        </div>

        <div style={{alignItems: 'center', display: 'flex'}}>
          <div style={{backgroundColor: colors.MODAL_PROJECT_GREY, flex: 1, height: 1}} />
          <Trans style={{fontWeight: 500, margin: 20}}>
            ou
          </Trans>
          <div style={{backgroundColor: colors.MODAL_PROJECT_GREY, flex: 1, height: 1}} />
        </div>

        {targetJob ? <Trans>
          Continuez pour voir nos autres conseils pour le métier
          {' '}{{ofJobName: ofJobName(lowerFirstLetter(genderizeJob(targetJob, gender)), t)}}.
        </Trans> : <Trans>Continuez pour voir nos autres conseils.</Trans>}
      </div>
    </Step>
  }

  const whichJobQuestion = ((): React.ReactNode => {
    switch (kind) {
      case 'CREATE_OR_TAKE_OVER_COMPANY':
        return t('Quel métier représente le plus votre expertise\u00A0?')
      case 'REORIENTATION':
        return t('Vers quel métier aimeriez-vous vous reconvertir\u00A0?')
      default:
        return t('Quel est le poste que vous recherchez\u00A0?')
    }
  })()

  const whichCityQuestion = (kind === 'CREATE_OR_TAKE_OVER_COMPANY') ?
    t('Où voulez-vous créer ou reprendre une entreprise\u00A0?') :
    t('Autour de quelle ville cherchez-vous\u00A0?')

  const airtableLink = useMemo(() => i18n.language === 'en' ?
    'https://airtable.com/shrWOxkYASM8mtttA' : 'https://airtable.com/shreUw3GYqAwVAA27',
  [i18n.language])

  if (isCompanyCreationShown) {
    return renderUnsupportedProjectKind(_CREATION_ARGS, hideCompanyCreation)
  }

  const {departementId = ''} = city || {}
  if (isReorientationShown) {
    return renderUnsupportedProjectKind({
      ..._REORIENTATION_ARGS,
      ...hasHandicap && {
        description: (t: TFunction): string =>
          t('Rentrer dans une période de reconversion suite à un accident ' +
            'ou un problème de santé a des enjeux importants.'),
        tools: [
          ...getHandicapSpecificTools(departementId),
          ..._REORIENTATION_TOOLS,
        ],
      },
    }, hideReorientation)
  }
  // Keep in sync with 'isValid' from fieldsets below.
  const checks = [
    kind,
    (targetJob && isJobCommentRead) || isJobUnknown,
    passionateLevel || isJobUnknown,
    city && isCityCommentRead,
    areaType,
  ]
  return <Step
    title={t('Votre projet')}
    {...props} fastForward={fastForward}
    progressInStep={checks.filter((c): boolean => !!c).length / (checks.length + 1)}
    onNextButtonClick={isFormValid ? handleSubmit : undefined}>
    <FieldSet label={t('Quel est votre projet\u00A0:')}
      isValid={!!kind} isValidated={isValidated} hasCheck={true}>
      <Select
        value={kind} options={localizeOptions(t, PROJECT_KIND_OPTIONS)}
        onChange={handleChangeKind}
        placeholder={t('choisissez un type de projet')} />
    </FieldSet>
    {checks[0] ? <React.Fragment>
      {/* TODO(cyrille): Find a way to avoid note + comment. */}
      <WithNote
        hasComment={true}
        note={<Trans parent={null}>
          Vous ne trouvez pas votre métier&nbsp;?
          <ExternalLink style={{color: colors.BOB_BLUE, fontSize: 15, marginLeft: 3}}
            href={airtableLink}>
            Cliquez ici pour l'ajouter
          </ExternalLink>
        </Trans>}>
        <FieldSet
          label={whichJobQuestion}
          isValid={!!targetJob || isJobUnknown}
          isValidated={isValidated}
          hasCheck={true}
          hasNoteOrComment={true}>
          <JobSuggest
            placeholder={isJobUnknown ?
              t('décochez la case ci-dessous pour entrer un métier') : t('entrez votre métier')}
            value={targetJob} textValue={isJobUnknown ? '' : undefined}
            onChange={handleJobSuggestChange}
            gender={gender}
            disabled={isJobUnknown}
            style={{padding: 1, ...Styles.INPUT}} ref={jobSuggestRef} />
        </FieldSet>
      </WithNote>
      <LabeledToggle
        type="checkbox" isSelected={isJobUnknown} onClick={handleChangeJobUnknown}
        label={t('Je ne sais pas quel métier faire')}
        style={isJobUnknown ? jobUnknownStyle : undefined} />
      {isJobUnknown ? null :
        <OnboardingComment key={targetJob && targetJob.codeOgr || ''}
          onDone={readJobComment}
          field="TARGET_JOB_FIELD" shouldShowAfter={!!targetJob} />}
    </React.Fragment> : null}
    {checks.slice(0, 2).every((c): boolean => !!c) && !isJobUnknown ?
      <FieldSet label={t('Que représente ce travail pour vous\u00A0?')}
        isValid={!!passionateLevel} isValidated={isValidated} hasCheck={true}>
        <Select value={passionateLevel} options={localizeOptions(t, PROJECT_PASSIONATE_OPTIONS)}
          onChange={handleChangePassionateLevel}
          placeholder={t('choisissez une proposition')} />
      </FieldSet> : null}
    {checks.slice(0, 3).every((c): boolean => !!c) ? <React.Fragment>
      <FieldSet
        label={whichCityQuestion}
        isValid={!!city}
        isValidated={isValidated}
        hasNoteOrComment={true}
        hasCheck={true}>
        <CitySuggest
          onChange={handleCitySuggestChange}
          style={{padding: 1, ...Styles.INPUT}}
          value={city}
          placeholder={t('entrez votre ville ou votre code postal')} />
      </FieldSet>
      <OnboardingComment key={city && city.cityId}
        onDone={readCityComment}
        field="CITY_FIELD" shouldShowAfter={!!city} />
    </React.Fragment> : null}
    {checks.slice(0, 4).every((c): boolean => !!c) && kind !== 'CREATE_OR_TAKE_OVER_COMPANY' ?
      <FieldSet
        label={t("Jusqu'où êtes-vous prêt·e à vous déplacer\u00A0?", {context: gender})}
        isValid={!!areaType}
        isValidated={isValidated} hasCheck={true}>
        <Select
          options={localizeOptions(t, PROJECT_LOCATION_AREA_TYPE_OPTIONS)} value={areaType}
          onChange={handleChangeAreaType}
          placeholder={t(
            'choisissez une zone où vous êtes prêt·e à vous déplacer', {context: gender})} />
      </FieldSet> : null}
  </Step>
}
NewProjectGoalStepBase.propTypes = {
  newProject: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  profile: PropTypes.object,
}
const NewProjectGoalStep = React.memo(NewProjectGoalStepBase)


export {NewProjectGoalStep}
