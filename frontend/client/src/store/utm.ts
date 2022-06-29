import {parseQueryString, removeAmpersandDoubleEncodingInString} from 'store/parse'

// Name of the session storage key to store the UTM initial information.
const UTM_SESSION_STORAGE_NAME = 'utm'

const {
  utm_campaign: campaign,
  utm_content: content,
  utm_medium: medium,
  utm_source: source,
} = parseQueryString(removeAmpersandDoubleEncodingInString(window.location.search))

const urlUtm: undefined|bayes.bob.TrackingParameters =
  (campaign || content || medium || source) ? {campaign, content, medium, source} : undefined

const sessionUtmString = window.sessionStorage.getItem(UTM_SESSION_STORAGE_NAME)

if (urlUtm && !sessionUtmString) {
  window.sessionStorage.setItem(UTM_SESSION_STORAGE_NAME, JSON.stringify(urlUtm))
}

const initialUtm: undefined|bayes.bob.TrackingParameters =
  sessionUtmString ? JSON.parse(sessionUtmString) : urlUtm

export {initialUtm, urlUtm}
