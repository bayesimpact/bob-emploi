// Genderize a job name.
function genderizeJob(job, gender) {
  if (!job) {
    return ''
  }
  if (gender === 'FEMININE') {
    return job.feminineName || job.name
  }
  if (gender === 'MASCULINE') {
    return job.masculineName || job.name
  }
  return job.name
}


function poleEmploiJobOffersUrl({departementId, jobGroupId}) {
  // Testing several parameters in the advanced search of the Pole Emploi
  // website, it seems that the URL is a long concatenation of parameters
  // separated by underscores. There are 40 parameters (or 39 separators) and
  // we use only few of them, see below.
  // TODO(pascal): Explore the other paramaters below when needed.

  const params = new Array(40)
  // Unknown A.
  params[0] = 'A'

  // 1: Job name free form search

  // Type of location filter (e.g. COMMUNE, DEPARTEMENT).
  params[2] = 'DEPARTEMENT'

  // Code of the location area (e.g. post code, departement ID).
  params[3] = departementId

  // 4: Distance (in km) from location.

  // Unknown P.
  params[6] = 'P'

  // Probably contract type.
  params[16] = 'INDIFFERENT'

  params[33] = jobGroupId

  return 'https://candidat.pole-emploi.fr/candidat/rechercheoffres/resultats/' + params.join('_')
}


export {genderizeJob, poleEmploiJobOffersUrl}
