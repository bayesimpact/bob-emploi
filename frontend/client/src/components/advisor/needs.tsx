import PropTypes from 'prop-types'
import _memoize from 'lodash/memoize'
import React from 'react'

import {YouChooser} from 'store/french'

import {ExternalLink, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-needs.svg'

import {ExpandableAction, HandyLink, MethodSuggestionList, CardProps} from './base'

interface Tip {
  content: React.ReactElement
  title: string
}

const contentStyle = {
  lineHeight: 1.5,
}

const quoteStyle = {
  borderLeft: `3px solid ${colors.MODAL_PROJECT_GREY}`,
  paddingLeft: 10,
}

const getTips = _memoize((userYou: YouChooser): readonly Tip[] => [
  {
    content: <span>
      <p>
        Un recruteur averti {userYou('te', 'vous')} posera la question&nbsp;: "êtes-vous
        bénéficiaire de la loi 2005 ou avez vous une RQTH&nbsp;?"
      </p>
      <p>
        La question "avez-vous besoin d'un aménagement de poste&nbsp;?" suivra.
      </p>
      <p>
        Si cette question ne {userYou("t'", 'vous ')}est pas posée, {userYou('tu ', 'vous êt')}es en
        droit de ne pas en parler.
      </p>
    </span>,
    title: 'Connaître ses droits',
  },
  {
    content: <span>
      Selon Hanploi,
      <blockquote style={quoteStyle}>
        <p>
          Par expérience, il est préférable d'évoquer son handicap avant de signer son contrat de
          travail.
        </p>
        <p>
          Aujourd'hui {userYou("tu n'as", "vous n'avez")} peut-être pas besoin d'un aménagement de
          poste, mais demain&nbsp;?
        </p>
      </blockquote>
    </span>,
    title: 'Prioriser sa santé et son confort avant tout',
  },
  {
    // TODO(cyrille): Add tabs for each disability.
    content: <span>
      Hanploi nous conseille&nbsp;:
      <blockquote style={quoteStyle}>
        <p>
          Qui {userYou('te', 'vous')} connait mieux que {userYou('toi', 'vous')}-même&nbsp;?
          {userYou(' Tu ', ' Vous êt')}es donc en mesure d'en parler&nbsp;! Pas de langue de bois
          si {userYou('tu as', 'vous avez')} besoin d'aménagement de poste.
        </p>
        <p>
          Mais n'entre{userYou('', 'z')} pas dans le détail de {userYou('ton', 'votre')} handicap
          cela ne regarde que {userYou('toi', 'vous')}&nbsp;!
        </p>
        <p>
          Pose{userYou('-toi', 'z-vous')} les bonnes questions par rapport au poste
          que {userYou('tu vises', 'vous visez')}.
        </p>
      </blockquote>
    </span>,
    title: "Se poser les bonnes questions avant de parler à l'employeur",
  },
  {
    content: <span>
      L'<ExternalLink href="https://www.agefiph.fr/aides-handicap/aide-laccueil-lintegration-et-levolution-professionnelle-des-personnes-handicapees">
        AGEFIPH
      </ExternalLink> et ou le <ExternalLink href="http://www.fiphfp.fr/FAQ/Quelles-aides-financieres-peut-apporter-le-FIPHFP">
        FIPHP
      </ExternalLink> peuvent prendre en charge tout ou une partie du coût
      de {userYou('ton', 'votre')} aménagement. Pense{userYou('', 'z')} à le rappeler
      à {userYou('ton', 'votre')} futur employeur.
    </span>,
    title: "Rassurer l'employeur",
  },
  {
    content: <span>
      Selon Hanploi&nbsp;:
      <blockquote style={quoteStyle}>
        <p>Une intégration réussie est l'une des clés d'une période d'essai validée.</p>
        <p>
          En cernant davantage {userYou('tes', 'vos')} besoins, {userYou('ton', 'votre')} futur
          employeur pourra préparer {userYou('ton', 'votre')} intégration dans son équipe.
        </p>
        <p>
          Sans dévoiler {userYou('ton', 'votre')} handicap, il pourra justifier
          de {userYou('tes', 'vos')} pauses, de {userYou('ton', 'votre')} aménagement de temps, ou
          du mobilier mis à {userYou('ta', 'votre')} disposition.
        </p>
        <p>Ainsi {userYou('tes', 'vos')} collègues comprendront.</p>
      </blockquote>
    </span>,
    title: "Préparer son intégration au sein d'une nouvelle équipe",
  },
])


const FOOTER = <HandyLink
  href="https://www.welcometothejungle.co/fr/articles/comment-parler-de-son-etat-de-sante-au-travail"
  linkIntro="Conseils généraux sur comment parler de sa santé au travail&nbsp;:">
  Welcome&nbsp;to&nbsp;the&nbsp;Jungle
</HandyLink>


const Needs: React.FC<CardProps> = (props: CardProps) => {
  const {handleExplore, userYou} = props
  const tips = getTips(userYou)
  const title = <React.Fragment>
    <GrowingNumber number={tips.length} isSteady={true} /> astuce{tips.length > 1 ? 's' : ''} pour
    une bonne communication
  </React.Fragment>
  return <MethodSuggestionList title={title} footer={FOOTER}>
    {tips.map(({content, title}, index): ReactStylableElement =>
      <ExpandableAction
        isMethodSuggestion={true} title={title} key={index}
        onContentShown={handleExplore('tips')}>
        <div style={contentStyle}>{content}</div>
      </ExpandableAction>)}
  </MethodSuggestionList>
}
Needs.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(Needs)


export default {ExpandedAdviceCardContent, Picto}
