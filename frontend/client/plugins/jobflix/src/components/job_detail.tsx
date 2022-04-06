import _uniqueId from 'lodash/uniqueId'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import HeartOutlineIcon from 'mdi-react/HeartOutlineIcon'
import InformationOutlineIcon from 'mdi-react/InformationOutlineIcon'
import TrashCanOutlineIcon from 'mdi-react/TrashCanOutlineIcon'
import type {TFunction} from 'i18next'
import React, {useCallback, useMemo, useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import useCachedData from 'hooks/cached_data'
import type {RootState} from 'store/actions'
import {toLocaleString} from 'store/i18n'
import {getMostlyRequiredDiploma} from 'store/job'
import isMobileVersion from 'store/mobile'
import {convertToUnit, getSalaryText} from 'store/project'
import {useAsynceffect} from 'store/promise'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import LinkButton from 'components/link_button'
import JobGroupCoverImage from 'components/job_group_cover_image'
import createTrainingLink from 'plugin/deployment/training_link'

import type {DispatchAllUpskillingActions} from '../store/actions'
import {
  exploreUpskillingJob, exploreUpskillingTrainings, getLaborStats, openCoachingModal,
  selectUpskillingJob, showMoreInfo, openSelectModal, applyToOpenClassRooms,
} from '../store/actions'
import MetricsDetail from './metrics_detail'
import Modal from './modal'
import PrepApprentissageSection from './ocr_details'
import {horizontalPagePadding} from './padding'
import useCoaching from '../hooks/features'

const coachingTypeContext = {context: config.coachingType}

interface CPFCity {
  codePostal: string
  // TODO(cyrille): Consider adding this too.
  codeInsee?: string
  coordonnee?: {latitude: number; longitude: number}
  nom?: string
}
interface CPFParams {
  city?: CPFCity
}
const createCPFLink = (search: string, {city}: CPFParams = {}): string =>
  `https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/results?q=${encodeURIComponent(JSON.stringify({
    debutPagination: 1,
    distance: 500,
    nombreOccurrence: 10,
    ou: {
      eligibleCpf: true,
      modality: city ? 'EN_CENTRE_MIXTE' : 'A_DISTANCE',
      type: 'CP',
      ville: city || null,
    },
    quoi: search,
    sort: 'SCORE',
  }))}&utm_source=jobflix`

const modalStyle: React.CSSProperties = {
  backgroundColor: colors.JOB_MODAL_BACKGROUND,
  marginTop: 40,
  maxWidth: 1100,
  padding: 32,
}
const descriptionStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 50,
}
const descriptionTextStyle: React.CSSProperties = {
  color: colors.METRICS_SUBTITLE,
  flex: 1,
  fontSize: 15,
  maxWidth: 470,
  paddingRight: isMobileVersion ? 0 : 60,
}
const sectionTitleStyle: React.CSSProperties = {
  color: colors.TEXT,
  fontFamily: config.titleFont || config.font,
  fontSize: isMobileVersion ? 16 : 20,
  margin: '0 0 25px',
}
const firstPStyle: React.CSSProperties = {
  marginTop: 0,
}
const lastPStyle: React.CSSProperties = {
  marginBottom: 0,
}
const mobileSidePadding = 25
const coverImageStyle: React.CSSProperties = {
  overflow: 'hidden',
  position: 'relative',
  zIndex: 0,
  ...isMobileVersion ? {
    borderRadius: 0,
    height: 200,
    margin: `0px -${mobileSidePadding}px 20px`,
    width: `calc(100% + ${mobileSidePadding * 2}px)`,
  } : {
    borderRadius: 5,
    maxHeight: 180,
    maxWidth: 470,
    width: 469,
  },
}
const metricsStyle: React.CSSProperties = {
  backgroundColor: colors.METRICS_BACKGROUND,
  borderRadius: 5,
  ...isMobileVersion && {
    flexDirection: 'column',
    padding: 12,
  },
}
const metricsTitleStyle: React.CSSProperties = {
  color: colors.METRICS_SUBTITLE,
  fontSize: isMobileVersion ? 12 : 14,
}
const metricsValueStyle: React.CSSProperties = {
  color: colors.TEXT,
  fontSize: 20,
  fontWeight: 'bold',
}
const modalTitleStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.TEXT,
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 45,
}

function renderSalary(salary: number): string {
  const roundSalary = Math.round(salary / 10) * 10
  if (config.isCurrencySignPrefixed) {
    return `${config.currencySign}\u00A0${toLocaleString(roundSalary)}`
  }
  return `${toLocaleString(roundSalary)}\u00A0${config.currencySign}`
}

function renderSalaries(
  minSalary: number, medianSalary: number, maxSalary: number, translate: TFunction): string {
  if (config.showSalaryFork && minSalary && maxSalary) {
    return translate(
      '{{min}} - {{max}}', {max: renderSalary(maxSalary), min: renderSalary(minSalary)})
  }
  const t = translate
  if (minSalary) {
    return t('à partir de {{salary}}', {salary: renderSalary(minSalary)})
  }
  if (medianSalary) {
    return t(' autour de {{salary}}', {salary: renderSalary(medianSalary)})
  }
  if (maxSalary) {
    return t("jusqu'à {{salary}}", {salary: renderSalary(maxSalary)})
  }
  return ''
}

const trainingRightMargin = 4
const baseSaveButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.JOB_CTA_ADD_TO_FAVORITES_BACKGROUND,
  border: `1px solid ${colors.PINKISH_GREY_TWO}`,
  boxShadow: 'none',
  color: colors.JOB_CTA_ADD_TO_FAVORITES_TEXT,
  display: 'flex',
  fontSize: 14,
  fontWeight: 'bold',
  margin: 0,
  padding: isMobileVersion ? 8 : 10,
  textShadow: 'none',
  ...config.isJobRounded ? {borderRadius: 100} : {},
}
const saveButtonMobileStyle: React.CSSProperties = {
  ...baseSaveButtonStyle,
  margin: '20px auto 0',
}
const coachingButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.COACHING_BUTTON_BACKGROUND,
  border: `1px solid ${colors.COACHING_BUTTON_BORDER}`,
  boxShadow: 'none',
  color: '#000',
  display: 'flex',
  fontSize: isMobileVersion ? 14 : 16,
  fontWeight: 'bold',
  margin: 0,
  padding: isMobileVersion ? '7px 12px' : '12px 20px',
}
const JobDetailModalBase = (
  {setIsJobModalOpen}: {setIsJobModalOpen: (isJobModalOpen: boolean) => void}):
React.ReactElement|null => {
  const [{jobGroup: {romeId = ''} = {}} = {}, sectionId = ''] = useSelector(
    ({app: {upskillingJobExplored}}: RootState) => upskillingJobExplored) || []
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const closeJobExploration = useCallback(
    () => dispatch(exploreUpskillingJob()), [dispatch])
  const isShown = !!sectionId && !!romeId
  useEffect(() => {
    setIsJobModalOpen(isShown)
  }, [isShown, setIsJobModalOpen])
  const titleId = useMemo(_uniqueId, [])
  return <Modal
    isShown={isShown} style={modalStyle} onClose={closeJobExploration}
    aria-labelledby={titleId}>
    <JobDetail romeId={romeId} sectionId={sectionId} isShownInModal={isShown} titleId={titleId} />
  </Modal>
}
const JobDetailModal = React.memo(JobDetailModalBase)

interface MetricsCardProps {
  emoji: string
  metric: string
  style?: React.CSSProperties
  title: React.ReactNode
}

const MetricsCardBase = (props: MetricsCardProps): React.ReactElement|null => {
  const {emoji, metric, style, title} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'column-reverse',
    ...style,
    ...metricsStyle,
  }), [style])
  return <MetricsDetail style={containerStyle}>
    <div style={metricsTitleStyle}>{title}</div>
    <div style={metricsValueStyle}>
      <span aria-hidden={true}>{emoji}</span> {metric}
    </div>
  </MetricsDetail>
}
const MetricsCard = React.memo(MetricsCardBase)

interface SalaryProps {
  children: string
  salary: bayes.bob.SalaryEstimation
}
const SalaryCardBase = ({children, salary}: SalaryProps) => {
  const [t] = useTranslation()
  const [translate] = useTranslation('translation')
  const preferredUnit = useSelector(
    ({user: {profile: {preferredSalaryUnit} = {}}}: RootState) =>
      !preferredSalaryUnit || preferredSalaryUnit === 'UNKNOWN_SALARY_UNIT' ? 'MONTHLY_NET_SALARY' :
        preferredSalaryUnit)
  const {minSalary = 0, medianSalary = 0, maxSalary = 0, unit} = convertToUnit(
    salary, preferredUnit)
  const salaryText = renderSalaries(minSalary, medianSalary, maxSalary, t)
  if (!salaryText) {
    return null
  }
  const unitText = unit && unit !== 'UNKNOWN_SALARY_UNIT' ?
    ` (${getSalaryText(unit, translate)})` : ''
  return <MetricsCard title={`${children}${unitText}`} metric={salaryText} emoji="💰" />
}
const SalaryCard = React.memo(SalaryCardBase)

interface TrainingCountsProps {
  city: bayes.bob.FrenchCity
  groupName: string
  localTrainingCount: number
  romeId: string
  trainingCount: bayes.bob.TrainingCount
}
const TrainingCountsBase = (props: TrainingCountsProps): React.ReactElement|null => {
  const {city, groupName, localTrainingCount, romeId, trainingCount} = props
  const {t} = useTranslation()
  if (!romeId) {
    return null
  }
  const {
    onlineTrainings = 0,
    openTrainings = 0,
    shortTrainings = 0,
    veryShortTrainings = 0,
  } = trainingCount
  const {departementId: areaId, latitude, longitude, name: areaName} = city
  const areaPostalCode = areaId && `${areaId}000` || ''
  const cpfLink = createCPFLink(groupName, {
    city: {
      codePostal: areaPostalCode,
      coordonnee: latitude && longitude && {latitude, longitude} || undefined,
      nom: areaName,
    },
  })
  const cpfOnlineLink = createCPFLink(groupName)
  return <React.Fragment><div />
    <TrainingCount
      title={t('Express')}
      subtitle={t('- de 1 mois')} count={veryShortTrainings} link={cpfLink} />
    <TrainingCount
      title={t('Courtes')}
      subtitle={t('entre 1 et 6 mois')} count={shortTrainings} link={cpfLink} />
    <TrainingCount
      title={t('Sans diplôme requis')}
      count={openTrainings} link={cpfLink} />
    <TrainingCount
      title={t('Accessibles en ligne')}
      count={onlineTrainings} link={cpfOnlineLink} />
    <TrainingCount
      title={t('Dans votre département')}
      count={localTrainingCount} link={cpfLink} />
    <div />
  </React.Fragment>
}

const TrainingCounts = React.memo(TrainingCountsBase)


interface TrainingCountSectionProps {
  city: bayes.bob.FrenchCity
  groupName: string
  isFullDescriptionshown: boolean
  localTrainingCount: number
  romeId: string
  trainingsContainerStyle: React.CSSProperties
  trainingCount: bayes.bob.TrainingCount
}
const TrainingCountSectionBase = (props: TrainingCountSectionProps): React.ReactElement => {
  const {city, groupName, isFullDescriptionshown, localTrainingCount, romeId,
    trainingsContainerStyle, trainingCount} = props
  const {t} = useTranslation()
  return <section>
    <h2 style={{...sectionTitleStyle, marginTop: isFullDescriptionshown ? 35 : 50}}>
      {t("Les formations qui permettent d'accéder à ce métier")}
    </h2>
    <div style={trainingsContainerStyle}>
      <TrainingCounts
        groupName={groupName} localTrainingCount={localTrainingCount} romeId={romeId}
        trainingCount={trainingCount} city={city} />
    </div>
  </section>
}

const TrainingCountSection = React.memo(TrainingCountSectionBase)

const buttonViaCompetencesStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.NAVIGATION_BUTTON_BACKGROUND,
  display: 'flex',
  fontSize: 16,
  margin: '32px 8px 0 0px',
  padding: '13px 25px',
  textDecoration: 'none',
  ...isMobileVersion && {
    fontSize: 12,
    height: 35,
    margin: '20px auto',
    padding: '7px 12px',
  },
}
const iconStyle: React.CSSProperties = {
  marginRight: 10,
}

interface TrainingLinkOnlyProps {
  city: bayes.bob.FrenchCity
  job: ValidUpskillingJob
}
const TrainingLinkOnlyBase = ({city, job}: TrainingLinkOnlyProps):
React.ReactElement|null => {
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const onExplore = useCallback(() => {
    dispatch(exploreUpskillingTrainings('unique'))
  }, [dispatch])

  const [trainingLink, setTrainingLink] = useState('')
  useAsynceffect(async (checkIfCanceled) => {
    if (!job) {
      return
    }
    const link = await createTrainingLink(job, city)
    if (!checkIfCanceled()) {
      setTrainingLink(link)
    }
  }, [city, job])

  if (!job) {
    return null
  }

  return <div style={{display: 'flex'}}>
    <LinkButton
      onClick={onExplore} href={trainingLink} type="validation" isNarrow={true}
      style={buttonViaCompetencesStyle}>
      <InformationOutlineIcon style={iconStyle} aria-hidden={true} focusable={false} /> {t(
        'Voir les formations pour ce métier',
      )}
    </LinkButton></div>
}

const TrainingLinkOnly = React.memo(TrainingLinkOnlyBase)

const readMoreLinkStyle: RadiumCSSProperties = {
  ':active': {
    textDecoration: 'none',
  },
  ':hover': {
    textDecoration: 'none',
  },
  'color': 'inherit',
}
const MoreInfoLinkBase = ({romeId}: {romeId: string}): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const moreLink = translate(config.jobMoreInfoUrl, {romeId})
  return <ExternalLink href={moreLink} style={readMoreLinkStyle}>
    {t('En savoir plus')}
  </ExternalLink>
}
const MoreInfoLink = React.memo(MoreInfoLinkBase)

const offersLinkStyle: RadiumCSSProperties = {
  ':active': {
    textDecoration: 'none',
  },
  ':hover': {
    textDecoration: 'none',
  },
  'color': '#000',
  'display': 'block',
  'fontWeight': 'bold',
  'marginTop': 20,
}
const OffersLinkBase = ({romeId}: {romeId: string}): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const moreLink = translate(config.jobOffersUrl, {romeId})
  return <ExternalLink href={moreLink} style={offersLinkStyle}>
    {t("Voir les offres d'emploi")}
  </ExternalLink>
}
const OffersLink = React.memo(OffersLinkBase)

interface JobDetailProps {
  isShownInModal?: boolean
  romeId?: string
  sectionId: string
  titleId?: string
}

const coachingContainerStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND,
  border: `1px solid ${colors.COACHING_BLOCK_BORDER}`,
  borderRadius: 10,
  marginTop: 20,
  padding: 30,
  textAlign: 'center',
}
const notCoachedContainerStyle: React.CSSProperties = {
  ...coachingContainerStyle,
  alignItems: 'center',
  border: `1px solid ${colors.COACHING_BLOCK_BORDER}`,
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'row',
  justifyContent: 'space-between',
  padding: isMobileVersion ? 25 : '24px 40px',
  textAlign: 'left',
}
const coachingTitleStyle: React.CSSProperties = {
  color: colors.TEXT,
  fontSize: isMobileVersion ? 16 : 20,
  fontWeight: 'bold',
  marginBottom: 8,
  marginTop: 0,
}

const coachingTextStyle: React.CSSProperties = {
  fontSize: 14,
  margin: isMobileVersion ? '0 0 12px' : 0,
}

const headerCTAOCRStyle: React.CSSProperties = {
  fontWeight: 'bold',
  ...isMobileVersion ? {marginTop: 30, width: '100%'} : {maxWidth: 320},
}

const jobTitleStyle: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: isMobileVersion ? 20 : 24,
  margin: 0,
}

const JobDetailBase = (props: JobDetailProps): React.ReactElement|null => {
  const {isShownInModal, romeId = '', sectionId, titleId} = props
  // See frontend/client/plugins/jobflix/src/open_classrooms.json5
  // TODO(cyrille): Find a cleaner way to do this.
  const isOCR = config.hasOCR && romeId.startsWith('OCR')
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const fetchJobGroupAction = useMemo(() => getLaborStats(romeId), [romeId])
  const [isFullDescriptionshown, setIsFullDescriptionShown] = useState(false)
  const wasEvaluated = useSelector(({app: {upskillingEvaluatedJobs}}: RootState) =>
    upskillingEvaluatedJobs?.some(({jobGroup}) => romeId === jobGroup?.romeId))
  const descriptionRef = useRef<HTMLDivElement>(null)
  const showMoreDescription = useCallback(() => {
    setIsFullDescriptionShown(true)
    descriptionRef.current?.focus?.()
    romeId && sectionId && dispatch(showMoreInfo({jobGroup: {romeId}}, sectionId))
  }, [dispatch, romeId, sectionId])
  useEffect((): void => {
    if (!isShownInModal) {
      setIsFullDescriptionShown(false)
    }
  }, [isShownInModal])
  const numLines = 3
  const descriptionContentStyle: React.CSSProperties = {
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: isFullDescriptionshown ? 'initial' : numLines,
    color: colors.JOB_DESCRIPTION_TEXT,
    display: isFullDescriptionshown ? 'block' : '-webkit-box',
    ...isMobileVersion && {fontSize: 13},
    overflow: isFullDescriptionshown ? 'visible' : 'hidden',
  }

  const city = useSelector(({user}: RootState) => user?.projects?.[0]?.city) || {}
  const {departementId: areaId} = city

  const {data: jobGroup, data: {
    description = '',
    name: groupName = '',
    requirements: {diplomas = []} = {},
    samples: [{name = ''} = {}] = [],
    trainingCount = {},
  } = {}} = useCachedData(
    ({app: {jobGroupInfos: {[romeId]: jobGroupInfo} = {}}}) => jobGroupInfo,
    fetchJobGroupAction,
    ({jobGroupInfo}) => jobGroupInfo,
  )
  const job = useMemo((): ValidUpskillingJob => ({jobGroup: {
    ...jobGroup,
    romeId,
  }}), [jobGroup, romeId])

  const bestDiploma = getMostlyRequiredDiploma(diplomas)

  const localId = romeId && areaId && `${romeId}:${areaId}` || ''
  const {data: {
    imt: {
      juniorSalary = undefined,
      medianSalary = undefined,
      seniorSalary = undefined,
    } = {},
    trainingCount: localTrainingCount = 0,
  } = {}} = useCachedData(
    ({app: {localStats: {[localId]: localStatsForJobGroup} = {}}}) => localStatsForJobGroup,
    fetchJobGroupAction,
    ({localStats}) => localStats,
  )

  const {t} = useTranslation()
  const visualElement = 'explorer'
  const isSelected = useSelector(({app: {upskillingSelectedJobs}}: RootState) =>
    upskillingSelectedJobs?.
      some(({jobGroup}) => romeId === jobGroup?.romeId))

  const selectJob = useCallback(() => {
    if (!romeId || !sectionId) {
      return
    }
    if (isSelected || wasEvaluated) {
      dispatch(selectUpskillingJob(visualElement, job, sectionId))
      return
    }
    if (!wasEvaluated) {
      dispatch(openSelectModal(job, sectionId))
    }
  }, [dispatch, isSelected, job, romeId, sectionId, wasEvaluated])

  const isNoDegree = bestDiploma?.diploma?.level === 'NO_DEGREE'
  const metrics = [
    ...juniorSalary ? [
      <SalaryCard key="junior" salary={juniorSalary}>{t('Salaire junior')}</SalaryCard>] : [],
    ...seniorSalary ? [
      <SalaryCard key="senior" salary={seniorSalary}>{t('Salaire senior')}</SalaryCard>] : [],
    ...!juniorSalary && !seniorSalary && medianSalary ? [
      <SalaryCard key="median" salary={medianSalary}>{t('Salaire médian')}</SalaryCard>] : [],
    ...bestDiploma?.name ? [<MetricsCard
      key="diploma" emoji="📚"
      metric={isNoDegree ? t('Pas de diplôme requis') : bestDiploma.name}
      title={isNoDegree ? '\u00A0' : t('Niveau fréquemment demandé')} />] : [],
  ]
  const numMetrics = metrics.length

  const handleClick = useCallback(() => {
    dispatch(applyToOpenClassRooms(romeId, 'title'))
  }, [dispatch, romeId])

  const hasCoaching = useCoaching()
  const startCoaching = useCallback(
    () => dispatch(openCoachingModal({jobGroup: {romeId}}, sectionId, 'job-details')),
    [dispatch, romeId, sectionId],
  )
  const coachedEmail = useSelector(({app: {upskillingCoachingStarted}}: RootState) =>
    upskillingCoachingStarted?.[romeId])
  const isAlreadyCoached = !!coachedEmail

  const areMetricsScrollable = isMobileVersion && numMetrics > 1
  const metricsContainerPadding = horizontalPagePadding
  const metricsScrollableContainerStyle: React.CSSProperties = {
    display: 'flex',
    ...areMetricsScrollable && {
      margin: `0 -${metricsContainerPadding}px`,
      overflow: 'scroll',
    },
  }
  const metricsContainerStyle: React.CSSProperties = {
    columnGap: 10,
    display: areMetricsScrollable ? 'grid' : 'flex',
    flex: 1,
    gridTemplateColumns: '1fr '.repeat(numMetrics),
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  }
  const trainingsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: areMetricsScrollable ? 'initial' : 'wrap',
    justifyContent: 'space-between',
    margin: areMetricsScrollable ? `0 -${metricsContainerPadding}px` : 0,
    overflow: areMetricsScrollable ? 'scroll' : 'auto',
  }

  // TODO(sil): Update UI and wording of the CTA.
  const Icon = isSelected ? TrashCanOutlineIcon : HeartOutlineIcon
  const saveButton = <Button
    onClick={selectJob} type="navigation" aria-describedby={titleId}
    style={isMobileVersion ? saveButtonMobileStyle : baseSaveButtonStyle}>
    <Icon size={16} style={{marginRight: 5}} aria-hidden={true} focusable={false} />
    {isSelected ?
      config.isSelectedFavoriteWording ?
        t('Retirer des favoris') : t('Retirer de ma sélection') :
      config.isSelectedFavoriteWording ?
        t('Ajouter aux favoris') : t('Ajouter à ma sélection')}
  </Button>

  const OCRCandidateButton = <ExternalLink href="https://oc.cm/3q5l9dG" onClick={handleClick}>
    <Button style={headerCTAOCRStyle}>
      {t('Candidater gratuitement en 5\u00A0minutes')}
    </Button>
  </ExternalLink>
  // TODO(cyrille): Actually check if there are relevant sections instead
  // once the link generation is DRY.
  const hasTrainingCountSection = config.trainingPartner === 'cpf'
  const descriptionParagraphs = description.split('\n\n')
  const descriptionTitleId = useMemo(_uniqueId, [])

  return <React.Fragment>
    {isMobileVersion ?
      <JobGroupCoverImage romeId={romeId} style={coverImageStyle} coverOpacity={0} /> : null}
    <div>
      <div style={modalTitleStyle}>
        <h2 style={jobTitleStyle} id={titleId}>{name}</h2>
        {isMobileVersion ? null : isOCR ? OCRCandidateButton : saveButton}
      </div>
      {numMetrics ? <div style={metricsScrollableContainerStyle}>
        {areMetricsScrollable ? <div style={{minWidth: metricsContainerPadding}} /> : null}
        <ul style={metricsContainerStyle}>
          {metrics}
        </ul>
        {areMetricsScrollable ? <div style={{minWidth: metricsContainerPadding}} /> : null}
      </div> : null}
      {isMobileVersion && isOCR ? OCRCandidateButton : null}
      <section style={descriptionStyle}>
        <div style={descriptionTextStyle}>
          <h2 style={sectionTitleStyle}>{t('En quoi consiste ce métier\u00A0?')}</h2>
          <div style={descriptionContentStyle} tabIndex={-1} ref={descriptionRef}>
            {descriptionParagraphs.map((part, index) =>
              <p
                key={part}
                style={index === descriptionParagraphs.length - 1 ?
                  lastPStyle : index ? undefined : firstPStyle}>
                {part}
              </p>)}
          </div>
          {isFullDescriptionshown ? null : <button
            type="button" onClick={showMoreDescription} aria-describedby={descriptionTitleId}>
            …{' '}<span style={{fontWeight: 'bold'}}>{t('Lire plus')}</span>
          </button>}
          {isFullDescriptionshown && config.jobMoreInfoUrl ?
            <MoreInfoLink romeId={romeId} /> : null}
          {config.jobOffersUrl ? <OffersLink romeId={romeId} /> : null}
        </div>
        {isMobileVersion ? null :
          <JobGroupCoverImage romeId={romeId} style={coverImageStyle} coverOpacity={0} />}
      </section>
      {isMobileVersion && !isOCR ? saveButton : null}
      {isOCR ? <PrepApprentissageSection romeId={romeId} /> :
        hasTrainingCountSection ? <TrainingCountSection
          city={city} groupName={groupName} isFullDescriptionshown={isFullDescriptionshown}
          localTrainingCount={localTrainingCount} romeId={romeId}
          trainingsContainerStyle={trainingsContainerStyle} trainingCount={trainingCount} /> :
          <TrainingLinkOnly city={city} job={job} />}
      {hasCoaching ? <section style={notCoachedContainerStyle}>
        <div style={{maxWidth: 446}}>
          <p style={coachingTitleStyle}>
            {isAlreadyCoached ? t('Vous avez activé le coaching\u00A0!') :
              // i18next-extract-mark-context-next-line ["coach", "counselor"]
              t("Besoin d'un coach pour vous guider\u00A0?", coachingTypeContext)}
          </p>
          <p style={coachingTextStyle}>
            {isAlreadyCoached ? t(
              "Le coaching est activé pour ce métier pour l'adresse email\u00A0: " +
              '{{email}}.',
              {email: coachedEmail},
            ) :
              // i18next-extract-mark-context-next-line ["coach", "counselor"]
              t('Notre équipe vous accompagne gratuitement pour trouver le métier ' +
              'et la formation qui vous conviennent.', coachingTypeContext)
            }
          </p>
        </div>
        <Button
          type="validation" isNarrow={true} style={coachingButtonStyle}
          onClick={startCoaching}>{
            isAlreadyCoached ?
              t('Commencer un coaching à une autre adresse') :
              // i18next-extract-mark-context-next-line ["coach", "counselor"]
              t('Commencer un coaching gratuit', coachingTypeContext)
          }
        </Button>
      </section> : null}
    </div>
  </React.Fragment>
}
const JobDetail = React.memo(JobDetailBase)


interface CountProps {
  count?: number
  link: string
  subtitle?: string
  title: string
}
const countContainerStyle: React.CSSProperties = {
  backgroundColor: colors.TRAININGS_CARD_BACKGROUND,
  borderRadius: 5,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  justifyContent: 'center',
  margin: `0 ${trainingRightMargin}px 10px 0`,
  padding: '16px 8px',
  textAlign: 'center',
  width: 204,
}
const countStyle: React.CSSProperties = {
  fontSize: 40,
  margin: 8,
}
const buttonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.NAVIGATION_BUTTON_BACKGROUND,
  display: 'flex',
  fontSize: 14,
  justifyContent: 'center',
  margin: '0 auto',
  width: '100%',
  ...isMobileVersion && {
    fontSize: 12,
    height: 35,
    margin: 'auto',
    padding: '7px 12px',
  },
  ...config.isJobRounded ? {borderRadius: 100, padding: '8px 5px 8px 15px'} : {padding: 8},
}
const fakeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'transparent',
  borderRadius: 5,
  padding: '12px 0',
}
const countTextContainerStyle: React.CSSProperties = {
  color: colors.METRICS_SUBTITLE,
  flex: 1,
  fontSize: 14,
}
const countTitleStyle: React.CSSProperties = {
  color: colors.TEXT,
  fontWeight: 'bold',
  marginRight: 2,
  textTransform: 'uppercase',
}
const TrainingCountBase = (props: CountProps): React.ReactElement => {
  const {count, subtitle, title, link} = props
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const onExplore = useCallback(() => {
    dispatch(exploreUpskillingTrainings(title))
  }, [dispatch, title])
  const noTrainingText = t('Aucune pour le moment')
  const noTrainingButton = isMobileVersion ?
    <span style={{fontSize: isMobileVersion ? 12 : 16}}>{noTrainingText}</span> :
    <div style={fakeButtonStyle} aria-hidden={true}>
      <CloseIcon size={16} focusable={false} />
      <span style={{marginLeft: 5}}>{noTrainingText}</span>
    </div>
  return <div style={countContainerStyle}>
    <div style={countTextContainerStyle} aria-hidden={true}>
      <div style={{fontSize: 14, margin: 0}}>
        <span style={countTitleStyle}>
          {title}
        </span>{subtitle && ` (${subtitle})`}
      </div>
    </div>
    <p style={countStyle} aria-hidden={true}>
      {count ? toLocaleString(count) : '-'}
    </p>
    {count ? <LinkButton
      onClick={onExplore} href={link} type="validation" isNarrow={true} style={buttonStyle}
      aria-label={t(
        'Voir la formation {{trainingType}}{{typeSpecifications}}',
        {
          count,
          localeCount: toLocaleString(count),
          trainingType: title.toLowerCase(),
          typeSpecifications: subtitle ? ` (${subtitle})` : '',
        },
      )}>
      {t('Voir la formation', {count})}<ChevronRightIcon aria-hidden={true} focusable={false} />
    </LinkButton> : noTrainingButton}
  </div>
}
const TrainingCount = React.memo(TrainingCountBase)

export {JobDetailModal, JobDetail, metricsStyle, mobileSidePadding}
