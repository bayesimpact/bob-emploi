import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import CloseIcon from 'mdi-react/CloseIcon'
import React, {useCallback, useMemo, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'

import useCachedData from 'hooks/cached_data'
import {RootState, getLaborStats} from 'store/actions'
import {toLocaleString} from 'store/i18n'
import {getMostlyRequiredDiploma, genderizeJob} from 'store/job'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import JobGroupCoverImage from 'components/job_group_cover_image'

import {DispatchAllUpskillingActions, exploreUpskillingJob, exploreUpskillingTrainings,
  selectUpskillingJob, showMoreInfo} from '../store/actions'
import Modal from './modal'

const createCPFLink = (search: string, queryParams?: Record<string, unknown>): string =>
  `https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/results?q=${encodeURIComponent(JSON.stringify({
    debutPagination: 1,
    distance: 500,
    nombreOccurrence: 10,
    ou: {
      eligibleCpf: true,
      modality: queryParams ? 'EN_CENTRE_MIXTE' : 'A_DISTANCE',
      type: 'CP',
      ville: queryParams?.city ? queryParams.city : null,
    },
    quoi: search,
    sort: 'SCORE',
  }))}`

const modalStyle: React.CSSProperties = {
  marginTop: 40,
  maxWidth: '83vw',
}
const descriptionStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 50,
}
const descriptionTextStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 15,
  maxWidth: 470,
  paddingRight: isMobileVersion ? 0 : 60,
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  margin: '0 0 25px',
}
const descriptionTextParagraphStyle: React.CSSProperties = {
  color: colors.PINKISH_GREY_TWO,
  display: 'inline-block',
}
const coverImageStyle: React.CSSProperties = {
  borderRadius: 5,
  maxHeight: 180,
  maxWidth: 470,
  overflow: 'hidden',
  position: 'relative',
  width: 469,
  zIndex: 0,
  ...isMobileVersion && {
    borderRadius: 0,
    height: 160,
    marginBottom: 20,
    width: '100%',
  },
}
const metricsStyle: React.CSSProperties = {
  backgroundColor: colors.PURPLE_BROWN_TWO,
  color: '#fff',
  padding: 35,
  textAlign: 'center',
  width: '32%',
  ...isMobileVersion && {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 245,
    padding: 25,
    width: '100%',
  },
}
const metricsTitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 13 : 16,
  textTransform: 'uppercase',
}
const metricsValueStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 25 : 40,
}
const modalTitleStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 45,
}

function renderSalary(salary: number): string {
  if (config.isCurrencySignPrefixed) {
    return `${config.currencySign}\u00A0${toLocaleString(salary)}`
  }
  return `${toLocaleString(salary)}\u00A0${config.currencySign}`
}

const trainingRightMargin = 10
const trainingsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginRight: -trainingRightMargin,
}
const trainingsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
}
const saveButtonMobileStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: '#000',
  fontWeight: 'bold',
  marginTop: 20,
  width: '100%',
}
const selectedButtonStyle: React.CSSProperties = {
  ...saveButtonMobileStyle,
  backgroundColor: 'transparent',
  border: `1px solid ${colors.PINKISH_GREY_TWO}`,
  color: '#fff',
  fontWeight: 'normal',
  marginTop: 0,
  width: 'auto',
}

const JobDetailModalBase = (): React.ReactElement|null => {
  const [job = '', sectionId = ''] = useSelector(({app: {upskillingJobExplored}}: RootState) =>
    upskillingJobExplored) || []
  const {jobGroup: {romeId = ''} = {}} = job || {}
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const closeJobExploration = useCallback(
    () => dispatch(exploreUpskillingJob()), [dispatch])
  const isShown = !!sectionId && !!job
  return <Modal isShown={isShown} style={modalStyle} onClose={closeJobExploration}>
    <JobDetail sectionId={sectionId} romeId={romeId} isShownInModal={isShown} />
  </Modal>
}
const JobDetailModal = React.memo(JobDetailModalBase)

interface JobDetailProps {
  isShownInModal?: boolean
  romeId: string
  sectionId: string
}

const JobDetailBase = (props: JobDetailProps): React.ReactElement|null => {
  const {isShownInModal, romeId, sectionId} = props
  const job = useMemo(() => ({jobGroup: {romeId: romeId}}), [romeId])
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const gender = useSelector(
    ({user: {profile: {gender = undefined} = {}} = {}}: RootState) => gender)
  const fetchJobGroupAction = useMemo(() => getLaborStats(romeId), [romeId])
  const [isFullDescriptionshown, setIsFullDescriptionShown] = useState(false)
  const showMoreDescription = useCallback(() => {
    setIsFullDescriptionShown(true)
    romeId && sectionId && dispatch(showMoreInfo(job, sectionId))
  }, [dispatch, job, romeId, sectionId])

  useEffect((): void => {
    if (!isShownInModal) {
      setIsFullDescriptionShown(false)
    }
  }, [isShownInModal])
  const numLines = 3
  const descriptionContentStyle: React.CSSProperties = {
    display: 'inline-block',
    ...isMobileVersion && {fontSize: 13},
    // Content height is line-height * number of lines + paragraph margin top size.
    height: isFullDescriptionshown ? 'auto' : `${1.2 * numLines + 1}em`,
    overflow: isFullDescriptionshown ? 'visible' : 'hidden',
  }

  const areaId = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const areaName = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.name)

  const {data: {
    description = '',
    samples: [sampleJob = {}] = [],
    requirements: {diplomas = []} = {},
    trainingCount: {
      openTrainings = 0,
      shortTrainings = 0,
      veryShortTrainings = 0,
    } = {},
  } = {}} = useCachedData(
    ({app: {jobGroupInfos: {[romeId]: jobGroupInfo} = {}}}) => jobGroupInfo,
    fetchJobGroupAction,
    ({jobGroupInfo}) => jobGroupInfo,
  )

  const bestDiploma = getMostlyRequiredDiploma(diplomas)

  const localId = romeId && areaId && `${romeId}:${areaId}` || ''
  const {data: {
    imt: {
      juniorSalary: {minSalary: juniorMinSalary = '', maxSalary: juniorMaxSalary = ''} = {},
      seniorSalary: {minSalary: seniorMinSalary = '', maxSalary: seniorMaxSalary = ''} = {},
    } = {},
    trainingCount: localTrainingCount = 0,
  } = {}} = useCachedData(
    ({app: {localStats: {[localId]: localStatsForJobGroup} = {}}}) => localStatsForJobGroup,
    fetchJobGroupAction,
    ({localStats}) => localStats,
  )

  const {t} = useTranslation()
  const name = genderizeJob(sampleJob, gender)
  const isSelected = useSelector(({app: {upskillingSelectedJobs}}: RootState) =>
    upskillingSelectedJobs?.
      some(({jobGroup}) => romeId === jobGroup?.romeId))
  const saveJob = useCallback(() => {
    if (!job || !sectionId) {
      return
    }
    dispatch(selectUpskillingJob('explorer', job, sectionId))
  }, [dispatch, job, sectionId])

  const areaPostalCode = `${areaId}000`
  const cpfLink = createCPFLink(name, {
    city: {codePostal: areaPostalCode, nom: areaName},
  })

  const numMetrics = [juniorMinSalary, seniorMinSalary, bestDiploma].filter(Boolean).length

  // TODO(émilie): drop the entire metric sections if numMetrics equals 0.
  const metricsContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginRight: isMobileVersion && numMetrics > 1 ? -20 : 0,
    overflow: isMobileVersion ? 'scroll' : 'auto',
  }

  const cpfOnlineLink = createCPFLink(name)
  const saveButton = <Button
    onClick={saveJob} type="navigation"
    style={isSelected ? selectedButtonStyle : isMobileVersion ? saveButtonMobileStyle : {}}>
    {isSelected ? t('Retirer de ma liste') : t('Sauvegarder ce métier')}
  </Button>
  return <React.Fragment>
    {isMobileVersion ?
      <JobGroupCoverImage romeId={romeId} style={coverImageStyle} coverOpacity={0} /> : null}
    <div style={{padding: '0 20px'}}>
      <div style={modalTitleStyle}>
        <h2 style={{margin: 0}}>{name}</h2>
        {isMobileVersion ? null : saveButton}
      </div>
      <div style={metricsContainerStyle}>
        {juniorMaxSalary && juniorMinSalary ? <div style={metricsStyle}>
          <div style={metricsTitleStyle}>{t('💰 Salaire junior')}</div>
          <div style={metricsValueStyle}>
            {t('{{min}} - {{max}}',
              {max: renderSalary(juniorMaxSalary), min: renderSalary(juniorMinSalary)})}
          </div>
        </div> : null}
        {seniorMaxSalary && seniorMinSalary ? <div
          style={{...isMobileVersion && {margin: '0 10px'}, ...metricsStyle}}>
          <div style={metricsTitleStyle}>{t('💰 Salaire senior')}</div>
          <div style={metricsValueStyle}>
            {t('{{min}} - {{max}}',
              {max: renderSalary(seniorMaxSalary), min: renderSalary(seniorMinSalary)})}
          </div>
        </div> : null}
        {bestDiploma ? <div style={metricsStyle}>
          <div style={metricsTitleStyle}>{t('📚 Niveau fréquemment demandé')}</div>
          <div style={metricsValueStyle}>{bestDiploma.name}</div>
        </div> : null}
      </div>
      <div style={descriptionStyle}>
        <div style={descriptionTextStyle}>
          {isMobileVersion ? null :
            <h2 style={sectionTitleStyle}>{t('En quoi consiste ce métier\u00A0?')}</h2>}
          <span style={descriptionContentStyle}>
            {description.split('\n\n').map(part =>
              <p key={part} style={descriptionTextParagraphStyle}>{part}</p>)}
          </span>
          {isFullDescriptionshown ? null : <button onClick={showMoreDescription}>
            …{' '}<span style={{fontWeight: 'bold'}}>{t('Lire plus')}</span>
          </button>}
        </div>
        {isMobileVersion ? null :
          <JobGroupCoverImage romeId={romeId} style={coverImageStyle} coverOpacity={0} />}
      </div>
      {isMobileVersion ? saveButton : null}
      <section>
        <h2 style={{...sectionTitleStyle, marginTop: isFullDescriptionshown ? 35 : 50}}>
          {t('Comment accéder à ce métier\u00A0?')}
        </h2>
        <div style={trainingsStyle}>
          <div style={trainingsRowStyle}>
            <TrainingCount
              title={t('Formations express')}
              subtitle={t('- de 1 mois')} count={veryShortTrainings} link={cpfLink} />
            <TrainingCount
              title={t('Formations courtes')}
              subtitle={t('entre 1 et 6 mois')} count={shortTrainings} link={cpfLink} />
          </div>
          <div style={trainingsRowStyle}>
            <TrainingCount
              title={t('Formations sans diplôme requis')}
              count={openTrainings} link={cpfLink} />
            {/* TODO(pascal): Use real data for online trainings.*/}
            <TrainingCount
              title={t('Formations accessibles en ligne')}
              count={0} link={cpfOnlineLink} />
            <TrainingCount
              title={t('Formations dans votre département')}
              count={localTrainingCount} link={cpfLink} />
          </div>
        </div>
      </section>
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
  backgroundColor: colors.PURPLE_BROWN_TWO,
  borderRadius: 5,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  fontSize: 16,
  margin: `0 ${trainingRightMargin}px 10px 0`,
  maxHeight: 218,
  minWidth: isMobileVersion ? 150 : 327,
  padding: '25px 0px',
  textAlign: 'center',
}
const countStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 30 : 43,
  fontWeight: 'bold',
  margin: 17,
}
const buttonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.BOB_BLUE,
  display: 'flex',
  fontSize: 14,
  margin: 'auto',
  ...isMobileVersion && {
    fontSize: 12,
    height: 35,
    margin: 'auto',
    padding: '7px 12px',
  },
}
const fakeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: colors.PURPLISH_BROWN,
  borderRadius: 5,
  padding: 10,
  width: 252,
}
const countTextContainerStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 13 : 16,
  margin: `3px ${isMobileVersion ? 20 : 75}px 0px`,
}
const TrainingCountBase = (props: CountProps): React.ReactElement => {
  const {count, subtitle, title, link} = props
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const onExplore = useCallback(() => {
    dispatch(exploreUpskillingTrainings(title))
  }, [dispatch, title])
  const noTrainingText = t('Pas de formation pour le moment')
  const noTrainingButton = isMobileVersion ?
    <span style={{fontSize: isMobileVersion ? 12 : 16}}>{noTrainingText}</span> :
    <div style={fakeButtonStyle}>
      <CloseIcon size={22} />
      <span style={{marginLeft: 5}}>{noTrainingText}</span>
    </div>
  return <div style={countContainerStyle}>
    <div style={countTextContainerStyle}>
      <h4
        style={{fontSize: 'inherit', margin: 0, textTransform: 'uppercase'}}>{title}</h4>
      {subtitle && `(${subtitle})`}
    </div>
    <p style={countStyle}>
      {count ? toLocaleString(count) : '-'}
    </p>
    {count ? <ExternalLink onClick={onExplore} href={link} style={{textDecoration: 'none'}}>
      <Button type="validation" isNarrow={true} style={buttonStyle}>
        {t('Voir la formation', {count})}
        {isMobileVersion ? null : <ChevronRightIcon />}
      </Button></ExternalLink> : noTrainingButton}
  </div>
}
const TrainingCount = React.memo(TrainingCountBase)

export {JobDetailModal, JobDetail}
