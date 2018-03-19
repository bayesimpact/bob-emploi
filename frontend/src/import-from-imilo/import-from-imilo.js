import {getImiliPropsFromDomTree} from './imilo_dom'
import {convertImiloPropsToBobProps} from './imilo'


function loadDom(url) {
  const pageToFetchIsCurrentPage = url === window.location.href
  if (pageToFetchIsCurrentPage) {
    // If the url to load in an iFrame is the one of the current window, we don't need to
    // load an iFrame and can simply use the current window. Note that browsers forbid to load
    // an iFrame with the same url in order to prevent infinite recursions.
    return window
  }
  return new Promise(resolve => {
    const iFrame = document.createElement('iframe')
    iFrame.style.display = 'none'
    iFrame.onload = function() {
      resolve(iFrame.contentWindow)
      iFrame.parentNode.removeChild(iFrame)
    }
    iFrame.src = url
    document.body.appendChild(iFrame)
  })
}


function getImiloPropsFromAllPages(onPageComplete) {
  // Get all the URLs that contains part of the i-milo user data (user 'Dossier').
  const pageLinks = document.querySelectorAll('li.dossier a.recordLink')
  const pageUrls = Array.prototype.map.call(pageLinks, pageLink => pageLink.href)

  // On each page collect the i-milo user data.
  const imiloPropsFromAllPages = {}
  // Chain loading all pages one after the other.
  return pageUrls.reduce((iterateOverPreviousPages, pageUrl) => iterateOverPreviousPages.
    then(() => loadDom(pageUrl)).
    then(window => {
      const {imiloPageName, imiloPropsFromWindow} = getImiliPropsFromDomTree(window.document)
      imiloPropsFromAllPages[imiloPageName] = imiloPropsFromWindow
      // Callback to get opportunity to show progress done.
      onPageComplete(imiloPageName)
    }), Promise.resolve()).
    then(() => imiloPropsFromAllPages)
}


const BOB_BOOTSTRAP_ADVICES_ENDPOINT =
  'https://www.bob-emploi.fr/conseiller/nouveau-profil-et-projet#'
function openAdvicesPageForBobProps(bobProps) {
  return window.open(
    BOB_BOOTSTRAP_ADVICES_ENDPOINT + encodeURIComponent(JSON.stringify(bobProps)), '_blank')
}


function openImiloModal(title, bodyElement, okLabel) {
  const modal = document.createElement('div')
  modal.innerHTML =
    `<div id="confirmDialog" class="modalContainer modal modal-confirm" tabindex="-1"
          role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
        <h2>{{title}}</h2>
      </div>
      <div class="modal-body">
      </div>
      <div class="modal-footer">
        <div class="centered">
          <button class="btn btn-primary" id="btnOk">{{okLabel}}</button>
          <button class="btn btn-secondary" id="btnCancel">Annuler</button>
        </div>
      </div>
    </div>`
  document.body.appendChild(modal)
  modal.querySelector('h2').textContent = title
  modal.querySelector('.modal-body').appendChild(bodyElement)
  const okButton = modal.querySelector('button#btnOk')
  okButton.textContent = okLabel
  const cancelButton = modal.querySelector('button#btnCancel')
  cancelButton.onclick = () => {
    modal.parentNode.removeChild(modal)
  }
  return okButton
}


function startImportProcess() {
  const bodyElement = document.createElement('div')
  bodyElement.innerHTML =
    `<div>
      <h5>Recherche dans i-milo des données pour personnaliser les conseils&nbsp:</h5>
      <div class="pageName">Identité</div>
      <div class="pageName">Coordonnées</div>
      <div class="pageName">Compléments</div>
      <div class="pageName">Mobilité</div>
      <div class="pageName">Cursus</div>
      <div class="pageName">Situations</div>
    </div>`
  const okButton = openImiloModal(
    'Création de conseils personnalisés avec Bob',
    bodyElement, 'Ouvrir la page de conseils de Bob')
  // Hide until the imilo props are collected.
  okButton.style.display = 'none'

  const updateModalToShowCompletedPage = completedPageName => {
    const pageNameElements = bodyElement.querySelectorAll('div.pageName')
    const completedPageNameElement = Array.prototype.find.call(pageNameElements,
      pageNameElement => pageNameElement.textContent === completedPageName
    )
    if (!completedPageNameElement) {
      // Not expected.
      return
    }
    completedPageNameElement.textContent += ' ✅'
  }

  const updateModalToShowDataReadyForBob = bobProps => {
    bodyElement.innerHTML +=
      '<h5>Données que Bob va utiliser pour son diagnostic&nbsp:</h5>' +
      '  <div>' + JSON.stringify(bobProps, null, 2) + '</div>'
    // Enable modal button to open Bob.
    okButton.onclick = () => {
      openAdvicesPageForBobProps(bobProps)
    }
    okButton.style.display = ''
  }

  getImiloPropsFromAllPages(updateModalToShowCompletedPage).
    then(convertImiloPropsToBobProps).
    then(updateModalToShowDataReadyForBob)
}


export {startImportProcess}
