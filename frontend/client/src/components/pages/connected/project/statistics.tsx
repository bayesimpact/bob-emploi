import _throttle from 'lodash/throttle'
import ChevronLeftIcon from 'mdi-react/ChevronLeftIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, getCurrentUserLaborStats, openStatsPageAction,
  statsPageIsShown} from 'store/actions'
import {YouChooser, genderize, lowerFirstLetter} from 'store/french'
import {getIMTURL} from 'store/job'
import {getJobSearchLengthMonths, youForUser} from 'store/user'

import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {CategoriesTrain, FrenchDepartementsMap, InterviewHistogram, JobGroupStressBars,
  StressPictorialChart} from 'components/stats_charts'
import {Button, ExternalLink} from 'components/theme'
import {BobThinksVisualCard} from './diagnostic'


const emptyArray = [] as const

interface SectionProps {
  children: ReactStylableElement
  header: React.ReactNode
}


const SectionBase: React.FC<SectionProps> =
({children, header}: SectionProps): React.ReactElement => {
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
  return <section>
    <h2 style={sectionHeaderStyle}>{header}</h2>
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
  laborStats: bayes.bob.LaborStatsData | undefined
  userYou: YouChooser
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
  } = {}, userYou} = props
  if (!marketScore || marketScore >= 7 || !lessStressfulJobGroups.length) {
    return null
  }
  const closeJobs = lessStressfulJobGroups.length > 1 ? 'des métiers proches' : 'un métier proche'
  return <Section header={`Concurrence sur ${closeJobs} du ${userYou('tien', 'vôtre')}`}>
    <JobGroupStressBars
      targetJobGroup={{jobGroup, localStats}} maxBarWidth={300}
      userYou={userYou} jobGroups={lessStressfulJobGroups} />
  </Section>
}
const RomeMobilitySection = React.memo(RomeMobilitySectionBase)


const MarketStressWaffleSectionBase: React.FC<PageProps> = (props: PageProps):
React.ReactElement|null => {
  const {
    gender, project: {localStats: {moreStressedJobseekersPercentage = undefined} = {}}, userYou,
  } = props
  if (!moreStressedJobseekersPercentage) {
    return null
  }
  return <Section
    header={`Le défi de la concurrence dans ${userYou('ta', 'votre')} recherche
      par rapport à d'autres`}>
    <StressPictorialChart
      percent={moreStressedJobseekersPercentage}
      gender={gender} userYou={userYou} />
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
    userYou,
  } = props
  const findSelectedDepartement =
    ({departementId}): boolean => departementId === selectedDepartementId
  if (!departementScores ||
    (departementScores.length < 5 && !departementScores.find(findSelectedDepartement))) {
    return null
  }
  return <Section header={`Carte de la concurrence en ${lowerFirstLetter(jobGroupName)}`}>
    <FrenchDepartementsMap
      departements={departementScores} selectedDepartementId={selectedDepartementId}
      userYou={userYou} />
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
    userYou,
  } = props
  const jobSearchLengthMonths = getJobSearchLengthMonths(project)
  const specificInterviewCounts = (jobSearchLengthMonths < 7 ?
    mediumSearchInterviewCounts : longSearchInterviewCounts)
  if (!specificInterviewCounts) {
    return null
  }
  const interviewText = jobSearchLengthMonths < 7 ?
    '6 mois après le début' : 'un an après le début'
  return <Section header={`Nombre d'entretiens décrochés ${interviewText} de la recherche`}>
    <InterviewHistogram
      userYou={userYou}
      interviewCounts={specificInterviewCounts}
      totalInterviewCount={project.totalInterviewCount || 0} />
  </Section>
}
const InterviewsCountSection = React.memo(InterviewsCountSectionBase)


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
  const {baseUrl, dispatch, gender, laborStats, project, userYou} = props
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
  const maybeE = genderize('·e', 'e', '', gender)
  const headerText = isMobileVersion ? 'Information principale' :
    'Statistiques pour mieux comprendre votre diagnostic'
  return <PageWithNavigationBar
    page="statistiques" onBackClick={baseUrl} isLogoShown={true} style={pageStyle}>
    {isMobileVersion ? null : <div style={scrollBarStyle} />}
    {isMobileVersion ? null : <BreadCrumbs baseUrl={baseUrl} style={{height: 50}} />}
    {isMobileVersion && categoryId ?
      <Section header={headerText}>
        <div style={{padding: 0}}>
          <BobThinksVisualCard category={categoryId} {...{project, userYou}} />
        </div>
      </Section> : null}
    <div style={contentStyle}>
      {categories ? <Section
        header={`Facteurs pris en compte pour ${userYou('ton', 'votre')} score`}>
        <CategoriesTrain
          hasSelectedCategoryTag={true} categories={categories} userYou={userYou} gender={gender} />
      </Section> : null}
      <MarketStressWaffleSection {...props} />
      <RomeMobilitySection {...props} />
      <MarketStressMapSection {...props} />
      <InterviewsCountSection {...props} />
    </div>
    <section style={{marginTop: 50, textAlign: 'center'}}>
      <ExternalLink
        onClick={handleIMTLinkClick}
        href={getIMTURL(targetJob, city)} style={{textDecoration: 'none'}}>
        <Button type="discreet" isRound={true} isNarrow={true} style={imtLinkStyle}>
          Accéder à plus d'informations sur le marché du travail
          <ChevronRightIcon size={18} style={{marginRight: -7}} />
        </Button>
      </ExternalLink>
      <div style={{fontSize: 11, fontStyle: 'italic', marginTop: 8}}>
        {userYou('Tu vas', 'Vous allez')} être redirigé{maybeE} vers un site de Pôle emploi
      </div>
    </section>
  </PageWithNavigationBar>
}
const StatisticsPage = connect(
  ({app: {laborStats = {}}, user}: RootState, {project: {projectId}}: PageConfig):
  PageConnectedProps => ({
    gender: user.profile ? user.profile.gender : undefined,
    laborStats: projectId && laborStats[projectId] || undefined,
    userYou: youForUser(user),
  })
)(React.memo(StatisticsPageBase))


export {StatisticsPage}
