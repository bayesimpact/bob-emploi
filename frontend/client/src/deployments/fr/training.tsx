import React from 'react'

import {slugify} from 'store/french'

import {ExpandableAction, HandyLink} from 'components/advisor/base'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'

import type {GetTipsProps, Tips} from '../types/training'
import laBonneFormationImage from './labonneformation-picto.png'

// i18next-extract-mark-ns-start advisor

const linkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
} as const
const footerStyle = {
  cursor: 'auto',
  display: 'block',
} as const

const getTips = (props: GetTipsProps): Tips => {
  const {
    commonTips,
    onContentShown,
    profile: {gender = undefined, hasHandicap = false} = {},
    project: {targetJob: {jobGroup: {name: jobName = undefined} = {}} = {}} = {},
    t,
  } = props
  if (hasHandicap) {
    return {
      isOrdered: true,
      tips: [
        React.cloneElement(commonTips.coach, {title: t('Demander à son conseiller Cap emploi')}),
        <ExpandableAction
          key="hanploi-tip" onContentShown={onContentShown}
          contentName={t("l'astuce Hanploi")} title={t('Prendre conscience des pièges à éviter')}>
          <Trans t={t} tOptions={{context: gender}}>
            Ne tombez pas dans les pièges de formation d'agent·e administratif·ve.
            <br /><br />
            C'est un métier qui se transforme, et beaucoup de centres de formation ne se sont pas
            adaptés.
            <br /><br />
            Commencez par vous demander ce qui vous intéresse réellement.
          </Trans>
        </ExpandableAction>,
        commonTips.friend,
        commonTips.recruiter,
        <HandyLink
          key="pole-emploi"
          onClick={onContentShown} style={footerStyle}
          linkIntro={t(
            'Se renseigner sur les aides formation pour les personnes en situation de ' +
            'handicap\u00A0:',
          )}
          href="https://www.pole-emploi.fr/candidat/travailleurs-handicapes-@/article.jspz?id=60726" // checkURL
        >
          Pôle emploi
        </HandyLink>,
      ],
    }
  }
  const domain = jobName && slugify(jobName)
  return {
    tips: [
      commonTips.friend,
      commonTips.recruiter,
      commonTips.coach,
      <Trans t={t} key="lbf" style={footerStyle}>
        <img
          style={{height: 20, marginRight: 10}} src={laBonneFormationImage}
          alt="la bonne formation" />
        Trouvez une formation et lisez des témoignages sur <ExternalLink
          style={linkStyle} href={createTrainingLink(domain)} onClick={onContentShown}>
          {{trainingFindName: 'labonneformation.fr'}}</ExternalLink>
      </Trans>,
    ],
  }
}

const trainingFindUrl = 'https://labonneformation.pole-emploi.fr/formations' // checkURL

// TODO(cyrille): Make a working link.
function createTrainingLink(domain?: string): string {
  if (!domain) {
    return trainingFindUrl
  }
  return `${trainingFindUrl}/${domain}/france`
}

const websites = [
  {
    logo: laBonneFormationImage,
    name: 'La Bonne Formation',
    url: trainingFindUrl,
  },
] as const

export {getTips, websites}
