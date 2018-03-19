import config from 'config'
import {Logger} from './logging'

// Code from https://github.com/amplitude/Amplitude-Javascript
(function(e,t){var n=e.amplitude||{_q:[],_iq:{}};var r=t.createElement("script");r.type="text/javascript";r.async=true;r.src="https://d24n15hnbwhuhn.cloudfront.net/libs/amplitude-3.4.0-min.gz.js";r.onload=function(){e.amplitude.runQueuedFunctions()};var i=t.getElementsByTagName("script")[0];i.parentNode.insertBefore(r,i);function s(e,t){e.prototype[t]=function(){this._q.push([t].concat(Array.prototype.slice.call(arguments,0))); return this}}var o=function(){this._q=[];return this};var a=["add","append","clearAll","prepend","set","setOnce","unset"];for(var u=0;u<a.length;u++){s(o,a[u])}n.Identify=o;var c=function(){this._q=[];return this;};var p=["setProductId","setQuantity","setPrice","setRevenueType","setEventProperties"];for(var l=0;l<p.length;l++){s(c,p[l])}n.Revenue=c;var d=["init","logEvent","logRevenue","setUserId","setUserProperties","setOptOut","setVersionName","setDomain","setDeviceId","setGlobalUserProperties","identify","clearUserProperties","setGroup","logRevenueV2","regenerateDeviceId"];function v(e){function t(t){e[t]=function(){e._q.push([t].concat(Array.prototype.slice.call(arguments,0)));}}for(var n=0;n<d.length;n++){t(d[n])}}v(n);n.getInstance=function(e){e=(!e||e.length===0?"$default_instance":e).toLowerCase();if(!n._iq.hasOwnProperty(e)){n._iq[e]={_q:[]};v(n._iq[e])}return n._iq[e]};e.amplitude=n;})(window,document);  // eslint-disable-line


export const createAmplitudeMiddleware = actionTypesToLog => {
  // More info about Amplitude client options:
  // https://github.com/amplitude/Amplitude-Javascript#configuration-options
  window.amplitude.getInstance().init(config.amplitudeToken, null, {
    includeGclid: true,
    includeReferrer: true,
    includeUtm: true,
    saveParamsReferrerOncePerSession: false,
  })
  const logger = new Logger(actionTypesToLog)
  let userId
  return store => next => action => {
    const amplitude = window.amplitude.getInstance()
    const state = store.getState()

    const newUserId = logger.getUserId(action, state)
    if (newUserId !== userId) {
      userId = newUserId || null
      amplitude.setUserId(userId)
    }

    if (logger.shouldLogAction(action)) {
      amplitude.logEvent(logger.getEventName(action), logger.getEventProperties(action, state))
      const userProps = logger.getUserProperties(action, state)
      if (userProps) {
        amplitude.setUserProperties(userProps)
      }
    }

    return next(action)
  }
}
