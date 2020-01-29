import {convertImiloPropsToBobProps} from './imilo'
import {ImiloProps, getCoords, getDegrees, getIdentity, getMobility,
  getSituations} from './imilo_api'


type ImiliPropsFetcher = {
  [K in keyof ImiloProps]: (userId: string) => Promise<ImiloProps[K]>
}


function getImiloPropsFromAllPages(
  userId: string, onPageComplete: (pageName: string) => void): Promise<ImiloProps> {
  // Get all the URLs that contains part of the i-milo user data (user 'Dossier').
  const pageApis: ImiliPropsFetcher = {
    Coordonnées: getCoords,
    Cursus: getDegrees,
    Identité: getIdentity,
    Mobilité: getMobility,
    Situations: getSituations,
  }

  // On each page collect the i-milo user data.
  const imiloPropsFromAllPages: Partial<ImiloProps> = {}
  // Chain loading all pages one after the other.
  return (Object.keys(pageApis) as readonly (keyof ImiloProps)[]).
    reduce(
      <K extends keyof ImiloProps>(iterateOverPreviousPages: Promise<void>, pageName: K):
      Promise<void> =>
        iterateOverPreviousPages.
          then((): Promise<ImiloProps[K]> => pageApis[pageName](userId) as Promise<ImiloProps[K]>).
          then((response: ImiloProps[K]): void => {
            imiloPropsFromAllPages[pageName] = response
            // Callback to get opportunity to show progress done.
            onPageComplete(pageName)
          }),
      Promise.resolve(),
    ).
    then((): ImiloProps => imiloPropsFromAllPages as ImiloProps)
}


const BOB_BOOTSTRAP_ADVICES_ENDPOINT =
  'https://www.bob-emploi.fr/conseiller/nouveau-profil-et-projet#'
function openAdvicesPageForBobProps(bobProps: bayes.bob.User): void {
  window.open(
    BOB_BOOTSTRAP_ADVICES_ENDPOINT + encodeURIComponent(JSON.stringify(bobProps)), '_blank')
}


function openImiloModal(title: string, bodyElement: HTMLElement, okLabel: string): HTMLElement {
  const modal = document.createElement('div')
  modal.innerHTML =
    `<div id="confirmDialog" class="modalContainer modal modal-confirm" tabindex="-1"
          role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
      <div class="modal-header">
        <button type="button" class="close" aria-hidden="true">×</button>
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
  const h2 = modal.querySelector('h2')
  if (h2) {
    h2.textContent = title
  }
  const modalBody = modal.querySelector('.modal-body')
  if (modalBody) {
    modalBody.appendChild(bodyElement)
  }
  const okButton = modal.querySelector('button#btnOk') as HTMLElement
  okButton.textContent = okLabel
  const closeModal = (): void => {
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal)
    }
  }
  const closeButton = modal.querySelector('button.close') as HTMLElement
  const cancelButton = modal.querySelector('button#btnCancel') as HTMLElement
  closeButton.onclick = closeModal
  cancelButton.onclick = closeModal
  return okButton
}


function startImportProcess(): void {
  const pathnameMatch = window.location.pathname.match(/^\/dossier\/([^/]+)\//)
  if (!pathnameMatch) {
    // eslint-disable-next-line no-console
    console.log("Impossible de trouver la référence du dossier dans l'URL")
    return
  }
  const userId = pathnameMatch[1]

  const bodyElement = document.createElement('div')
  bodyElement.innerHTML =
    `<div>
      <h5>Recherche dans i-milo des données pour personnaliser les conseils&nbsp:</h5>
      <div class="bob-loading" />
    </div>`
  const okButton = openImiloModal(
    'Création de conseils personnalisés avec Bob',
    bodyElement, 'Ouvrir la page de conseils de Bob')
  // Hide until the imilo props are collected.
  okButton.style.display = 'none'

  const loadingElement = bodyElement.querySelectorAll('div.bob-loading')[0]

  const updateModalToShowCompletedPage = (): void => {
    if (loadingElement) {
      loadingElement.textContent += '.'
    }
  }

  const updateModalToShowDataReadyForBob = (bobProps: bayes.bob.User): void => {
    if (loadingElement) {
      loadingElement.textContent += ' ✅'
    }
    const bobPropsJson = JSON.stringify(bobProps, null, 2).
      replace(/[",[\]{}]/g, '').
      split('\n').filter((line: string): string => line.trim()).join('\n')
    bodyElement.innerHTML +=
      `<h5>Données que Bob va utiliser pour son diagnostic&nbsp:</h5>
        <textarea
          readonly style="width:100%;box-sizing:border-box;height:290px">${bobPropsJson}</textarea>`
    // Enable modal button to open Bob.
    okButton.onclick = (): void => {
      openAdvicesPageForBobProps(bobProps)
    }
    okButton.style.display = ''
  }

  getImiloPropsFromAllPages(userId, updateModalToShowCompletedPage).
    then(convertImiloPropsToBobProps).
    then(updateModalToShowDataReadyForBob)
}


export {startImportProcess}
