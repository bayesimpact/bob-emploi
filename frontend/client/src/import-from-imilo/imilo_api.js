// Fetch Imilo data from their API.


function cleanHtmlError(htmlErrorPage) {
  const page = document.createElement('html')
  page.innerHTML = htmlErrorPage
  const content = page.getElementsByTagName('U')
  return content.length && content[content.length - 1].textContent || page.textContent
}


function handleJsonResponse(response) {
  // Errors are in HTML, not JSON.
  if (response.status >= 400 || response.status < 200) {
    return response.text().then(errorMessage => {
      throw cleanHtmlError(errorMessage)
    })
  }
  return response.json()
}


function fetchJsonPage(url) {
  return fetch(url, {
    credentials: 'same-origin',
    headers: {Accept: 'application/json, text/javascript, */*; q=0.01'},
  }).then(handleJsonResponse)
}


function getUserPage(page, userId) {
  return fetchJsonPage(`https://portail.i-milo.fr/records/api/dossier/${userId}/${page}`)
}


function getCoords(userId) {
  return getUserPage('coordonnees', userId)
}


function getIdentity(userId) {
  return getUserPage('identite', userId)
}


function getMobility(userId) {
  return getUserPage('mobilite', userId)
}


function getDegrees(userId) {
  return fetchJsonPage(`https://portail.i-milo.fr/records/api/degreecourse/record/${userId}`)
}


function getSituations(userId) {
  return fetchJsonPage(`https://portail.i-milo.fr/records/api/situation/dossier/${userId}`)
}


export {getCoords, getDegrees, getIdentity, getMobility, getSituations}
