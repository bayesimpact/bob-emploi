import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {GrowingNumber, ExternalLink} from 'components/theme'
import Picto from 'images/advices/picto-better-job-in-group.svg'

import {ActionWithHandyLink, CardProps, DataSource, ExpandableAction,
  MethodSuggestionList} from './base'

const HANDICAP_HIRING_LINK = 'https://www.agefiph.fr/articles/conseil-pratiques/pourquoi-recruter-une-personne-handicapee-5-bonnes-raisons'

const shortSourceMarginStyle = {
  margin: '15px 0 0',
}
const argumentStyle = {
  borderLeft: `2px solid ${colors.MODAL_PROJECT_GREY}`,
  margin: '10px 0',
  paddingLeft: 10,
}

const AlternanceMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, profile: {hasHandicap, yearOfBirth}, userYou} = props
  const isYoung = yearOfBirth && (yearOfBirth >= new Date().getFullYear() - 30)
  const handleClick = useMemo(() => handleExplore('tip'), [handleExplore])
  const title = <React.Fragment>
    <GrowingNumber number={4} /> étapes pour démarrer une
    recherche {isYoung ? "d'emploi en alternance" : 'de contrat de professionalisation'}
  </React.Fragment>
  const subtitle = hasHandicap ? <span>
    En tant que travailleur handicapé, il n'y a pas de limite d'âge pour faire une alternance.
    53%* des personnes dans une situation proche de la vôtre ont décroché un CDI à la fin d'un
    contrat de professionnalisation.
    <DataSource style={shortSourceMarginStyle}>AGEFIPH 2017</DataSource>
  </span> : <span>
    C'est une fois que l'on a obtenu un entretien chez un employeur que l'on
    sait exactement de quel type de formation on aurait besoin, et dans quelle ville. Commencer
    par trouver l'entreprise, plutôt que de chercher son centre de formation, augmente ses
    chances de réussir.
  </span>
  return <MethodSuggestionList title={title} headerContent={subtitle}>
    {hasHandicap ? <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName="Découvrir l'alternance" linkIntro="Se renseigner&nbsp;:"
      discoverUrl="https://www.service-public.fr/particuliers/vosdroits/F219">
      Contrat d'Apprentissage
    </ActionWithHandyLink> : isYoung ? <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName="Découvrir l'alternance" linkIntro="Se renseigner&nbsp;:"
      discoverUrl="https://www.alternance.emploi.gouv.fr/portail_alternance/jcms/recleader_6113/decouvrir-l-alternance">
      Contrat d'Apprentissage ou Contrat de Professionalisation&nbsp;?
    </ActionWithHandyLink> : <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName="Voir les conditions" linkIntro="Se renseigner&nbsp;:"
      discoverUrl="https://www.pole-emploi.fr/employeur/le-contrat-de-professionnalisation-@/article.jspz?id=60624">
      Vérifier si c'est pour {userYou('toi', 'vous')}
    </ActionWithHandyLink>}
    <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName="Portail de l'alternance" linkIntro="Simulateur&nbsp;:"
      discoverUrl="https://www.alternance.emploi.gouv.fr/portail_alternance/jcms/gc_5504/simulateur-employeur">
      Simule{userYou(' ta', 'z votre')} rémunération
    </ActionWithHandyLink>
    <ExpandableAction
      title={`Identifie${userYou('', 'z')} 3 débouchés possibles d'une formation `}
      contentName="comment" onContentShown={handleClick} isMethodSuggestion={true}>
      <div>
        Pour donner une impression de professionnalisme,
        lorsque {userYou('tu contactes', 'vous contactez')} une entreprise pour une alternance,
        so{userYou('is', 'yez')} clair sur le poste que {userYou('tu vises', 'vous visez')}.
        Par exemple, si {userYou('tu veux', 'vous voulez')} faire un BTS Management, ne
        demande{userYou('', 'z')} pas simplement une "alternance en Management".
        Renseigne{userYou('-toi', 'z-vous')} d'abord sur les intitulés de poste qui sont proposés
        en alternance&nbsp;: conseiller commercial&nbsp;? Chargé de clientèle&nbsp;? Attaché à la
        direction commerciale&nbsp;?
      </div>
    </ExpandableAction>
    <ExpandableAction
      title={`Prépare${userYou('', 'z')} que dire à l'entreprise`} isMethodSuggestion={true}
      contentName="un exemple d'argumentation"
      onContentShown={handleClick}>
      <div>
        Un employeur qui {userYou("t'", 'vous ')}intéresse peut répondre "non" pour un recrutement
        en alternance, parce qu'il ne connaît pas bien les conditions de ce type de contrat. Voici
        quelques arguments à lui donner&nbsp;:
        <p style={argumentStyle}>
          Il y a plusieurs avantages pour l'entreprise à recruter en alternance. Par exemple,
          pour un contrat d'apprentissage, l'employeur ne paie pas de cotisations sociales.
          L'entreprise peut aussi bénéficier une prime de 1000 euros minimum, et des crédits
          d'impôts.
        </p>
        <p style={argumentStyle}>
          Par ailleurs, 6 alternants sur 10 sont recrutés à la suite de l'alternance, donc c'est
          un peu comme une longue période d'essai, sans engagement pour l'entreprise de poursuivre
          à la fin des 12 ou 24 mois. Le salaire est fixe à un montant près du SMIC.
        </p>
        <p style={argumentStyle}>
          Avec une alternance, vous me formerez précisément à vos méthodes de travail et aux
          compétences spécifiques à ce poste. Je serai utile plus rapidement que si je devais
          m'adapter depuis un poste précédent.
          J'ai déjà sélectionné des formations qui me semblent adaptées mais s'il y a des
          formations que vous recommanderiez… Ma priorité, c'est d'intégrer votre entreprise.
        </p>
        {hasHandicap ? <p style={argumentStyle}>
          Je me permets de vous envoyer par mail une liste de 5 bonnes raisons&nbsp;:{' '}
          <ExternalLink href={HANDICAP_HIRING_LINK}>{HANDICAP_HIRING_LINK}</ExternalLink>
        </p> : null}
      </div>
    </ExpandableAction>
  </MethodSuggestionList>
}
AlternanceMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  profile: PropTypes.shape({
    hasHandicap: PropTypes.bool,
    yearOfBirth: PropTypes.number.isRequired,
  }).isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(AlternanceMethod)


export default {ExpandedAdviceCardContent, Picto}
