// Fetch Imilo data from their API.

import {cleanHtmlError, hasErrorStatus} from 'store/http'


async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (hasErrorStatus(response)) {
    // Errors are in HTML, not JSON.
    throw await cleanHtmlError(response)
  }
  return response.json()
}


async function fetchJsonPage<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {Accept: 'application/json, text/javascript, */*; q=0.01'},
  })
  return await handleJsonResponse<T>(response)
}


function getUserPage<T>(page: string, userId: string): Promise<T> {
  return fetchJsonPage(`https://portail.i-milo.fr/records/api/dossier/${userId}/${page}`)
}


interface CoordsPage {
  currentAddress: {
    fullCity: {
      codeCommune: string
      description: string
    }
    zipCode: string
  }
}


function getCoords(userId: string): Promise<CoordsPage> {
  return getUserPage('coordonnees', userId)
}


interface IdentityPage {
  childrenNumber: number
  identity: {
    birthDate: string
    civility: string
    email: string
    firstname: string
    fullCivility: string
    lastname: string
    situation: number
  }
}


function getIdentity(userId: string): Promise<IdentityPage> {
  return getUserPage('identite', userId)
}


interface MobilityPage {
  drivingLicenses: readonly {type: number}[]
  fullRadiusMobility: string
  radiusMobility: number
}


function getMobility(userId: string): Promise<MobilityPage> {
  return getUserPage('mobilite', userId)
}


export type CursusPage = readonly {
  fullAcademicLevel: string
  grade: number
}[]


function getDegrees(userId: string): Promise<CursusPage> {
  return fetchJsonPage(`https://portail.i-milo.fr/records/api/degreecourse/record/${userId}`)
}


interface ImiloJob {
  code: string
  description: string
}


export type SituationsPage = readonly {
  fullPracticedJob?: ImiloJob
  fullPreparedJob?: ImiloJob
}[]


function getSituations(userId: string): Promise<SituationsPage> {
  return fetchJsonPage(`https://portail.i-milo.fr/records/api/situation/dossier/${userId}`)
}


export interface ImiloProps {
  'Coordonnées': CoordsPage
  'Cursus': CursusPage
  'Identité': IdentityPage
  'Mobilité': MobilityPage
  'Situations': SituationsPage
}


export {getCoords, getDegrees, getIdentity, getMobility, getSituations}
