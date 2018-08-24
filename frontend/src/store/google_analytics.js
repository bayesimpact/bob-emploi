// Code from https://developers.google.com/analytics/devguides/collection/analyticsjs/
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');  // eslint-disable-line


function createGoogleAnalyticsMiddleWare(googleUAID, actionsTypesToLog) {
  window.ga('create', googleUAID, 'auto')
  return unusedStore => next => action => {
    const gaAction = actionsTypesToLog[action.type]
    if (gaAction) {
      window.ga('send', gaAction, action.location && action.location.pathname || undefined)
    }
    return next(action)
  }
}


export {createGoogleAnalyticsMiddleWare}
