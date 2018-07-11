import _mapValues from 'lodash/mapValues'

// Code from https://developers.facebook.com/docs/ads-for-websites/pixel-events/v2.12
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');  // eslint-disable-line


function createFacebookAnalyticsMiddleWare(facebookPixelID, actionsTypesToLog) {
  // We do not want to use Facebook Analytics to track our page history. We
  // only use it to measure the effectiveness of Facebook ads, therefore
  // sending one PageView is enough.
  window.fbq.disablePushState = true

  window.fbq('init', facebookPixelID)
  window.fbq('track', 'PageView')
  const actionsTypePredicate = _mapValues(actionsTypesToLog, type => {
    if (type.predicate) {
      return type
    }
    if (type.params) {
      return {predicate: () => true, ...type}
    }
    return {predicate: () => true, type}
  })

  return unusedStore => next => action => {
    const {params, predicate, type} = actionsTypePredicate[action.type] || {}
    if (predicate && type && predicate(action)) {
      window.fbq('track', type, params)
    }
    return next(action)
  }
}


export {createFacebookAnalyticsMiddleWare}
