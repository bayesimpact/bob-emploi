import React, {useCallback} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import InformationOutlineIcon from 'mdi-react/InformationOutlineIcon'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'

import prepApprentissageLogo from '../images/prep_apprentissage.jpg'
import type {DispatchAllUpskillingActions} from '../store/actions'
import {applyToOpenClassRooms} from '../store/actions'
import MetricsDetail from './metrics_detail'


interface PerkProps {
  emoji: string
  main: LocalizableString
}

const perks: readonly PerkProps[] = [
  {
    emoji: '💰',
    main: prepareT('Formation rémunérée'),
  },
  {
    emoji: '🎓',
    main: prepareT('Obtenir un diplôme BAC+2'),
  },
  {
    emoji: '🚀',
    main: prepareT('Avoir un coach personnel'),
  },
]

interface RequirementProps {
  emoji: string
  main: React.ReactNode
  subtext?: React.ReactNode
}

const requirements: readonly RequirementProps[] = [
  {
    emoji: '🎂',
    main: <Trans>
      Avoir entre <strong>16</strong> et <strong>29 ans</strong>*
    </Trans>,
    subtext: <Trans parent={null}>
      *pas de limite d'âge si vous êtes travailleur·se handicapé·e
    </Trans>,
  },
  {
    emoji: '🇫🇷',
    main: <Trans>
      Résider en <strong>France</strong>*
    </Trans>,
    subtext: <Trans parent={null}>
      *Métropolitaine et DOM-TOM
    </Trans>,
  },
  {
    emoji: '💻',
    main: <Trans>
      Avoir un <strong>ordinateur</strong> et accéder à <strong>Internet</strong>
    </Trans>,
  },
]

interface SyllabusProps {
  months: LocalizableString
  text: LocalizableString
}
const syllabus: readonly SyllabusProps[] = [
  {
    months: prepareT('1 mois'),
    text: prepareT('Découvrir les 4 métiers'),
  },
  {
    months: prepareT('2 mois'),
    text: prepareT('Apprendre les bases du métier choisi'),
  },
  {
    months: prepareT('1 mois'),
    text: prepareT('Rechercher une alternance avec un coach'),
  },
]

const headerStyle: React.CSSProperties = {
  borderBottom: `1px solid ${colors.CHARCOAL_GREY_TWO}`,
  paddingBottom: 24,
  ...isMobileVersion ? {textAlign: 'left'} : {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
}
const logoStyle: React.CSSProperties = {
  borderRadius: 6,
  margin: isMobileVersion ? '20px 0' : '0 0 0 5px',
  maxWidth: '100%',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 19,
  fontWeight: 'bold',
  margin: '40px 0 20px',
}
const sectionStyle: React.CSSProperties = {
  backgroundColor: colors.PURPLISH_BROWN,
  border: `1px solid ${colors.CHARCOAL_GREY_TWO}`,
  borderRadius: 30,
  marginTop: 50,
  overflow: 'hidden',
  padding: isMobileVersion ? 18 : 28,
}
const descriptionStyle: React.CSSProperties = {
  color: colors.PINKISH_GREY_TWO,
}

const perksStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.PURPLE_BROWN_TWO,
  borderRadius: 5,
  display: 'flex',
  justifyContent: 'center',
  padding: '15px 35px',
  textAlign: 'center',
  width: '32%',
  ...isMobileVersion && {
    marginBottom: 8,
    minWidth: 245,
    padding: '5px 50px',
    width: '100%',
  },
}
const cardsContainerStyle: React.CSSProperties = {
  backgroundColor: colors.PURPLISH_BROWN,
  color: colors.WHITE,
  ...isMobileVersion ? {} : {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
  },
  listStyleType: 'none',
  margin: 0,
  padding: 0,
}
const requirementsSectionStyle: React.CSSProperties = {
  margin: '40px 0',
}
const emojiStyle: React.CSSProperties = {
  marginLeft: '.3em',
  marginRight: '.3em',
}
const discoverButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'center',
  ...isMobileVersion ? {marginTop: 30, width: '100%'} : {maxWidth: 320},
}
const discoverButtonIconStyle: React.CSSProperties = {
  marginRight: 5,
}
const linkStyle: React.CSSProperties = {
  textDecoration: 'none',
}
const metricsStyle: React.CSSProperties = {
  backgroundColor: colors.PURPLE_BROWN_TWO,
  borderRadius: 5,
  ...isMobileVersion && {
    marginBottom: 8,
    padding: '16px 25px',
  },
}

interface Props {
  romeId: string
}
const PrepApprentissageSection = ({romeId}: Props): React.ReactElement => {
  const {t, t: translate} = useTranslation()
  const dispatch = useDispatch<DispatchAllUpskillingActions>()
  const title = <h2 style={{margin: 0}}>
    {t('Essayez ce métier avec OpenClassrooms\u00A0!')}
  </h2>
  const description = <Trans style={descriptionStyle}>
    Avec Prep'Apprentissage, apprenez ce métier pendant 4 mois tout en étant rémunéré·e
    <span aria-hidden={true} style={emojiStyle}>🤗</span>
  </Trans>

  const handleClick = useCallback(() => {
    dispatch(applyToOpenClassRooms(romeId, 'discover'))
  }, [dispatch, romeId])

  const discoverButton = <ExternalLink href="https://oc.cm/3q5l9dG" style={linkStyle} onClick={handleClick}>
    <Button style={discoverButtonStyle}>
      <InformationOutlineIcon style={discoverButtonIconStyle} size="1em" />
      <span>{t('Découvrir la formation')}</span>
    </Button>
  </ExternalLink>

  const image = <img style={logoStyle} src={prepApprentissageLogo} alt="Prep'Apprentissage" />
  return <section style={sectionStyle}>
    <h2 style={headerStyle}>
      {isMobileVersion ? <React.Fragment>
        {title}{image}{description}{discoverButton}
      </React.Fragment> : <React.Fragment>
        {image}
        <div style={{fontSize: 16, marginLeft: 32, marginRight: 32, width: 320}}>
          {title}
          {description}
        </div>
        {discoverButton}
      </React.Fragment>}
    </h2>
    <div>
      <h3 style={sectionTitleStyle}>{t('Avantages')}</h3>
      <div style={cardsContainerStyle}>
        {perks.map(({emoji, main}, index) =>
          <div key={index} style={perksStyle}>
            <div
              style={{fontSize: 24, marginRight: 5}}
              aria-hidden={true}>
              {emoji}
            </div>
            <div style={{fontSize: 16}}>{main}</div>
          </div>)}
      </div>
    </div>
    <div>
      <h3 style={sectionTitleStyle}>{t('Déroulement de la formation')}</h3>
      <ul style={cardsContainerStyle}>
        {syllabus.map(({months, text}, index) =>
          <MetricsDetail key={index} style={metricsStyle}>
            <div style={{fontSize: 14, fontWeight: 300, marginBottom: 4}}>
              {translate(...text)}
            </div>
            <div style={{color: colors.PINKISH_GREY_TWO, fontSize: 14}}>
              <span aria-label={t('durée')} role="img" style={emojiStyle}>⏳</span>
              <span style={{fontStyle: 'italic'}}>{translate(...months)}</span>
            </div>
          </MetricsDetail>)}
      </ul>
    </div>
    <div style={requirementsSectionStyle}>
      <h3 style={sectionTitleStyle}>{t("Conditions d'inscription")}</h3>
      <ul style={cardsContainerStyle}>
        {requirements.map(({emoji, main, subtext}, index) =>
          <MetricsDetail key={index} style={metricsStyle}>
            <div style={{fontSize: 32}} aria-hidden={true}>{emoji}</div>
            <div style={{fontSize: 16}}>{main}</div>
            {subtext ? <div style={{fontSize: 12, fontStyle: 'italic'}}>
              {subtext}</div> : null}
          </MetricsDetail>)}
      </ul>
    </div>
  </section>
}

export default React.memo(PrepApprentissageSection)
