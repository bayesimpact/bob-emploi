import React from 'react'

import {ExpandableAction, HandyLink} from 'components/advisor/base'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'

import type {GetTipsProps, Tips} from '../types/training'

import skillUpLogo from './skillup.svg'
import mySkillsFutureLogo from './myskillsfuture.svg'
import alisonLogo from './alison.svg'
import goodWillLogo from './goodwill.svg'
import trainingProviderResultsLogo from './training-provider-results.svg'
import careerOneStopLogo from './careeronestop.svg'

// i18next-extract-mark-ns-start advisor

const tipStyle = {
  color: colors.CHARCOAL_GREY,
  cursor: 'auto',
  display: 'block',
  lineHeight: 1.4,
} as const
const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
} as const

const getTips = (props: GetTipsProps): Tips => {
  const {
    commonTips,
    data: {vocationalRehabilitationAgency: {url = ''} = {}} = {},
    onContentShown,
    profile: {gender = undefined, hasHandicap = false, isArmyVeteran = false} = {},
    project: {city: {regionName = ''} = {}} = {},
    t,
  } = props
  const pitfallTip = <ExpandableAction
    key="pitfall-tip" onContentShown={onContentShown}
    contentName={t('astuce')} title={t('Prendre conscience des pièges à éviter')}>
    <Trans t={t} tOptions={{context: gender}}>
      Il y a plusieurs carrières, par exemple des emplois auprès de l'adminstration fédérale,
      que certains conseillers peuvent vous suggérer.
      <br /><br />
      Même si cela peut être de bonnes options, ne vous laissez pas pousser vers un emploi si
      vous n'êtes pas sûr·e qu'il soit bien pour vous.
      <br /><br />
      Il peut être utile de prendre divers avis pour y voir plus clair.
    </Trans>
  </ExpandableAction>
  if (isArmyVeteran) {
    return {
      tips: [
        <Trans t={t} key="veteran-local-center" style={tipStyle}>
          Obtenez de l'aide de votre centre local du <ExternalLink
            href="https://www.dol.gov/agencies/vets/about/regionaloffices"
            onClick={onContentShown} style={linkStyle}>
            service de l'emploi et de la formation des vétérans
          </ExternalLink>
        </Trans>,
        pitfallTip,
        commonTips.friend,
        <Trans t={t} style={tipStyle} key="links">
          <span style={{marginRight: 10}} aria-hidden={true}>👉 </span>
          Regardez l'aide disponible pour la formation des vétérans&nbsp;: <ExternalLink
            style={linkStyle} onClick={onContentShown}
            href="https://www.va.gov/careers-employment/">
            US Dept. of Veteran Affairs
          </ExternalLink>
        </Trans>,
      ],
    }
  }
  if (hasHandicap) {
    const tips: ReactStylableElement[] = []
    if (url) {
      tips.push(regionName ?
        <Trans t={t} key="vocational-rehab" style={tipStyle}>
          Obtenez de l'aide du <ExternalLink href={url} onClick={onContentShown} style={linkStyle}>
            centre de réadaptation professionnelle
          </ExternalLink> de {{regionName}}
        </Trans> :
        <Trans t={t} key="vocational-rehab" style={tipStyle}>
          Obtenez de l'aide du <ExternalLink href={url} onClick={onContentShown} style={linkStyle}>
            centre de réadaptation professionnelle
          </ExternalLink> local
        </Trans>)
    }
    return {
      tips: [
        ...tips,
        pitfallTip,
        commonTips.friend,
        <Trans t={t} style={tipStyle} key="links">
          <span style={{marginRight: 10}} aria-hidden={true}>👉 </span>
          Regardez l'aide disponible pour les personnes atteintes de handicap&nbsp;: <ExternalLink
            style={linkStyle} onClick={onContentShown}
            href="https://www.careeronestop.org/ResourcesFor/WorkersWithDisabilities/job-search.aspx">
            CareerOneStop
          </ExternalLink> et <ExternalLink
            onClick={onContentShown} style={linkStyle}
            href="https://choosework.ssa.gov/about/how-it-works/index.html">
            Ticket to Work
          </ExternalLink>
        </Trans>,
      ],
    }
  }
  return {
    tips: [
      commonTips.friend,
      commonTips.recruiter,
      commonTips.coach,
      <HandyLink
        linkIntro={t('Trouvez une formation et lisez des témoignages sur')} key="local-job-center"
        href="https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx">
        local job center
      </HandyLink>,
    ],
  }
}

const websites = [
  {
    logo: skillUpLogo,
    name: 'SkillUp',
    url: 'https://www.skillup.org/', // checkURL
  },
  {
    logo: mySkillsFutureLogo,
    name: 'MySkillsMyFuture',
    url: 'https://www.myskillsmyfuture.org/', // checkURL
  },
  {
    logo: alisonLogo,
    name: 'Alison',
    url: 'https://alison.com/', // checkURL
  },
  {
    logo: goodWillLogo,
    name: 'GoodWill',
    url: 'https://www.goodwill.org/jobs-training/training-and-career-advancement/', // checkURL
  },
  {
    logo: trainingProviderResultsLogo,
    name: 'Training Provider Results',
    url: 'https://www.trainingproviderresults.gov/#!/', // checkURL
  },
  {
    logo: careerOneStopLogo,
    name: 'CareerOneStop',
    url: 'https://www.careeronestop.org/ResourcesFor/CredentialSeeker/credential-seeker.aspx', // checkURL
  },
] as const

export {getTips, websites}
