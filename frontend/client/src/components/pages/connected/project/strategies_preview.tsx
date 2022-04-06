import React, {useEffect, useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import useCachedData from 'hooks/cached_data'
import type {RootState} from 'store/actions'
import {getMainChallengesUserCount} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {useGender} from 'store/user'

import BobInteraction from 'components/bob_interaction'
import {colorToAlpha} from 'components/colors'
import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {FixedButtonNavigation, PageWithNavigationBar} from 'components/navigation'

import useProjectReview from './project_review'

const desktopContainerWidth = 600

const emptyArray = [] as const


type StrategyCardProps = {
  figure: string
  isInteresting?: boolean
  text: string
}

const StrategyCardBase = (props: StrategyCardProps): React.ReactElement => {
  const {figure, isInteresting, text} = props
  const {t} = useTranslation()
  const color = isInteresting ? colors.SUNGLOW_ORANGE : colors.LIME_GREEN
  const cardStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: colorToAlpha(color, .1),
    borderRadius: 20,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    fontSize: 13,
    height: 193,
    justifyContent: 'space-between',
    padding: 20,
    textAlign: 'center',
    ...isMobileVersion ? {minWidth: 150} : {},
  }), [color])
  const titleStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: color,
    borderRadius: 3,
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    height: 21,
    letterSpacing: 1,
    lineHeight: 1.4,
    padding: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: 85,
  }), [color])
  const figureStyle = useMemo((): React.CSSProperties => ({
    color: color,
    fontSize: 40,
    fontWeight: 'bold',
  }), [color])
  return <div style={cardStyle}>
    <div style={titleStyle}>{isInteresting ? t('Intéressant') : t('Opportunité')}</div>
    <div style={figureStyle}>{figure}</div>
    <Markdown content={text} />
  </div>
}
const StrategyCard = React.memo(StrategyCardBase)


interface Props {
  baseUrl: string
  project: bayes.bob.Project
}
const pageStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px 30px 0px',
}
const titleStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 20,
}
const subtitleStyle: React.CSSProperties = {
  ...titleStyle,
  fontSize: 16,
}

const stratCardContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 25,
  marginTop: 15,
  width: '100%',
}

const pageContainerStyle: React.CSSProperties = isMobileVersion ? {} : {
  margin: '20px auto',
  textAlign: 'center',
  width: desktopContainerWidth,
}

const bobInteractionStyle: React.CSSProperties = {
  marginLeft: isMobileVersion ? 'auto' : 85,
  marginRight: isMobileVersion ? 'auto' : 85,
  marginTop: 20,
  textAlign: 'left',
}

// TODO(émilie): Fix the font-size (seems very small on desktop).
// TODO(émilie): Find a solution for the CTA which seems lonely at the bottom (Onboarding UI?).
const StrategiesPreviewPage = (props: Props): React.ReactElement => {
  const {baseUrl, project: {diagnostic: {categories = emptyArray} = {}} = {}, project} = props
  const {t} = useTranslation()
  const gotoNextPage = useProjectReview(baseUrl, project, 'REVIEW_PROJECT_PREVIEW_STRATS')
  const mainChallenge = categories.
    find(({categoryId}) => categoryId === project?.diagnostic?.categoryId)

  const gender = useGender()

  const categoryId = project?.diagnostic?.categoryId

  const mainChallengesUserCount = useCachedData(
    ({app: {mainChallengesUserCount = {}}}: RootState) => mainChallengesUserCount,
    getMainChallengesUserCount(),
    ({mainChallengeCounts}) => mainChallengeCounts,
  )
  const challengeUsersCount = categoryId ? mainChallengesUserCount?.data?.[categoryId] : undefined

  const hasInteresting = !!(mainChallenge?.interestingHighlight && mainChallenge?.interestingText)
  const hasOpportunity = !!(mainChallenge?.opportunityHighlight && mainChallenge?.opportunityText)

  useEffect((): void => {
    if (!hasInteresting && !hasOpportunity) {
      gotoNextPage()
    }
  }, [hasInteresting, hasOpportunity, gotoNextPage])

  return <PageWithNavigationBar
    page="strats-preview"
    navBarContent={t('Ma priorité')}
    isChatButtonShown={false} style={pageStyle}>
    <div style={pageContainerStyle}>
      <div style={titleStyle}>{t('Comment relever le défi\u00A0?')}</div>
      <BobInteraction style={bobInteractionStyle}>
        <Trans>
          <strong>Il y a des solutions,</strong> voici quelques exemples de ce que nous pouvons
          faire ensemble pour <strong>booster votre recherche&nbsp;!</strong>
        </Trans>
      </BobInteraction>
      <div style={stratCardContainerStyle}>
        {hasInteresting ? <StrategyCard
          isInteresting={true} figure={mainChallenge?.interestingHighlight || ''}
          text={mainChallenge?.interestingText || ''} /> : null}
        {hasInteresting && hasOpportunity ? <div style={{width: 20}} /> : null}
        {hasOpportunity ? <StrategyCard
          figure={mainChallenge?.opportunityHighlight || ''}
          text={mainChallenge?.opportunityText || ''} />
          : null}
      </div>
      {challengeUsersCount ? <React.Fragment>
        <div style={subtitleStyle}>{t("Vous n'êtes pas seul·e\u00A0!", {context: gender})}</div>
        <BobInteraction style={bobInteractionStyle}>
          <Trans count={challengeUsersCount}>
            <strong>{{challengeUsersCount}} personne</strong> relève en ce moment le même défi.
          </Trans>
        </BobInteraction>
      </React.Fragment> : null}
      <FixedButtonNavigation
        onClick={gotoNextPage} width={isMobileVersion ? undefined : desktopContainerWidth}>
        {t('Relever le défi\u00A0!')}
      </FixedButtonNavigation>
    </div>
  </PageWithNavigationBar>
}

export default React.memo(StrategiesPreviewPage)
