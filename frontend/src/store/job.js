// Genderize a job name.
function genderizeJob(job, gender) {
  if (!job || Object.keys(job).length === 0) {
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

// Return url for job name search.
function getJobSearchURL(job, gender) {
  if (!job || Object.keys(job).length === 0) {
    return ''
  }
  const searchTerms = encodeURIComponent('métier ' + genderizeJob(job, gender))
  return `https://www.google.fr/search?q=${searchTerms}`
}


// Return URL to access the IMT.
function getIMTURL(job, city) {
  if (!job || !job.codeOgr || !city || !city.departementId) {
    return ''
  }
  return 'http://candidat.pole-emploi.fr/marche-du-travail/statistiques?' +
    `codeMetier=${job.codeOgr}&` +
    `codeZoneGeographique=${city.departementId}&typeZoneGeographique=DEPARTEMENT`
}


// From departement stats, find a list of situation in different departements.
// For instance, it will return: [
//   {'inDepartement': 'en Savoie', 'jobGroup': 'Hôtellerie'},
//   {'inDepartement': 'en Haute Savoie', 'jobGroup': 'Animation sportive'},
// ]
function getJobPlacesFromDepartementStats(departementStats) {
  const seenRomes = new Set()
  const jobPlaces = []
  const nbDep = departementStats.length
  const currentJobGroupForDep = departementStats.map(unusedDep => 0)
  for (let i = 0; i < 8; ++i) {
    const depIndex = i % nbDep
    const dep = departementStats[i % nbDep]
    const {jobGroups} = departementStats[depIndex]
    while (currentJobGroupForDep[depIndex] < jobGroups.length - 1 &&
      seenRomes.has(jobGroups[currentJobGroupForDep[depIndex]].romeId)) {
      currentJobGroupForDep[depIndex]++
    }
    if (currentJobGroupForDep[depIndex] >= jobGroups.length) {
      continue
    }
    const jobGroup = jobGroups[currentJobGroupForDep[depIndex]]
    seenRomes.add(jobGroup.romeId)
    jobPlaces.push({'inDepartement': dep.departementInName, 'jobGroup': jobGroup.name})
  }
  return jobPlaces
}

export {genderizeJob, getIMTURL, getJobSearchURL, getJobPlacesFromDepartementStats}
