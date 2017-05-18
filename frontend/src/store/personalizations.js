// Module to define all personalizations.
import {isYoungAndDiscriminated, isOldAndDiscriminated} from 'store/user'

const hasFrustration = frustration => profile =>
  (profile.frustrations || []).indexOf(frustration) >= 0


const allPersonalizations = {
  ATYPIC_PROFILE: {
    test: hasFrustration('ATYPIC_PROFILE'),
    title: 'Vous nous avez dit ne pas rentrer dans les cases des recruteurs',
  },
  FIRST_JOB_SEARCH: {
    test: ({situation}) => situation === 'FIRST_TIME',
    title: "Vous nous avez dit que c'était votre première recherche d'emploi",
  },
  GRADUATE: {
    test: ({highestDegree}) =>
      highestDegree === 'LICENCE_MAITRISE' || highestDegree === 'DEA_DESS_MASTER_PHD',
    title: 'Vous nous avez dit que vous aviez fait des études supérieures',
  },
  INTERVIEW: {
    test: hasFrustration('INTERVIEW'),
    title: 'Vous nous avez dit que les entretiens étaient un challenge pour vous',
  },
  JUST_STARTED_SEARCHING: {
    test: (profile, {jobSearchLengthMonths}) => jobSearchLengthMonths <= 0,
    title: 'Vous nous avez dit que vous veniez de commencer à postuler',
  },
  LESS_THAN_15_OFFERS: {
    test: (profile, {weeklyOffersEstimate}) =>
      weeklyOffersEstimate && weeklyOffersEstimate !== 'A_LOT',
    title: 'Vous nous avez dit que vous trouviez moins de 15 offres par semaine',
  },
  MOTIVATION: {
    test: hasFrustration('MOTIVATION'),
    title: 'Vous nous avez dit avoir du mal à garder votre motivation au top',
  },
  NEW_JOB: {
    test: (profile, {previousJobSimilarity}) => previousJobSimilarity === 'NEVER_DONE',
    title: "Vous nous avez dit que c'était un nouveau métier pour vous",
  },
  NO_OFFERS: {
    test: hasFrustration('NO_OFFERS'),
    title: "Vous nous avez dit ne pas trouver d'offres correspondant à vos critères",
  },
  NO_OFFER_ANSWERS: {
    test: hasFrustration('NO_OFFER_ANSWERS'),
    title: "Vous nous avez dit que vous n'aviez pas assez de réponses des recruteurs",
  },
  OLD_AGE: {
    test: isOldAndDiscriminated,
    title: 'Vous nous avez dit que votre age pouvait être un obstacle',
  },
  RESUME: {
    test: hasFrustration('RESUME'),
    title: 'Vous nous avez dit avoir du mal à réussir vos CVs et lettres de motivation',
  },
  SAME_JOB: {
    test: (profile, {previousJobSimilarity}) => previousJobSimilarity === 'DONE_THIS',
    title: 'Vous nous avez dit que vous aviez déjà fait ce métier',
  },
  SINGLE_PARENT: {
    test: profile =>
      hasFrustration('SINGLE_PARENT')(profile) ||
      profile.familySituation === 'SINGLE_PARENT_SITUATION',
    title: 'Vous nous avez dit que vous aviez une situation familiale compliquée',
  },
  TIME_MANAGEMENT: {
    test: hasFrustration('TIME_MANAGEMENT'),
    title: 'Vous nous avez dit que vous aviez du mal à gérer votre temps',
  },
  YOUNG_AGE: {
    test: isYoungAndDiscriminated,
    title: 'Vous nous avez dit que les recruteurs vous trouvaient un peu trop jeune',
  },
}


// Filter a list of objects based on personalization. Each item of the list
// must have a field "filters" that contain a list of personalization IDs. If
// none of those personalization match the profile and the project, it is
// filtered. Otherwised the original object is returned augmented by the
// personalization values (e.g. title) from the first personalization
// filter that matched.
function filterPersonalizations(list, profile, project) {
  return list.map(({filters, ...extraInputFields}) => {
    for (let i = 0; i < filters.length; ++i) {
      const {test, ...extraPersonalizationFields} = allPersonalizations[filters[i]]
      if (test(profile, project)) {
        return {
          ...extraPersonalizationFields,
          ...extraInputFields,
        }
      }
    }
    return null
  }).filter(p => !!p)
}


export {filterPersonalizations}
