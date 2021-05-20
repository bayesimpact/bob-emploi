import {TFunction, TOptions} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import Button from 'components/button'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import VideoFrame from 'components/video_frame'
import Picto from 'images/advices/picto-personality-test.svg'

import {CardProps} from './base'


interface TestCardProps {
  children: React.ReactNode
  handleExplore: () => void
  style?: React.CSSProperties
  t: TFunction
  title: string
  url: string
}


const headerStyle: React.CSSProperties = {
  fontWeight: 'bold',
  padding: 15,
  textAlign: 'center',
}
const contentStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_GREY,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  padding: 15,
}
const buttonStyle: React.CSSProperties = {
  display: 'block',
  margin: '15px auto 0',
}
const testCardChildrenStyle: React.CSSProperties = {
  flex: 1,
}


const TestCardBase: React.FC<TestCardProps> = (props: TestCardProps): React.ReactElement => {
  const {children, handleExplore, style, t, title, url} = props
  const handleButtonClick = useCallback((): void => {
    handleExplore()
    window.open(url, '_blank')
  }, [handleExplore, url])
  const containerStyle = useMemo((): React.CSSProperties => ({
    border: `1px solid ${colors.BACKGROUND_GREY}`,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 280,
    ...style,
  }), [style])
  return <div style={containerStyle}>
    <header style={headerStyle}>{title}</header>
    <div style={contentStyle}>
      <p style={testCardChildrenStyle}>{children}</p>
      <Button type="navigation" onClick={handleButtonClick} style={buttonStyle}>
        {t('Faire le test')}
      </Button>
    </div>
  </div>
}
TestCardBase.propTypes = {
  children: PropTypes.node.isRequired,
  handleExplore: PropTypes.func.isRequired,
  style: PropTypes.object,
  title: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
}
const TestCard = React.memo(TestCardBase)


const testsContainerStyle: React.CSSProperties = {
  display: 'flex',
}

const getIsSenior = (seniority: bayes.bob.ProjectSeniority): boolean =>
  (seniority === 'INTERMEDIARY' || seniority === 'SENIOR' ||
    seniority === 'EXPERT' || seniority === 'CARREER')


const PersonalityTest: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, profile: {gender, yearOfBirth},
    project: {seniority = 'UNKNOWN_PROJECT_SENIORITY'}, t} = props
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  const videoLink = t('https://www.youtube.com/embed/mMBCNR9uIpE')
  const isOver40 = yearOfBirth && (yearOfBirth <= new Date().getFullYear() - 40)
  const isSenior = getIsSenior(seniority)
  const otherQuizzContext = isSenior && isOver40 ? 'senior' : ''
  // TODO(cyrile): Use MethodSuggestionList.
  return <div>
    <Trans parent="p" t={t} tOptions={tOptions}>
      Introverti·e, intuitif·ve, extraverti·e, observateur·rice, stratège, curieux·se,
      enthousiaste ou réfléchi·e&hellip; Mieux vous connaître vous aidera à bien orienter votre
      recherche. Bonus&nbsp;: les résultats des tests vous aideront à bien présenter vos forces et
      vos faiblesses en entretien.
    </Trans>
    <section>
      <header><Trans parent="p" t={t} style={{fontSize: 14}}>
        Nous avons sélectionné pour vous{' '}
        <GrowingNumber style={{fontWeight: 'bold'}} number={2} /> tests gratuits&nbsp;:
      </Trans></header>
      <div style={testsContainerStyle}>
        <TestCard
          title={t('16 personnalités')} handleExplore={handleExplore('test')}
          url={t('https://www.16personalities.com/fr/test-de-personnalite')} t={t}>
          <Trans parent={null} t={t}>
            Découvrir les raisons pour lesquelles vous faites les choses de la façon dont vous les
            faites.
          </Trans>
        </TestCard>
        <TestCard
          title={t('personalityTestName', {context: otherQuizzContext})}
          handleExplore={handleExplore('test')}
          url={t('personalityTestUrl', {context: otherQuizzContext})}
          style={{marginLeft: 30}} t={t}>
          {t('personalityTestDescription', {context: otherQuizzContext})}
        </TestCard>
      </div>
    </section>
    {videoLink ? <section style={{marginTop: 10}}>
      <header><Trans parent="p" t={t}>
        Dans cette vidéo, Paul Duan, un des inventeurs de {{productName: config.productName}},
        raconte comment <span style={{fontWeight: 'bold'}}>apprendre à mieux se connaître</span>
        {' '}lui a permis de retrouver un métier qu'il aime&nbsp;:
      </Trans></header>
      <VideoFrame>
        <iframe
          // TODO(cyrille): Handle explore 'video' when clicking in the iframe.
          src={videoLink}
          frameBorder={0} scrolling="no" allowFullScreen={true}
          title={t('Présentation de Paul Duan à la cérémonie du diplôme de Sciences-Po')} />
      </VideoFrame>
    </section> : null}
  </div>
}
PersonalityTest.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(PersonalityTest)


export default {ExpandedAdviceCardContent, Picto}
