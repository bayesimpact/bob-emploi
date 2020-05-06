import {TOptions} from 'i18next'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {Trans} from 'components/i18n'
import {DataSource, GrowingNumber, ExternalLink} from 'components/theme'
import Picto from 'images/advices/picto-better-job-in-group.svg'

import {ActionWithHandyLink, CardProps, ExpandableAction, MethodSuggestionList} from './base'

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
  const {handleExplore, profile: {gender, hasHandicap, yearOfBirth}, t} = props
  const isYoung = yearOfBirth && (yearOfBirth >= new Date().getFullYear() - 30)
  const handleClick = useMemo(() => handleExplore('tip'), [handleExplore])
  const title = isYoung ?
    <Trans parent={null} t={t}>
      <GrowingNumber number={4} /> étapes pour démarrer une recherche d'emploi en alternance
    </Trans> :
    <Trans parent={null} t={t}>
      <GrowingNumber number={4} /> étapes pour démarrer une recherche de contrat de
      professionalisation
    </Trans>
  const subtitle = hasHandicap ? <Trans parent="span" t={t}>
    En tant que travailleur handicapé, il n'y a pas de limite d'âge pour faire une
    alternance. 53%* des personnes dans une situation proche de la vôtre ont décroché un CDI
    à la fin d'un contrat de professionnalisation.
    <DataSource style={shortSourceMarginStyle}>AGEFIPH 2017</DataSource>
  </Trans> : <Trans parent="span" t={t}>
    C'est une fois que l'on a obtenu un entretien chez un employeur que l'on sait exactement de quel
    type de formation on aurait besoin, et dans quelle ville. Commencer par trouver l'entreprise,
    plutôt que de chercher son centre de formation, augmente ses chances de réussir.
  </Trans>
  const tOptions = useMemo((): TOptions => ({context: gender}), [gender])
  return <MethodSuggestionList title={title} headerContent={subtitle}>
    {hasHandicap ? <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName={t("Découvrir l'alternance")} linkIntro={t('Se renseigner\u00A0:')}
      discoverUrl="https://www.service-public.fr/particuliers/vosdroits/F219">
      {t("Contrat d'Apprentissage")}
    </ActionWithHandyLink> : isYoung ? <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName={t("Découvrir l'alternance")} linkIntro={t('Se renseigner\u00A0:')}
      discoverUrl="https://www.alternance.emploi.gouv.fr/portail_alternance/jcms/recleader_6113/decouvrir-l-alternance">
      {t("Contrat d'Apprentissage ou Contrat de Professionalisation\u00A0?")}
    </ActionWithHandyLink> : <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName={t('Voir les conditions')} linkIntro={t('Se renseigner\u00A0:')}
      discoverUrl="https://www.pole-emploi.fr/employeur/le-contrat-de-professionnalisation-@/article.jspz?id=60624">
      {t("Vérifier si c'est pour vous")}
    </ActionWithHandyLink>}
    <ActionWithHandyLink
      isNotClickable={true} onClick={handleClick}
      linkName={t("Portail de l'alternance")} linkIntro={t('Simulateur\u00A0:')}
      discoverUrl="https://www.alternance.emploi.gouv.fr/portail_alternance/jcms/gc_5504/simulateur-employeur">
      {t('Simulez votre rémunération')}
    </ActionWithHandyLink>
    <ExpandableAction
      title={t("Identifiez 3 débouchés possibles d'une formation")}
      contentName={t('comment')} onContentShown={handleClick} isMethodSuggestion={true}>
      <Trans t={t} tOptions={tOptions}>
        Pour donner une impression de professionnalisme, lorsque vous contactez une entreprise
        pour une alternance, soyez clair·e sur le poste que vous visez. Par exemple, si vous
        voulez faire un BTS Management, ne demandez pas simplement une "alternance en
        Management". Renseignez-vous d'abord sur les intitulés de poste qui sont proposés en
        alternance&nbsp;: conseiller·e commercial·e&nbsp;? Chargé·e de clientèle&nbsp;?
        Attaché·e à la direction commerciale&nbsp;?
      </Trans>
    </ExpandableAction>
    <ExpandableAction
      title={t("Préparez que dire à l'entreprise")} isMethodSuggestion={true}
      contentName={t("un exemple d'argumentation")}
      onContentShown={handleClick}>
      <div>
        <Trans parent="null" t={t}>
          Un employeur qui vous intéresse peut répondre "non" pour un recrutement en alternance,
          parce qu'il ne connaît pas bien les conditions de ce type de contrat. Voici quelques
          arguments à lui donner&nbsp;:
        </Trans>
        <Trans parent="p" style={argumentStyle} t={t}>
          Il y a plusieurs avantages pour l'entreprise à recruter en alternance. Par exemple,
          pour un contrat d'apprentissage, l'employeur ne paie pas de cotisations sociales.
          L'entreprise peut aussi bénéficier une prime de 1000 euros minimum, et des crédits
          d'impôts.
        </Trans>
        <Trans parent="p" style={argumentStyle} t={t}>
          Par ailleurs, 6 alternants sur 10 sont recrutés à la suite de l'alternance, donc
          c'est un peu comme une longue période d'essai, sans engagement pour l'entreprise de
          poursuivre à la fin des 12 ou 24 mois. Le salaire est fixe à un montant près du SMIC.
        </Trans>
        <Trans parent="p" style={argumentStyle} t={t}>
          Avec une alternance, vous me formerez précisément à vos méthodes de travail et aux
          compétences spécifiques à ce poste. Je serai utile plus rapidement que si je devais
          m'adapter depuis un poste précédent. J'ai déjà sélectionné des formations qui me
          semblent adaptées mais s'il y a des formations que vous recommanderiez… Ma priorité,
          c'est d'intégrer votre entreprise.
        </Trans>
        {hasHandicap ? <p style={argumentStyle}>
          {t('Je me permets de vous envoyer par mail une liste de 5 bonnes raisons\u00A0:')}{' '}
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
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(AlternanceMethod)


export default {ExpandedAdviceCardContent, Picto}
