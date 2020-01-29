import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import {genderize} from 'store/french'

import {Button, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-personality-test.svg'

import {CardProps} from './base'


interface TestCardProps {
  children: React.ReactNode
  handleExplore: () => void
  style?: React.CSSProperties
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
  padding: 15,
}
const buttonStyle: React.CSSProperties = {
  display: 'block',
  margin: '15px auto 0',
}


const TestCardBase: React.FC<TestCardProps> = (props: TestCardProps): React.ReactElement => {
  const {children, handleExplore, style, title, url} = props
  const handleButtonClick = useCallback((): void => {
    handleExplore()
    window.open(url, '_blank')
  }, [handleExplore, url])
  const containerStyle = useMemo(() => ({
    border: `1px solid ${colors.BACKGROUND_GREY}`,
    maxWidth: 280,
    ...style,
  }), [style])
  return <div style={containerStyle}>
    <header style={headerStyle}>{title}</header>
    <div style={contentStyle}>
      <p>{children}</p>
      <Button type="navigation" onClick={handleButtonClick} style={buttonStyle}>
        Faire le test
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
const coverallStyle: React.CSSProperties = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}


const PersonalityTest: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, profile: {gender}, userYou} = props
  const easyGenderize = useCallback(
    (her: string, his: string): string => genderize(`${his}·${her}`, her, his, gender),
    [gender],
  )
  const maybeE = easyGenderize('e', '')
  return <div>
    <p>
      Introverti{maybeE}, intuiti{easyGenderize('ve', 'f')}, extraverti{maybeE},
      observat{easyGenderize('rice', 'eur')}, stratège, curieu{easyGenderize('se', 'x')},
      enthousiaste ou réfléchi{maybeE}&hellip; Mieux {userYou('te', 'vous')} connaître
      {userYou(" t'", ' vous ')}aidera à bien orienter {userYou('ta', 'votre')} recherche.
      Bonus&nbsp;: les résultats des tests {userYou("t'", 'vous ')}aideront à bien
      présenter {userYou('tes', 'vos')} forces et {userYou('tes', 'vos')} faiblesses en entretien.
    </p>
    <section>
      <header><p style={{fontSize: 14}}>
        Nous avons sélectionné pour {userYou('toi ', 'vous ')}
        <GrowingNumber style={{fontWeight: 'bold'}} number={2} /> tests gratuits&nbsp;:
      </p></header>
      <div style={testsContainerStyle}>
        <TestCard
          title="16 personnalités" handleExplore={handleExplore('test')}
          url="https://www.16personalities.com/fr/test-de-personnalite">
          Découvrir les raisons pour lesquelles {userYou('tu fais', 'vous faites')} les choses de
          la façon dont {userYou('tu les fais', 'vous les faites')}.
        </TestCard>
        <TestCard
          title="Boussole" handleExplore={handleExplore('test')}
          url="https://www.wake-up.io/boussole/" style={{marginLeft: 30}}>
          Trouver {userYou('ton', 'votre')} "Talent d'or" pour {userYou("t'", 'vous ')}aider à
          identifier {userYou('ta', 'votre')} position clé en entreprise.
        </TestCard>
      </div>
    </section>
    <section style={{marginTop: 10}}>
      <header><p>
        Dans cette vidéo, Paul Duan, un des inventeurs de {config.productName}, raconte
        comment <span style={{fontWeight: 'bold'}}>apprendre à mieux se connaître</span> lui a
        permis de retrouver un métier qu'il aime&nbsp;:
      </p></header>
      {/* TODO(cyrille): Use VideoFrame from theme. */}
      <div style={{height: 0, paddingBottom: '56.25%', position: 'relative'}}>
        <iframe
          // TODO(cyrille): Handle explore 'video' when clicking in the iframe.
          src="https://www.youtube.com/embed/mMBCNR9uIpE"
          width="100%" height="100%" style={coverallStyle}
          frameBorder={0} scrolling="no" allowFullScreen={true} />
      </div>
    </section>
  </div>
}
PersonalityTest.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(PersonalityTest)


export default {ExpandedAdviceCardContent, Picto}
