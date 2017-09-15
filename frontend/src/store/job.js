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

// Return url for job name search.
function getJobSearchURL(job, gender) {
  if (!job) {
    return ''
  }
  const searchTerms = encodeURIComponent('métier ' + genderizeJob(job, gender))
  return `https://www.google.fr/search?q=${searchTerms}`
}

export {genderizeJob, getJobSearchURL}
