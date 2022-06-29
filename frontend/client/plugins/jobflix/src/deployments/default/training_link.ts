import {getFixedT} from 'i18next'

// FIXME(émilie): Resolve this using some code-deployment specific.
const SCOTLAND_REGION_ID = 'S92000003'
const scotlandTrainingLink = 'https://www.myworldofwork.co.uk/learn-and-train/course/search?search={{jobName}}&loc={{cityName}}&rad=20' // checkURL

// TODO(cyrille): Use this for CPF too.
export default (job: ValidUpskillingJob, city: bayes.bob.FrenchCity): Promise<string> => {
  const interpolate = getFixedT(config.defaultLang)
  const {jobGroup: {romeId, samples: [{name: jobName = ''} = {}] = []} = {}} = job
  const {cityId, departementId, latitude, longitude, name: cityName = '', regionId} = city

  const trainingLinkTemplate = regionId === SCOTLAND_REGION_ID ? scotlandTrainingLink :
    config.trainingLinkTemplate

  // i18next-extract-disable-next-line
  return Promise.resolve(interpolate(trainingLinkTemplate, {
    cityId,
    cityName: encodeURIComponent(cityName),
    departementId,
    jobName: encodeURIComponent(jobName),
    latitude,
    longitude,
    romeId,
  }))
}
