import {prepareT as prepareTNoExtract} from 'store/i18n'

import type {Action, Subtitle} from '../types/alternance'

const getSubtitle = (hasHandicap?: boolean): Subtitle => {
  return hasHandicap ? {
    source: 'AGEFIPH 2017',
    text: prepareTNoExtract("En tant que travailleur handicapé, il n'y a pas de limite d'âge " +
      'pour faire une alternance. 53%* des personnes dans une situation proche de la vôtre ont ' +
      "décroché un CDI à la fin d'un contrat de professionnalisation."),
  } : {
    source: '',
    text: prepareTNoExtract("Pour l'alternance, une astuce : d'abord avoir un entretien avec " +
      'une entreprise qui vous intéresse, et ensuite trouver une formation adaptée, en ' +
      'fonction de là où elle se situe.'),
  }
}

const simulatorLink = 'https://www.alternance.emploi.gouv.fr/portail_alternance/jcms/gc_5504/simulateur-employeur' // checkURL
const simulatorName = "Portail de l'alternance"

const getDiscoverAction = (hasHandicap: boolean, isYoung: boolean): Action =>
  hasHandicap ? {
    intro: prepareTNoExtract('Se renseigner\u00A0:'),
    name: prepareTNoExtract("Découvrir l'alternance"),
    text: prepareTNoExtract("Contrat d'Apprentissage"),
    url: 'https://www.service-public.fr/particuliers/vosdroits/F219', // checkURL
  } : isYoung ? {
    intro: prepareTNoExtract('Se renseigner\u00A0:'),
    name: prepareTNoExtract("Découvrir l'alternance"),
    text: prepareTNoExtract("Contrat d'Apprentissage ou Contrat de Professionalisation\u00A0?"),
    url: 'https://www.alternance.emploi.gouv.fr/portail_alternance/jcms/recleader_6113/decouvrir-l-alternance', // checkURL
  } : {
    intro: prepareTNoExtract('Se renseigner\u00A0:'),
    name: prepareTNoExtract('Voir les conditions'),
    text: prepareTNoExtract("Vérifier si c'est pour vous"),
    url: 'https://www.pole-emploi.fr/employeur/le-contrat-de-professionnalisation-@/article.jspz?id=60624', // checkURL
  }

const specificExpendableAction = null
const footer = null

export {getDiscoverAction, footer, getSubtitle, simulatorLink, simulatorName,
  specificExpendableAction}
