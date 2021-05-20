import {TFunction} from 'i18next'
import _uniqWith from 'lodash/uniqWith'
import {stringify} from 'query-string'

import {LocalizableString, prepareT} from 'store/i18n'

// Genderize a job name.
function genderizeJob(job?: bayes.bob.Job, gender?: bayes.bob.Gender): string {
  if (!job) {
    return ''
  }
  if (gender === 'FEMININE') {
    return job.feminineName || job.name || ''
  }
  if (gender === 'MASCULINE') {
    return job.masculineName || job.name || ''
  }
  return job.name || ''
}

// Return url for job name search.
function getJobSearchURL(
  t: TFunction, job?: bayes.bob.Job, gender?: bayes.bob.Gender): string {
  if (!job || Object.keys(job).length === 0) {
    return ''
  }
  const searchTerms = encodeURIComponent(
    `${t('métier', {ns: 'translation'})} ${genderizeJob(job, gender)}`,
  )
  return `https://${config.googleTopLevelDomain}/search?q=${searchTerms}`
}

// Return url for job name search.
function getJobGroupSearchURL(t: TFunction, jobGroup?: bayes.bob.JobGroup): string {
  if (!jobGroup?.name) {
    return ''
  }
  const searchTerms = encodeURIComponent(
    `${t('métier', {ns: 'translation'})} ${jobGroup?.name}`,
  )
  return `https://${config.googleTopLevelDomain}/search?q=${searchTerms}`
}


// Return URL to access the IMT.
function getIMTURL(
  interpolate: TFunction,
  job?: {codeOgr?: string},
  city?: {departementId?: string},
): string {
  if (!job || !job.codeOgr || !city || !city.departementId) {
    return ''
  }
  try {
    return interpolate(config.externalLmiUrl, {
      codeOgr: job.codeOgr,
      departementId: city.departementId,
    })
  } catch {
    return ''
  }
}


const arrondissementPatch: {[cityId: string]: {lieux: string; rayon?: number} | undefined} = {
  13_055: {lieux: '13201', rayon: 20},
  69_123: {lieux: '69381'},
  75_056: {lieux: '75D'},
}
function getPEJobBoardURL(
  {jobGroup: {name = '', romeId = ''} = {}, name: jobName = ''}: bayes.bob.Job = {},
  {cityId = ''}: bayes.bob.FrenchCity = {},
  otherParams?: Record<string, string|number>): string {
  if (!cityId || !(romeId || name || jobName)) {
    return ''
  }
  return `https://candidat.pole-emploi.fr/offres/recherche?${stringify({
    lieux: cityId,
    motsCles: romeId || name || jobName,
    ...arrondissementPatch[cityId],
    ...otherParams,
  })}`
}

function getGoogleJobSearchUrl(t: TFunction, jobName?: string): string {
  const queryTerms = [t("offres d'emploi", {ns: 'translation'})]
  if (jobName) {
    queryTerms.push(jobName)
  }
  const query = queryTerms.join(' ')
  return `https://${config.googleTopLevelDomain}/search?q=${encodeURIComponent(query)}&ibp=htl;jobs&sa=X`
}


interface JobPlaces {
  inDepartement: string
  jobGroup: string
}


type StatsList = readonly bayes.bob.MonthlySeasonalDepartementStats[]
// From departement stats, find a list of situation in different departements.
// For instance, it will return: [
//   {'inDepartement': 'en Savoie', 'jobGroup': 'Hôtellerie'},
//   {'inDepartement': 'en Haute Savoie', 'jobGroup': 'Animation sportive'},
// ]
function getJobPlacesFromDepartementStats(departementStats: StatsList): readonly JobPlaces[] {
  if (!departementStats || !departementStats.length) {
    return []
  }
  const maxRepeat = Math.ceil(8 / departementStats.length)
  // Keep the first 8 departements, possibly looping back to the first if there are less.
  const allPossible = Array.from<StatsList>({length: maxRepeat}).fill(departementStats).flat().
    slice(0, 8).
    flatMap(({departementInName = '', jobGroups = []}, index) =>
      jobGroups.map(({name = '', romeId}) => ({
        inDepartement: departementInName,
        index,
        jobGroup: name,
        romeId,
      })))
  const keptValues = _uniqWith(
    allPossible, (({index, romeId}, {index: otherIndex, romeId: otherRome}) =>
      // Drop a JobPlace if it's in the same departement or in the same job group as a previous one.
      index === otherIndex || romeId === otherRome))
  return keptValues.map(({inDepartement, jobGroup}) => ({inDepartement, jobGroup}))
}


function missionLocaleUrl(
  translate: TFunction,
  missionLocaleData?: bayes.bob.MissionLocaleData, departementName?: string): string {
  return missionLocaleData && missionLocaleData.agenciesListLink ||
      `https://${config.googleTopLevelDomain}/search?q=${
        encodeURIComponent(`{translate('mission locale'} ${departementName || ''}`)}`
}

const _APPLICATION_MODES: {[mode in bayes.bob.ApplicationMode]: LocalizableString} = {
  OTHER_CHANNELS: prepareT('Autre canal (réponse à une offre, concours, salon, ...)'),
  PERSONAL_OR_PROFESSIONAL_CONTACTS: prepareT('Réseau personnel ou professionnel'),
  PLACEMENT_AGENCY: prepareT('Agence de recrutement'),
  SPONTANEOUS_APPLICATION: prepareT('Candidature spontanée'),
  UNDEFINED_APPLICATION_MODE: prepareT('Réponse à une offre'),
} as const


// TODO(cyrille): Try and find the most relevant FAP for a given job in the job group.
function getApplicationModes(jobGroup: bayes.bob.JobGroup): readonly bayes.bob.ModePercentage[] {
  return (Object.values(jobGroup.applicationModes || {})[0] || {}).modes || []
}


function getApplicationModeText(translate: TFunction, mode?: bayes.bob.ApplicationMode): string {
  return translate(..._APPLICATION_MODES[mode || 'UNDEFINED_APPLICATION_MODE'])
}


// Keep in increasing order, for the ApplicationWaffleChart in stats_charts.
const weeklyApplicationOptions = [
  {name: prepareT('0 ou 1 candidature par semaine'), value: 'LESS_THAN_2'},
  {name: prepareT('2 à 5 candidatures par semaine'), value: 'SOME'},
  {name: prepareT('6 à 15 candidatures par semaine'), value: 'DECENT_AMOUNT'},
  {name: prepareT('Plus de 15 candidatures par semaine'), value: 'A_LOT'},
] as const


const weeklyOfferOptions: readonly {
  name: LocalizableString
  value: bayes.bob.NumberOfferEstimateOption
}[] = [
  {name: prepareT('0 ou 1 offre intéressante par semaine'), value: 'LESS_THAN_2'},
  {name: prepareT('2 à 5 offres intéressantes par semaine'), value: 'SOME'},
  {name: prepareT('6 à 15 offres intéressantes  par semaine'), value: 'DECENT_AMOUNT'},
  {name: prepareT('Plus de 15 offres intéressantes par semaine'), value: 'A_LOT'},
] as const


// Get the lowest diploma needed to reach percent% of the diplomas
function getMostlyRequiredDiploma(
  diplomas: readonly bayes.bob.JobRequirement[], percent = 50): bayes.bob.JobRequirement {
  const requiredDiplomas: bayes.bob.JobRequirement[] = []
  const sum = diplomas.reduce((acc, diploma): number => acc + (diploma.percentRequired || 0), 0)
  diplomas.reduce((acc, diploma): number => {
    // TODO (émilie): Update for a functional or imperative style coding (not both).
    if (acc < percent || (sum > 0 && requiredDiplomas.length === 0)) {
      requiredDiplomas.push(diploma)
    }
    return acc + (diploma.percentRequired || 0)
  }, 100 - sum)
  return requiredDiplomas[requiredDiplomas.length - 1]
}

export {genderizeJob, getIMTURL, getJobSearchURL, missionLocaleUrl, getApplicationModes,
  getJobPlacesFromDepartementStats, getApplicationModeText, getMostlyRequiredDiploma,
  getPEJobBoardURL, weeklyApplicationOptions, weeklyOfferOptions, getGoogleJobSearchUrl,
  getJobGroupSearchURL,
}

