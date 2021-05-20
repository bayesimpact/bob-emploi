// Non-default exports are for test purposes only.
import {createTask, getCounselorInfo, getDossierId, getPolicies, getUserInfo} from './api'

declare global {
  interface Window {
    App: IMiloJsApp
  }
}

const padDate = (date: number) => `0${date}`.slice(-2)
// Format a JS Date in JJ/MM/YYYY format.
const formatDate = (date: Date): string => [
  padDate(date.getDate()),
  padDate(date.getMonth() + 1),
  date.getFullYear(),
].join('/')


interface TypeformFields {
  // Typeform doesn't allow upper-case letters in their hidden fields.
  /* eslint-disable camelcase */
  age?: number
  counselor_email: string
  counselor_id: number
  current_policies: string
  dossier_id: number
  referent_id?: number
  school_level?: string
  structure_id?: number
  /* eslint-enable camelcase */
}

export const makePoliciesString = (policies: readonly PolicyInfo[]): string => policies.
  filter(({status}) => status === 'RUNNING').
  map(({policy: {name}}) => name.replace(' ', '-')).
  sort().
  join(',')


export const getTypeformFields = (
  user: UserInfo,
  counselor: CounselorInfo,
  policies: readonly PolicyInfo[],
): TypeformFields => {
  const {fullReferent, fullSchoolLevel, id: dossierId, identity, structure} = user
  const {birthDate} = identity || {}
  const age = birthDate && (new Date().getFullYear() - Number.parseInt(birthDate.split('/')[2]))

  const {email, id: counselorId} = counselor

  return {
  // Typeform doesn't allow upper-case letters in their hidden fields.
  /* eslint-disable camelcase */
    age: age || undefined,
    counselor_email: email,
    counselor_id: counselorId,
    current_policies: makePoliciesString(policies),
    dossier_id: dossierId,
    referent_id: fullReferent?.id || undefined,
    school_level: fullSchoolLevel?.code || undefined,
    structure_id: structure || undefined,
  /* eslint-enable camelcase */
  }
}


// Bookmarklet action. Does the following:
//    - Fetch all the relevant information from i-milo
//    - Redirect to the MILOrizon Typeform with the relevant information attached
//    - Keep a trace of the transaction in the young person's dossier in i-milo.
export default async (): Promise<void> => {
  const dossierId = getDossierId()
  const [userInfo, counselorInfo, policies] = await Promise.all([
    getUserInfo(dossierId), getCounselorInfo(), getPolicies(dossierId)])
  const typeformUrl = new URL(config.typeformUrl)
  const typeformFields = getTypeformFields(userInfo, counselorInfo, policies)
  for (const [key, value] of Object.entries(typeformFields)) {
    if (value) {
      typeformUrl.searchParams.set(key, value.toString())
    }
  }
  window.open(typeformUrl.href, '_blank')

  const deadLine = new Date()
  deadLine.setMonth(deadLine.getMonth() + config.reminderDelayMonths)
  createTask({
    // TODO(cyrille): Replace with an API call.
    adminStructure: window.App.Security.structureId,
    content: `Refaire le point sur l'autonomie avec ${config.productName}`,
    deadLine: formatDate(deadLine),
    linkObjectId: Number.parseInt(dossierId),
    title: config.productName,
    userId: counselorInfo.id,
  })
}
