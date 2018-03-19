// Extract Imilo props from DOM.


function getImiloPropsFromElement(element) {
  const imiloProps = {}
  const rows = element.querySelectorAll('div.row')
  rows.forEach(function(row) {
    const nameLabel = row.querySelector('label')
    const valueSpan = row.querySelector('span')
    if (nameLabel && valueSpan) {
      // Remove ' :' after the label name.
      const name = nameLabel.textContent.replace(/\s*:\s*$/, '')
      const value = valueSpan.textContent
      imiloProps[name] = value
    }
  })
  return imiloProps
}


function getImiloPropsSectionsFromElement(element) {
  // Exclude the section that allows to add new information ('edit_form').
  const sectionElements = element.querySelectorAll('div.fileset:not(.edit_form)')
  const imiloPropsBySections = Array.prototype.map.call(sectionElements, sectionElement => {
    const imiloProps = getImiloPropsFromElement(sectionElement)
    const sectionTitle = sectionElement.querySelector('h3').childNodes[0].textContent.trim()
    imiloProps.title = sectionTitle
    return imiloProps
  })
  return imiloPropsBySections
}


function getImiliPropsFromDomTree(dom) {
  const imiloPage = dom.getElementById('newIdentityBlock')
  const imiloPageHeader = imiloPage.querySelector('h2')
  const imiloPageName = imiloPageHeader.textContent
  var imiloPropsFromWindow
  switch (imiloPageName) {
    case 'Identité':
    case 'Coordonnées':
    case 'Compléments':
    case 'Mobilité':
      imiloPropsFromWindow = getImiloPropsFromElement(imiloPage)
      break
    case 'Cursus':
      imiloPropsFromWindow = getImiloPropsSectionsFromElement(imiloPage)
      break
    case 'Situations':
      imiloPropsFromWindow = getImiloPropsSectionsFromElement(imiloPage)
      break
    default:
      imiloPropsFromWindow = {}
  }
  return {imiloPageName, imiloPropsFromWindow}
}


export {getImiliPropsFromDomTree}
