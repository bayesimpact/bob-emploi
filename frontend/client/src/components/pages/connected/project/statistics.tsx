import _throttle from 'lodash/throttle'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Link} from 'react-router-dom'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, getCurrentUserLaborStats, openStatsPageAction,
  statsPageIsShown} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {localizeOptions} from 'store/i18n'
import {getIMTURL, weeklyApplicationOptions} from 'store/job'
import {getJobSearchLengthMonths} from 'store/user'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {CategoriesTrain, DiplomaRequirementsHistogram, FrenchDepartementsMap, InterviewHistogram,
  JobGroupStressBars, MostVaeDiplomaTable, StressPictorialChart,
  DoughnutChart, PassionLevelHistogram, getSearchLenghtCounts} from 'components/stats_charts'
import {Button, ExternalLink} from 'components/theme'
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
        Retour au diagnostic
      </Button>
    </Link>
  </nav>
}
const BreadCrumbs = React.memo(BreadCrumbsBase)


interface PageConnectedProps {
  gender?: bayes.bob.Gender
  highestDegree?: bayes.bob.DegreeLevel
  laborStats: bayes.bob.LaborStatsData | undefined
}

interface PageConfig {
  baseUrl: string
  project: bayes.bob.Project
}

interface PageProps extends PageConnectedProps, PageConfig {
  dispatch: DispatchAllActions
}


// TODO(cyrille): Make sure to understand when/if the data is relevant.
const RomeMobilitySectionBase: React.FC<PageProps> = (props: PageProps):
React.ReactElement|null => {
  const {project: {
    localStats = {}, localStats: {
      imt: {yearlyAvgOffersPer10Candidates: marketScore = 0} = {},
      lessStressfulJobGroups = emptyArray} = {},
    targetJob: {jobGroup = {}} = {},
  } = {}} = props
  const {t} = useTranslation()
  const header = useMemo((): string => t(
    'Concurrence sur un métier proche du vôtre',
    {count: lessStressfulJobGroups.length},
  ), [lessStressfulJobGroups, t])
  if (!marketScore || marketScore >= 7 || !lessStressfulJobGroups.length) {
    return null
  }
  return <Section header={header}>
    <JobGroupStressBars
      targetJobGroup={{jobGroup, localStats}} maxBarWidth={300}
      jobGroups={lessStressfulJobGroups} />
  </Section>
}
const RomeMobilitySection = React.memo(RomeMobilitySectionBase)


const MarketStressWaffleSectionBase: React.FC<PageProps> = (props: PageProps):
React.ReactElement|null => {
  const {
    gender, project: {localStats: {moreStressedJobseekersPercentage = undefined} = {}},
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


const MarketStressMapSectionBase: React.FC<PageProps> = (props: PageProps):
React.ReactElement|null => {
  const {
    laborStats: {jobGroupInfo: {departementScores = undefined} = {}} = {},
    project: {
      city: {departementId: selectedDepartementId = undefined} = {},
      targetJob: {jobGroup: {name: jobGroupName = ''} = {}} = {},
    },
  } = props
  const findSelectedDepartement = ({departementId}: bayes.bob.DepartementStats): boolean =>
    departementId === selectedDepartementId
  const {t} = useTranslation()
  if (!departementScores ||
    (departementScores.length < 5 && !departementScores.find(findSelectedDepartement))) {
    return null
  }
  return <Section header={t(
    'Carte de la concurrence en {{jobGroupName}}',
    {jobGroupName: lowerFirstLetter(jobGroupName)},
  )}>
    <FrenchDepartementsMap
      departements={departementScores} selectedDepartementId={selectedDepartementId} />
  </Section>
}
const MarketStressMapSection = React.memo(MarketStressMapSectionBase)


const InterviewsCountSectionBase: React.FC<PageProps> = (props: PageProps):
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


const DiplomaRequirementsSectionBase: React.FC<PageProps> = (props: PageProps):
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


const MostVaeDiplomaTableSectionBase: React.FC<PageProps> = (props: PageProps):
React.ReactElement|null => {
  const {
    highestDegree,
    project: {
      targetJob: {jobGroup = undefined} = {},
    } = {},
  } = props
  const {t} = useTranslation()
  if (highestDegree === 'LICENCE_MAITRISE' || highestDegree === 'DEA_DESS_MASTER_PHD') {
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


const ApplicationDistributionSectionBase: React.FC<PageProps> = (props: PageProps):
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


const MotivationDistributionSectionBase: React.FC<PageProps> = (props: PageProps):
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
  const searchLengthMonths = getJobSearchLengthMonths(project) || 0
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


const StatisticsPageBase: React.FC<PageProps> = (props: PageProps): React.ReactElement => {
  const {baseUrl, dispatch, gender, laborStats, project} = props
  const scroll = useScroll()
  useEffect((): void => {
    dispatch(statsPageIsShown(project))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, project.projectId])
  const hasLaborStats = !!laborStats
  useEffect((): void => {
    if (!hasLaborStats) {
      dispatch(getCurrentUserLaborStats())
    }
  }, [dispatch, hasLaborStats])
  const {t} = useTranslation()
  const handleIMTLinkClick = useCallback(() => dispatch(openStatsPageAction), [dispatch])
  const {city, diagnostic: {categoryId = '', categories = undefined} = {},
    targetJob} = project
  const pageStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: isMobileVersion ? 20 : '0 0 50px',
    position: 'relative',
  }
  const contentStyle: React.CSSProperties = {
    borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
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
  const headerText = isMobileVersion ? t('Information principale') :
    t('Statistiques pour mieux comprendre votre diagnostic')
  return <PageWithNavigationBar
    page="statistiques" onBackClick={baseUrl} isLogoShown={true} style={pageStyle}>
    {isMobileVersion ? null : <div style={scrollBarStyle} />}
    {isMobileVersion ? null : <BreadCrumbs baseUrl={baseUrl} style={{height: 50}} />}
    {isMobileVersion && categoryId ?
      <Section header={headerText}>
        <div style={{padding: 0}}>
          <BobThinksVisualCard category={categoryId} project={project} />
        </div>
      </Section> : null}
    <div style={contentStyle}>
      {categories ? <Section header={t('Facteurs pris en compte pour votre score')}>
        <CategoriesTrain hasFirstBlockerTag={true} categories={categories} gender={gender} />
      </Section> : null}
      <MarketStressWaffleSection {...props} />
      <RomeMobilitySection {...props} />
      <MarketStressMapSection {...props} />
      <InterviewsCountSection {...props} />
      <DiplomaRequirementsSection {...props} />
      <MostVaeDiplomaTableSection {...props} />
      <ApplicationDistributionSection {...props} />
      <MotivationDistributionSection {...props} />
    </div>
    <section style={{marginTop: 50, textAlign: 'center'}}>
      <ExternalLink
        onClick={handleIMTLinkClick}
        href={getIMTURL(targetJob, city)} style={{textDecoration: 'none'}}>
        <Button type="discreet" isRound={true} isNarrow={true} style={imtLinkStyle}>
          {t("Accéder à plus d'informations sur le marché du travail")}
          <ChevronRightIcon size={18} style={{marginRight: -7}} />
        </Button>
      </ExternalLink>
      <div style={{fontSize: 11, fontStyle: 'italic', marginTop: 8}}>
        {t('Vous allez être redirigé·e vers un site de Pôle emploi', {context: gender})}
      </div>
    </section>
  </PageWithNavigationBar>
}
const StatisticsPage = connect(
  ({app: {laborStats = {}}, user}: RootState, {project: {projectId}}: PageConfig):
  PageConnectedProps => ({
    gender: user.profile ? user.profile.gender : undefined,
    highestDegree: user.profile ? user.profile.highestDegree : undefined,
    laborStats: projectId && laborStats[projectId] || undefined,
  }),
)(React.memo(StatisticsPageBase))


export {StatisticsPage, RomeMobilitySection}
