import {TOptions} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo, useState} from 'react'

import {inDepartement} from 'store/french'
import {missionLocaleUrl} from 'store/job'

import {colorToAlpha} from 'components/colors'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import UpDownIcon from 'components/up_down_icon'
import Picto from 'images/advices/picto-immersion.svg'

import {CardProps, useAdviceData} from './base'


const contactContainerStyle = {
  backgroundColor: '#fff',
  border: `solid 1px ${colors.SILVER}`,
  marginTop: 20,
  padding: '0 20px',
}
const contactHeaderStyle = {
  alignItems: 'center',
  display: 'flex',
  fontWeight: 500,
  minHeight: 50,
  padding: 0,
  width: '100%',
}


const ImmersionMiloMethod = (props: CardProps): React.ReactElement => {
  const [isContactMiloExpanded, setIsContactMiloExpanded] = useState(false)
  const toggleExpansion = useCallback(
    (): void => setIsContactMiloExpanded(!isContactMiloExpanded),
    [isContactMiloExpanded],
  )
  const {data: adviceData, loading} = useAdviceData<bayes.bob.MissionLocaleData>(props)
  const {handleExplore, profile: {gender}, project: {city}, t} = props
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])

  const miloLink = useMemo((): React.ReactNode => {
    const inYourDepartement = city && inDepartement(city, t)
    if (!city || !inYourDepartement) {
      return null
    }
    const url = missionLocaleUrl(t, adviceData, city.departementName)
    return <Trans t={t} parent={null}>
      Pour accéder à la <ExternalLink href={url} onClick={handleExplore('milo list')}>
        liste des missions Locales {{inYourDepartement}} cliquez ici
      </ExternalLink>.
    </Trans>
  }, [adviceData, handleExplore, city, t])

  const contactMilo = useMemo((): React.ReactNode => {
    const contentStyle = {
      display: isContactMiloExpanded ? 'block' : 'none',
      margin: '10px 0',
    }
    return <div style={contactContainerStyle}>
      <button style={contactHeaderStyle} onClick={toggleExpansion}>
        {t('Allez rencontrer un conseiller')}
        <span style={{flex: 1}} />
        <UpDownIcon icon="chevron" isUp={isContactMiloExpanded} />
      </button>
      <div style={contentStyle} aria-hidden={!isContactMiloExpanded} aria-live="polite">
        {miloLink}
        <br />
        <Trans parent={null} t={t}>
          La Mission Locale vous aidera à mettre en place votre mission. (Ils pourraient aussi
          avoir des contacts dans des entreprises qui pourraient vous
          accueillir <span aria-label={t("clin d'œil")} role="img">😉</span>).
        </Trans>
        <br />
        <Trans parent={null} tOptions={tOptions} t={t}>
          Pour être prêt·e avant votre rendez-vous avec un conseiller de la Mission Locale vous
          pouvez&nbsp;:
        </Trans>
        <ul style={{margin: 0}}>
          <li>{t('mettre à jour votre CV,')}</li>
          <li>{t('faire une liste de 5 entreprises où vous aimeriez faire une immersion.')}</li>
        </ul>
      </div>
    </div>
  }, [isContactMiloExpanded, miloLink, t, tOptions, toggleExpansion])

  const highlightStyle: React.CSSProperties = {
    backgroundColor: colorToAlpha(colors.SUN_YELLOW_80, .8),
    fontWeight: 'inherit',
  }
  if (loading) {
    return loading
  }
  return <div>
    <Trans parent={null} t={t} tOptions={tOptions}>
      L'immersion professionnelle est un cadre qui vous permet de faire
      un <strong style={highlightStyle}>mini-stage en entreprise</strong> pour
      découvrir la réalité d'un métier. L'immersion peut
      durer <strong style={highlightStyle}>entre quelques heures et 15 jours</strong>.
      Pendant l'immersion vous n'êtes pas rémunéré·e mais vous êtes protégé·e en cas d'accident du
      travail et vous êtes accompagné·e d'un tuteur ou d'une tutrice. Son rôle est à la fois de vous
      guider et de faire le point sur vos compétences.
    </Trans>

    <br /><br />

    <Trans parent={null} t={t}>
      Pour gérer le côté administratif et recevoir des conseils sur comment faire une immersion,
      contactez votre Mission Locale&nbsp;:
    </Trans>
    {contactMilo}
  </div>
}
ImmersionMiloMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    gender: PropTypes.string,
  }).isRequired,
  project: PropTypes.shape({
    city: PropTypes.shape({
      departementName: PropTypes.string,
      departementPrefix: PropTypes.string,
    }),
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(ImmersionMiloMethod)


export default {ExpandedAdviceCardContent, Picto}
