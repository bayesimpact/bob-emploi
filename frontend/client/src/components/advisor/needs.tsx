import React from 'react'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-needs.svg'

import type {CardProps} from './base'
import {ExpandableAction, HandyLink, MethodSuggestionList} from './base'

interface Tip {
  content: React.ReactElement
  title: LocalizableString
}

const contentStyle = {
  lineHeight: 1.5,
}

const quoteStyle = {
  borderLeft: `3px solid ${colors.MODAL_PROJECT_GREY}`,
  paddingLeft: 10,
}

const tips: readonly Tip[] = [
  {
    content: <Trans parent="span">
      <p>
        Un recruteur averti vous posera la question&nbsp;: "êtes-vous
        bénéficiaire de la loi 2005 ou avez vous une RQTH&nbsp;?"
      </p>
      <p>
        La question "avez-vous besoin d'un aménagement de poste&nbsp;?" suivra.
      </p>
      <p>
        Si cette question ne vous est pas posée, vous êtes en droit de ne pas en parler.
      </p>
    </Trans>,
    title: prepareT('Connaître ses droits'),
  },
  {
    content: <Trans parent="span">
      Selon Hanploi,
      <blockquote style={quoteStyle}>
        <p>
          Par expérience, il est préférable d'évoquer son handicap avant de signer son contrat de
          travail.
        </p>
        <p>
          Aujourd'hui vous n'avez peut-être pas besoin d'un aménagement de poste, mais demain&nbsp;?
        </p>
      </blockquote>
    </Trans>,
    title: prepareT('Prioriser sa santé et son confort avant tout'),
  },
  {
    // TODO(cyrille): Add tabs for each disability.
    content: <Trans parent="span">
      Hanploi nous conseille&nbsp;:
      <blockquote style={quoteStyle}>
        <p>
          Qui vous connait mieux que vous-même&nbsp;? Vous êtes donc en mesure d'en parler&nbsp;!
          Pas de langue de bois si vous avez besoin d'aménagement de poste.
        </p>
        <p>
          Mais n'entrez pas dans le détail de votre handicap cela ne regarde que vous&nbsp;!
        </p>
        <p>
          Posez-vous les bonnes questions par rapport au poste que vous visez.
        </p>
      </blockquote>
    </Trans>,
    title: prepareT("Se poser les bonnes questions avant de parler à l'employeur"),
  },
  {
    content: <Trans parent="span">
      L'<ExternalLink href="https://www.agefiph.fr/aides-handicap/aide-laccueil-lintegration-et-levolution-professionnelle-des-personnes-handicapees">
        AGEFIPH
      </ExternalLink> et ou le <ExternalLink href="http://www.fiphfp.fr/FAQ/Quelles-aides-financieres-peut-apporter-le-FIPHFP">
        FIPHP
      </ExternalLink> peuvent prendre en charge tout ou une partie du coût
      de votre aménagement. Pensez à le rappeler à votre futur employeur.
    </Trans>,
    title: prepareT("Rassurer l'employeur"),
  },
  {
    content: <Trans parent="span">
      Selon Hanploi&nbsp;:
      <blockquote style={quoteStyle}>
        <p>Une intégration réussie est l'une des clés d'une période d'essai validée.</p>
        <p>
          En cernant davantage vos besoins, votre futur employeur pourra préparer votre intégration
          dans son équipe.
        </p>
        <p>
          Sans dévoiler votre handicap, il pourra justifier de vos pauses, de votre aménagement de
          temps, ou du mobilier mis à votre disposition.
        </p>
        <p>Ainsi vos collègues comprendront.</p>
      </blockquote>
    </Trans>,
    title: prepareT("Préparer son intégration au sein d'une nouvelle équipe"),
  },
] as const


const Needs: React.FC<CardProps> = (props: CardProps) => {
  const {handleExplore, t, t: translate} = props
  const title = <Trans parent={null} t={t} count={tips.length}>
    <GrowingNumber number={tips.length} isSteady={true} /> astuce pour une bonne communication
  </Trans>
  const footer = <HandyLink
    href="https://www.welcometothejungle.co/fr/articles/comment-parler-de-son-etat-de-sante-au-travail"
    linkIntro={t('Conseils généraux sur comment parler de sa santé au travail\u00A0:')}>
    Welcome&nbsp;to&nbsp;the&nbsp;Jungle
  </HandyLink>
  return <MethodSuggestionList title={title} footer={footer}>
    {tips.map(({content, title}, index): ReactStylableElement =>
      <ExpandableAction
        title={translate(...title)} key={index}
        onContentShown={handleExplore('tips')}>
        <div style={contentStyle}>{content}</div>
      </ExpandableAction>)}
  </MethodSuggestionList>
}
const ExpandedAdviceCardContent = React.memo(Needs)


export default {ExpandedAdviceCardContent, Picto}
