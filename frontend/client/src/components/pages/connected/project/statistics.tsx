import _throttle from 'lodash/throttle'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Link} from 'react-router-dom'
import {useDispatch, useSelector} from 'react-redux'

import {DispatchAllActions, RootState, getLaborStats, openStatsPageAction,
  statsPageIsShown} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {localizeOptions} from 'store/i18n'
import {genderizeJob, getIMTURL, weeklyApplicationOptions} from 'store/job'
import isMobileVersion from 'store/mobile'
import {getSearchLenghtCounts} from 'store/statistics'
import {getJobSearchLengthMonths} from 'store/user'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import {PageWithNavigationBar} from 'components/navigation'
import AutomationRiskGauge from 'components/statistics/automation_risk_gauge'
import CountryMap from 'components/statistics/country_map'
import DiplomaRequirementsHistogram from 'components/statistics/diploma_requirements_histogram'
import DoughnutChart from 'components/statistics/doughnut_chart'
import InterviewHistogram from 'components/statistics/interview_histogram'
import JobGroupStressBars from 'components/statistics/job_groups_stress_bars'
import MainChallengesTrain from 'components/statistics/vertical_main_challenges_train'
import MostVaeDiplomaTable from 'components/statistics/most_vae_diploma_table'
import PassionLevelHistogram from 'components/statistics/passion_level_histogram'
import RelatedAutomationRisk from 'components/statistics/related_automation_risk'
import StressPictorialChart from 'components/statistics/stress_pictorial_chart'
import {BobThinksVisualCard} from './diagnostic'


const emptyArray = [] as const

interface SectionProps {
  children: ReactStylableElement
  header: React.ReactNode
  details?: React.ReactNode
}


const sectionHeaderStyle = {
  fontSize: 22,
  margin: '0 0 15px',
  padding: '0 10px',
}

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
  margin: '0 0 50px',
  maxWidth: 600,
  padding: 20,
} as const

const detailsStyle = {
  margin: '0 0 15px',
  padding: '0 10px',
}


const SectionBase: React.FC<SectionProps> =
({children, details, header}: SectionProps): React.ReactElement => {
  return <section>
    <h2 style={sectionHeaderStyle}>{header}</h2>
    {details ? <div style={detailsStyle}>{details}</div> : null}
    {React.cloneElement(children, {style: {...cardStyle, ...children.props.style}})}
  </section>
}
const Section = React.memo(SectionBase)


interface BreadCrumbsProps {
  baseUrl: string
  style: React.CSSProperties
}


const BreadCrumbsBase: React.FC<BreadCrumbsProps> = (props: BreadCrumbsProps):
React.ReactElement => {
  const {baseUrl, style} = props
  const {t} = useTranslation()
  const containerStyle: React.CSSProperties = {
    padding: 8,
    position: 'relative',
    ...style,
  }
  const backButtonStyle: React.CSSProperties = {
    border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    boxShadow: 'initial',
    color: colors.DARK_TWO,
    fontSize: 14,
    fontWeight: 'bold',
    left: 8,
    padding: '8px 15px',
    position: 'absolute',
    top: 8,
  }
  const chevronStyle: React.CSSProperties = {
    fill: colors.DARK_TWO,
    margin: '-6px 5px -6px -8px',
    verticalAlign: 'middle',
  }
  return <nav style={containerStyle}>
    <Link to={baseUrl}>
      <Button type="discreet" style={backButtonStyle}>
        <ChevronLeftIcon style={chevronStyle} />
        {t('Retour au diagnostic')}
      </Button>
    </Link>
  </nav>
}
const BreadCrumbs = React.memo(BreadCrumbsBase)


interface PageConfig {
  baseUrl: string
  project: bayes.bob.Project
}

interface PageProps extends PageConfig {
  gender?: bayes.bob.Gender
  highestDegree?: bayes.bob.DegreeLevel
  laborStats: bayes.bob.LaborStatsData | undefined
}


// TODO(cyrille): Make sure to understand when/if the data is relevant.
const RomeMobilitySectionBase = (
  props: Pick<PageProps, 'laborStats'|'project'>,
): React.ReactElement|null => {
  const {
    project: {targetJob: {jobGroup = {}} = {}} = {},
    laborStats: {
      localStats = {},
      localStats: {
        imt: {yearlyAvgOffersPer10Candidates: marketScore = 0} = {},
        lessStressfulJobGroups = emptyArray,
      } = {},
    } = {},
  } = props
  const {t} = useTranslation()
  const header = useMemo((): string => t(
    'Concurrence sur un métier proche du vôtre',
    {count: lessStressfulJobGroups.length},
  ), [lessStressfulJobGroups, t])
  const targetJobGroups = useMemo(() => [{jobGroup, localStats}], [jobGroup, localStats])
  if (!marketScore || marketScore >= 7 || !lessStressfulJobGroups.length) {
    return null
  }
  return <Section header={header}>
    <JobGroupStressBars
      targetJobGroups={targetJobGroups} maxBarWidth={300} jobGroups={lessStressfulJobGroups} />
  </Section>
}
const RomeMobilitySection = React.memo(RomeMobilitySectionBase)


const MarketStressWaffleSectionBase = (props: Pick<PageProps, 'gender'|'laborStats'>):
React.ReactElement|null => {
  const {
    gender, laborStats: {localStats: {moreStressedJobseekersPercentage = undefined} = {}} = {},
  } = props
  const {t} = useTranslation()
  const header = useMemo(
    (): string => t("Le défi de la concurrence dans votre recherche par rapport à d'autres"),
    [t],
  )
  if (!moreStressedJobseekersPercentage) {
    return null
  }
  return <Section header={header}>
    <StressPictorialChart percent={moreStressedJobseekersPercentage} gender={gender} />
  </Section>
}
const MarketStressWaffleSection = React.memo(MarketStressWaffleSectionBase)


const MarketStressMapSectionBase = (props: Pick<PageProps, 'laborStats'|'project'>):
React.ReactElement|null => {
  const {
    laborStats: {jobGroupInfo: {
      admin1AreaScores = undefined,
      departementScores = undefined,
    } = {}} = {},
    project: {
      city: {
        departementId: selectedDepartementId = undefined,
        regionId: selectedRegionId = undefined,
      } = {},
      targetJob: {jobGroup: {name: jobGroupName = ''} = {}} = {},
    },
  } = props
  const areaScores = admin1AreaScores || departementScores
  const findSelectedArea = ({areaId, departementId}: bayes.bob.DepartementStats): boolean =>
    departementId === selectedDepartementId || areaId === selectedRegionId
  const {t} = useTranslation()
  if (!config.countryMapName || !areaScores ||
    (areaScores.length < 5 && !areaScores.some(findSelectedArea))) {
    return null
  }
  return <Section header={t(
    'Carte de la concurrence en {{jobGroupName}}',
    {jobGroupName: lowerFirstLetter(jobGroupName)},
  )}>
    <CountryMap
      stats={areaScores}
      selectedAreaId={areaScores === admin1AreaScores ? selectedRegionId : selectedDepartementId} />
  </Section>
}
const MarketStressMapSection = React.memo(MarketStressMapSectionBase)


const InterviewsCountSectionBase = (props: Pick<PageProps, 'laborStats'|'project'>):
React.ReactElement|null => {
  const {
    laborStats: {
      userCounts: {
        longSearchInterviewCounts = undefined,
        mediumSearchInterviewCounts = undefined,
      } = {},
    } = {},
    project = {},
  } = props
  const jobSearchLengthMonths = getJobSearchLengthMonths(project)
  const specificInterviewCounts = (jobSearchLengthMonths < 7 ?
    mediumSearchInterviewCounts : longSearchInterviewCounts)
  const {t} = useTranslation()
  const header = useMemo(
    (): string => jobSearchLengthMonths < 7 ?
      t("Nombre d'entretiens décrochés 6 mois après le début de la recherche") :
      t("Nombre d'entretiens décrochés un an après le début de la recherche"),
    [jobSearchLengthMonths, t],
  )
  if (!specificInterviewCounts) {
    return null
  }
  return <Section header={header}>
    <InterviewHistogram
      interviewCounts={specificInterviewCounts}
      totalInterviewCount={project.totalInterviewCount || 0} />
  </Section>
}
const InterviewsCountSection = React.memo(InterviewsCountSectionBase)


const DiplomaRequirementsSectionBase = (props: Pick<PageProps, 'laborStats'|'highestDegree'>):
React.ReactElement|null => {
  const {
    laborStats: {
      jobGroupInfo: {
        requirements: {
          diplomas = undefined,
        } = {},
      } = {},
    } = {},
    highestDegree,
  } = props
  const {t} = useTranslation()
  if (!diplomas || !diplomas.length) {
    return null
  }
  return <Section header={t('Pourcentage des offres accessibles avec un diplôme')}>
    <DiplomaRequirementsHistogram highestDegree={highestDegree} requirements={diplomas} />
  </Section>
}
const DiplomaRequirementsSection = React.memo(DiplomaRequirementsSectionBase)


const MostVaeDiplomaTableSectionBase = (props: Pick<PageProps, 'highestDegree'|'project'>):
React.ReactElement|null => {
  const {
    highestDegree,
    project: {
      targetJob: {jobGroup = undefined} = {},
    } = {},
  } = props
  const {t} = useTranslation()
  if (!config.hasVAEData || highestDegree === 'LICENCE_MAITRISE' ||
    highestDegree === 'DEA_DESS_MASTER_PHD') {
    return null
  }
  return <Section
    header={t('Diplômes le plus souvent obtenus par une VAE')}
    details={<Trans parent={null}>
      La <ExternalLink href="http://www.vae.gouv.fr/vous-etes-un-particulier/vous-etes-un-particulier-qu-est-ce-que-la-vae.html">
        Validation des acquis de l'expérience
      </ExternalLink>, ou VAE, permet, sous conditions, de convertir votre expérience en
      certification.
    </Trans>}>
    <MostVaeDiplomaTable targetJobGroup={jobGroup} />
  </Section>
}
const MostVaeDiplomaTableSection = React.memo(MostVaeDiplomaTableSectionBase)


const ApplicationDistributionSectionBase = (props: Pick<PageProps, 'laborStats'|'project'>):
React.ReactElement|null => {
  const {
    laborStats: {
      userCounts: {
        weeklyApplicationCounts = undefined,
      } = {},
    } = {},
    project: {
      weeklyApplicationsEstimate = undefined,
    } = {},
  } = props
  const {t} = useTranslation()
  if (!weeklyApplicationCounts) {
    return null
  }
  return <Section header={t('Distribution du nombre de candidatures par semaine')}>
    <DoughnutChart
      counts={weeklyApplicationCounts} labels={localizeOptions(t, weeklyApplicationOptions)}
      numApplications={weeklyApplicationsEstimate} />
  </Section>
}
const ApplicationDistributionSection = React.memo(ApplicationDistributionSectionBase)


const MotivationDistributionSectionBase = (props: Pick<PageProps, 'laborStats'|'project'>):
React.ReactElement|null => {
  const {
    laborStats: {
      userCounts: {
        passionLevelCounts = undefined,
      } = {},
    } = {},
    project = {},
    project: {
      passionateLevel = undefined,
    } = {},
  } = props
  const {t} = useTranslation()
  if (!passionLevelCounts) {
    return null
  }
  const searchLengthMonths = getJobSearchLengthMonths(project)
  const searchLengthCounts = getSearchLenghtCounts(searchLengthMonths, passionLevelCounts) || []
  if (!searchLengthCounts.length) {
    return null
  }
  const motivationText = searchLengthMonths < 4 ?
    t("Expression recueillie moins de 4 mois après le début de la recherche d'emploi") :
    searchLengthMonths < 13 ?
      t("Expression recueillie entre 4 mois et 1 an après le début de la recherche d'emploi") :
      t("Expression recueillie plus d'un an après le début de la recherche d'emploi")
  return <Section
    header={t('Intérêt exprimé pour le métier recherché')}
    details={motivationText}>
    <PassionLevelHistogram counts={searchLengthCounts} passionLevel={passionateLevel} />
  </Section>
}
const MotivationDistributionSection = React.memo(MotivationDistributionSectionBase)


const AutomationRiskSectionBase = (props: Pick<PageProps, 'gender' | 'laborStats' | 'project'>):
null|React.ReactElement => {
  const {
    gender,
    laborStats: {jobGroupInfo: {automationRisk = 0} = {}} = {},
    project: {targetJob},
  } = props
  const {t} = useTranslation()
  if (!automationRisk || !targetJob) {
    return null
  }
  const jobName = lowerFirstLetter(genderizeJob(targetJob, gender))
  return <Section header={t("Risque d'automatisation du métier")}>
    <AutomationRiskGauge percent={automationRisk} jobName={jobName} />
  </Section>
}
const AutomationRiskSection = React.memo(AutomationRiskSectionBase)


const RelatedAutomationRiskSectionBase = ({laborStats = {}}: Pick<PageProps, 'laborStats'>):
null|React.ReactElement => {
  const {t} = useTranslation()
  const {jobGroupInfo, jobGroupInfo: {relatedJobGroups = emptyArray} = {}} = laborStats
  const targetJobGroups = useMemo(() => [{jobGroup: jobGroupInfo}], [jobGroupInfo])
  if (!relatedJobGroups.some(({jobGroup: {automationRisk = 0} = {}}) => automationRisk)) {
    return null
  }
  return <Section header={t("Risque d'automatisation de métiers proches")}>
    <RelatedAutomationRisk
      // TODO(cyrille): Update source once we have data for different deployments.
      areMarketScoresShown={true} source="RSA Future of Work 2017"
      jobGroups={relatedJobGroups} targetJobGroups={targetJobGroups} />
  </Section>
}
const RelatedAutomationRiskSection = React.memo(RelatedAutomationRiskSectionBase)

// A React hook to get the user's scroll percentage in the page, 0 when the window is at the top
// of the document, 1 when it's at the bottom.
const useScroll = (): number => {
  const [scroll, setScroll] = useState(0)
  useEffect((): () => void => {
    const handleScroll = _throttle((): void => {
      const maxScrollY = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight) - window.innerHeight
      setScroll(window.scrollY / Math.max(maxScrollY, window.scrollY))
    }, 20)

    window.addEventListener('scroll', handleScroll, true)
    handleScroll()

    return (): void => {
      window.removeEventListener('scroll', handleScroll, true)
      handleScroll.cancel()
    }
  }, [])
  return scroll
}


const contentStyle: React.CSSProperties = {
  margin: '50px auto',
  maxWidth: 600,
  paddingTop: 50,
}
const imtLinkStyle: React.CSSProperties = {
  alignItems: 'center',
  border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
  display: 'inline-flex',
  fontSize: 13,
  fontWeight: 'bold',
}


const StatisticsSectionsBase = ({project}: {project: bayes.bob.Project}): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const gender = useSelector(({user}: RootState) => user.profile?.gender)
  const highestDegree = useSelector(({user}: RootState) => user.profile?.highestDegree)
  const {
    city, diagnostic: {categories = undefined} = {}, localStats, projectId, targetJob,
  } = project
  const localId = `${targetJob?.jobGroup?.romeId || ''}:${city?.departementId || ''}`
  // TODO(cyrille): Consider using useCachedData.
  const additionalLaborStats = useSelector(
    ({app: {laborStats}}: RootState) => laborStats?.[localId] || undefined,
  )
  const scroll = useScroll()
  useEffect((): void => {
    if (projectId) {
      dispatch(statsPageIsShown(project))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, projectId])
  const hasLaborStats = !!additionalLaborStats
  useEffect((): void => {
    if (!hasLaborStats) {
      dispatch(getLaborStats(project))
    }
  }, [dispatch, hasLaborStats, project])
  const {t} = useTranslation()
  const handleIMTLinkClick = useCallback(() => dispatch(openStatsPageAction), [dispatch])
  const scrollBarStyle: React.CSSProperties = {
    backgroundColor: colors.BOB_BLUE,
    height: 5,
    left: 0,
    opacity: scroll > .1 ? 1 : 0,
    position: 'fixed',
    top: 0,
    transition: 'opacity 100ms',
    width: `${scroll * 100}%`,
    zIndex: 2,
  }
  const externalLmiURL = getIMTURL(t, targetJob, city)
  const laborStats = useMemo((): bayes.bob.LaborStatsData => ({
    ...localStats ? {localStats} : undefined,
    ...additionalLaborStats,
  }), [localStats, additionalLaborStats])
  return <React.Fragment>
    {isMobileVersion ? null : <div style={scrollBarStyle} />}
    <div style={contentStyle}>
      {categories ? <Section header={t('Facteurs pris en compte pour votre score')}>
        <MainChallengesTrain
          hasFirstBlockerTag={true} mainChallenges={categories} gender={gender} />
      </Section> : null}
      <MarketStressWaffleSection {...{gender, laborStats}} />
      <RomeMobilitySection {...{laborStats, project}} />
      <MarketStressMapSection {...{laborStats, project}} />
      <InterviewsCountSection {...{laborStats, project}} />
      <DiplomaRequirementsSection {...{highestDegree, laborStats}} />
      <MostVaeDiplomaTableSection {...{highestDegree, project}} />
      <ApplicationDistributionSection {...{laborStats, project}} />
      <MotivationDistributionSection {...{laborStats, project}} />
      <AutomationRiskSection {...{gender, laborStats, project}} />
      <RelatedAutomationRiskSection {...{laborStats}} />
    </div>
    {externalLmiURL ? <section style={{marginTop: 50, textAlign: 'center'}}>
      <ExternalLink
        onClick={handleIMTLinkClick}
        href={externalLmiURL} style={{textDecoration: 'none'}}>
        <Button type="discreet" isRound={true} isNarrow={true} style={imtLinkStyle}>
          {t("Accéder à plus d'informations sur le marché du travail")}
          <ChevronRightIcon size={18} style={{marginRight: -7}} />
        </Button>
      </ExternalLink>
      {config.externalLmiSiteName ? <div style={{fontSize: 11, fontStyle: 'italic', marginTop: 8}}>
        {t('Vous allez être redirigé·e vers un site de {{externalLmiSiteName}}', {
          context: gender,
          externalLmiSiteName: config.externalLmiSiteName,
        })}
      </div> : null}
    </section> : null}
  </React.Fragment>
}
const StatisticsSections = React.memo(StatisticsSectionsBase)


const pageHeaderStyle: React.CSSProperties = {
  borderBottom: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
  margin: '0 auto',
  maxWidth: 600,
  padding: '0 20px',
  textAlign: 'center',
}

const StatisticsPageBase: React.FC<PageConfig> = (props: PageConfig): React.ReactElement => {
  const {baseUrl, project} = props
  const {diagnostic: {categoryId = ''} = {}} = project
  const {t} = useTranslation()
  const pageStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: isMobileVersion ? 20 : '0 0 50px',
    position: 'relative',
  }
  const headerText = isMobileVersion ? t('Information principale') :
    t('Statistiques pour mieux comprendre votre diagnostic')
  return <PageWithNavigationBar page="statistiques" onBackClick={baseUrl} style={pageStyle}>
    {isMobileVersion ? null : <BreadCrumbs baseUrl={baseUrl} style={{height: 50}} />}
    {isMobileVersion && categoryId ?
      <Section header={headerText}>
        <div style={{padding: 0}}>
          <BobThinksVisualCard category={categoryId} project={project} />
        </div>
      </Section> : <header style={pageHeaderStyle}>
        <h1 style={{margin: 0}}>{headerText}</h1>
      </header>}
    <StatisticsSections project={project} />
  </PageWithNavigationBar>
}
const StatisticsPage = React.memo(StatisticsPageBase)


export {StatisticsPage, StatisticsSections, RomeMobilitySection}
