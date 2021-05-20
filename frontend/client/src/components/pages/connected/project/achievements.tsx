import CheckIcon from 'mdi-react/CheckIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import {RootState} from 'store/actions'
import {CityNameAndPrefix, inCityPrefix} from 'store/french'
import {getTranslatedMainChallenges} from 'store/i18n'
import {genderizeJob} from 'store/job'
import isMobileVersion from 'store/mobile'
import {useGender} from 'store/user'

import BobInteraction from 'components/bob_interaction'
import Emoji from 'components/emoji'
import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {FixedButtonNavigation, PageWithNavigationBar} from 'components/navigation'
import {CONVINCE_PAGE} from 'components/url'

import useProjectReview from './project_review'

const diagnosticElementSpacing = 35
const navigationPadding = 30
const challengeCardHeight = 167
const challengeCardWidth = 136
const challengeCardPaddingRight = 20
const challengeListPadding = 25
const maxChallengeCardsPerLine = 3
const desktopContainerWidth = 485

type ValidatedChallengeProps = {
  emoji?: string
  isSmall?: boolean
  isWide?: boolean
  metricReached?: string
}
const emojiBorderSize = 46
const emojiBorderStyle: React.CSSProperties = {
  alignItems: 'center',
  border: `solid 1px ${colors.PINKISH_GREY_THREE}`,
  borderRadius: '50%',
  display: 'flex',
  height: emojiBorderSize,
  justifyContent: 'center',
  marginBottom: 20,
  padding: '14px 12.5px 12px 11.5px',
  position: 'relative',
  width: emojiBorderSize,
}
// TODO(sil): Consider doing a component for circled check icon.
const checkIconSize = 21
const checkIconStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.GREENISH_TEAL,
  borderRadius: '50%',
  bottom: -13,
  display: 'flex',
  height: checkIconSize,
  justifyContent: 'center',
  margin: 'auto',
  position: 'absolute',
  width: checkIconSize,
}

const ValidatedChallengeBase = (props: ValidatedChallengeProps): React.ReactElement => {
  const {emoji, isSmall, isWide, metricReached} = props
  const challengeContainerStyle: React.CSSProperties = useMemo(() => ({
    alignItems: 'center',
    borderRadius: 20,
    boxShadow: '0 5px 30px 0 rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    fontSize: 16,
    height: isWide ? 'initial' : challengeCardHeight,
    padding: 25,
    textAlign: 'center',
    width: isWide ? '100%' : isSmall ? challengeCardWidth : 147.5,
  }), [isSmall, isWide])

  return <div style={challengeContainerStyle}>
    <div style={isWide ? {} : emojiBorderStyle}>
      <Emoji size={22}>{emoji || ''}</Emoji>
      {isWide ? null :
        <div style={checkIconStyle}><CheckIcon size={17} style={{color: '#fff'}} /></div>}
    </div>
    <Markdown content={metricReached} isSingleLine={isWide} />
  </div>
}
const ValidatedChallenge = React.memo(ValidatedChallengeBase)

const headerStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  margin: isMobileVersion ? '20px 0px 15px' : '20px auto',
}

type DiagnosticChallengesProps = {
  challenges?: readonly bayes.bob.DiagnosticMainChallenge[]
  jobName: string
  prefixedCity: CityNameAndPrefix
}

const challengesContainerStyle: React.CSSProperties = {
  ...isMobileVersion ? {height: challengeCardHeight + diagnosticElementSpacing} : {},
  marginBottom: 10,
  position: 'relative',
  width: '100%',
}
const challengesListContainerWidth = (
  challengeCardWidth * maxChallengeCardsPerLine
  + challengeCardPaddingRight * (maxChallengeCardsPerLine - 1)
  + challengeListPadding + navigationPadding)
const challengesListContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  listStyle: 'none',
  overflow: 'auto',
  padding: `25px ${challengeListPadding}px 25px ${navigationPadding}px`,
  ...isMobileVersion ? {
    marginBottom: 0,
    marginLeft: -navigationPadding,
    marginTop: 15,
    maxWidth: '100vw',
    position: 'absolute',
  } : {
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginLeft: (desktopContainerWidth - challengesListContainerWidth) / 2,
    maxWidth: challengesListContainerWidth,
    width: challengesListContainerWidth,
  },
}
const itemBaseStyle: React.CSSProperties = {
  paddingRight: challengeCardPaddingRight,
  ...isMobileVersion ? {} : {marginBottom: 30},
}

function computeItemStyle(index: number, numChallenges: number): React.CSSProperties {
  if (index === numChallenges - 1 || (!isMobileVersion && (index % 3) === 2)) {
    return {}
  }
  return itemBaseStyle
}

const mobileLastItemStyle: React.CSSProperties = {
  flexShrink: 0,
  width: navigationPadding,
}

const DiagnosticChallengesBase = (props: DiagnosticChallengesProps): React.ReactElement => {
  const {challenges, jobName, prefixedCity: {cityName, prefix: cityPrefix}} = props
  const {t} = useTranslation()
  const numChallenges = challenges && challenges.length
  if (jobName && challenges && numChallenges) {
    return <React.Fragment>
      <Trans>
        Vous avez validé des étapes importantes de votre recherche de
        <strong> {{jobName}}</strong> {{cityPrefix}} <strong>{{cityName}}.</strong>
      </Trans>
      <div style={challengesContainerStyle}>
        <ul style={challengesListContainerStyle} className="no-scrollbars">
          {challenges.map((
            {emoji, metricReached}: bayes.bob.DiagnosticMainChallenge,
            index: number): React.ReactElement =>
            <li key={index} style={computeItemStyle(index, numChallenges)}>
              <ValidatedChallenge
                isWide={numChallenges === 1 && !isMobileVersion} isSmall={numChallenges > 2}
                {...{emoji, metricReached}} />
            </li>)}
          {isMobileVersion ? <li style={mobileLastItemStyle} /> : null}
        </ul>
      </div>
    </React.Fragment>
  }
  return <React.Fragment>
    <Trans style={{marginBottom: diagnosticElementSpacing}}>
      Vous avez fait une démarche importante pour lancer votre recherche d'emploi.
    </Trans>
    <ValidatedChallenge isWide={true} metricReached={t('Recherche **commencée**')} emoji="👍" />
  </React.Fragment>
}
const DiagnosticChallenges = React.memo(DiagnosticChallengesBase)


interface Props {
  baseUrl: string
  project: bayes.bob.Project
}

const pageContainerStyle: React.CSSProperties = isMobileVersion ? {} : {
  margin: '20px auto',
  textAlign: 'center',
  width: desktopContainerWidth,
}

const pageStyle: React.CSSProperties = {
  alignItems: 'center',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  ...isMobileVersion ? {padding: '20px 30px 0px'} : {},
}

const bobInteractionStyle: React.CSSProperties = {
  marginLeft: isMobileVersion ? 'auto' : 85,
  marginRight: isMobileVersion ? 'auto' : 85,
  marginTop: diagnosticElementSpacing,
  textAlign: 'left',
}

const AchievementsPage = (props: Props): React.ReactElement => {
  const {baseUrl, project} = props
  const gotoNextPage = useProjectReview(
    `${baseUrl}/${CONVINCE_PAGE}`, project, 'REVIEW_PROJECT_ACHIEVEMENTS')
  const gender = useGender()
  const name = useSelector(
    ({user: {profile: {name = ''} = {}} = {}}: RootState) => name)
  const jobName = useSelector(
    ({user: {projects = []} = {}}: RootState) => genderizeJob(projects?.[0]?.targetJob, gender))
  const cityName = useSelector(({user}: RootState) => user?.projects?.[0]?.city?.name)
  const {t} = useTranslation()
  const prefixedCity = inCityPrefix(cityName || '', t)
  const mainChallenges = project.diagnostic?.categories
  const completeRelevantChallenges = useMemo(
    (): undefined | readonly bayes.bob.DiagnosticMainChallenge[] => {
      const relevantChallenges = mainChallenges?.filter(
        ({relevance}: bayes.bob.DiagnosticMainChallenge) => relevance === 'RELEVANT_AND_GOOD')
      const translatedClientMainChallenges = getTranslatedMainChallenges(t, gender)
      return relevantChallenges?.map((mainChallenge) => {
        const {categoryId} = mainChallenge
        if (!categoryId) {
          return mainChallenge
        }
        return {
          ...translatedClientMainChallenges[categoryId],
          ...mainChallenge,
        }
      })
    },
    [mainChallenges, t, gender])
  // TODO(émilie): Handle the navigation button so it's correctly displayed on desktop.
  return <PageWithNavigationBar
    page="bravo"
    navBarContent={t('Mes accomplissements')}
    isChatButtonShown={true} style={pageStyle}>
    <div style={pageContainerStyle}>
      <Trans parent="h2" style={headerStyle}>
        Bravo{name ? ` ${name}` : ''}&nbsp;!
      </Trans>
      <DiagnosticChallenges {...{jobName, prefixedCity}} challenges={completeRelevantChallenges} />
      <BobInteraction style={bobInteractionStyle}>
        <Trans>
          Vous êtes sur la bonne voie&nbsp;! Regardons ensemble quelle est <strong>votre plus grande
          priorité</strong> pour avancer sereinement.
        </Trans>
      </BobInteraction>
      <FixedButtonNavigation
        onClick={gotoNextPage}
        width={isMobileVersion ? undefined : desktopContainerWidth}>
        {t('Découvrir ma priorité')}
      </FixedButtonNavigation>
    </div>
  </PageWithNavigationBar>
}
AchievementsPage.propTypes = {
  baseUrl: PropTypes.string.isRequired,
  project: PropTypes.shape({
    diagnostic: PropTypes.shape({
      categories: PropTypes.arrayOf(PropTypes.shape({
        relevance: PropTypes.string,
      })),
    }),
    projectId: PropTypes.string.isRequired,
  }).isRequired,
}

export default React.memo(AchievementsPage)
