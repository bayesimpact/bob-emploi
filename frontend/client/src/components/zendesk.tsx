import React, {useEffect} from 'react'
import PropTypes from 'prop-types'


// Number of ZendeskChatButton components that are mounted and shown. We keep
// the help button visible unless this number goes down to 0.
let numChatButtonsShown = 0
// Timeout for pending show/hide action so we can avoid quick back & forth
// between shown & hidden states.
let timeout: number|undefined


interface ButtonProps {
  domain: string
  isShown?: boolean
  language?: string
  user?: {
    email?: string
    name?: string
  }
}


interface ZopimWindow {
  zE?: {
    (callback: () => void): void
    hide: () => void
  }
  $zopim?: {
    (callback: () => void): void
    livechat: {
      button: {
        show: () => void
      }
      hideAll: () => void
      setLanguage: (language: string) => void
      set: (state: {
        email: string
        name: string
      }) => void
      window: {
        onHide: (callback: () => void) => void
      }
    }
  }
}


function hide(): void {
  const w = window as ZopimWindow
  if (!--numChatButtonsShown) {
    clearTimeout(timeout)
    timeout = window.setTimeout((): void => {
      w.$zopim?.((): void => {
        w.$zopim?.livechat?.hideAll?.()
      })
    }, 1)
  }
}

function show(domain: string): void {
  if (numChatButtonsShown++) {
    return
  }

  /* eslint-disable unicorn/no-abusive-eslint-disable */
  // @ts-ignore
  window.zEmbed||function(e,t){var n,o,d,i,s,a=[],r=document.createElement("iframe");window.zEmbed=function(){a.push(arguments)},window.zE=window.zE||window.zEmbed,r.src="javascript:false",r.title="",r.role="presentation",(r.frameElement||r).style.cssText="display: none",d=document.getElementsByTagName("script"),d=d[d.length-1],d.parentNode.insertBefore(r,d),i=r.contentWindow,s=i.document;try{o=s}catch(e){n=document.domain,r.src='javascript:var d=document.open();d.domain="'+n+'";void(0);',o=s}o.open()._l=function(){var o=this.createElement("script");n&&(this.domain=n),o.id="js-iframe-async",o.src=e,this.t=+new Date,this.zendeskHost=t,this.zEQueue=a,this.body.appendChild(o)},o.write('<body onload="document._l();">'),o.close()}("https://assets.zendesk.com/embeddable_framework/main.js", domain);  // eslint-disable-line
  /* eslint-enable unicorn/no-abusive-eslint-disable */

  const w = window as ZopimWindow

  w.zE?.((): void => {
    w.zE?.hide()
    w.$zopim?.((): void => {
      clearTimeout(timeout)
      timeout = window.setTimeout((): void => {
        w.$zopim && w.$zopim((): void => {
          const {button, window} = w.$zopim && w.$zopim.livechat || {}
          if (!button?.show) {
            return
          }
          window?.onHide?.(button.show)
          button.show()
        })
      }, 1)
    })
  })
}


function onZopim(): Promise<ZopimWindow['$zopim']> {
  const w = window as ZopimWindow
  return new Promise(resolve => {
    w.zE?.((): void => {
      w.$zopim?.((): void => resolve(w.$zopim))
    })
  })
}


// Although this always return null, we keep this as a component and not as a simple hook as its
// logic is the same as a DOM element.

const ZendeskChatButtonBase = (props: ButtonProps): null => {
  const {domain, isShown, language, user} = props

  useEffect((): (() => void) => {
    if (isShown && domain) {
      show(domain)
      return hide
    }
    return (): void => void 0
  }, [domain, isShown])

  // More configuration values here:
  // https://api.zopim.com/files/meshim/widget/controllers/LiveChatAPI-js.html

  useEffect((): void => {
    if (!isShown || !language) {
      return
    }
    onZopim().then($zopim => $zopim?.livechat?.setLanguage(language))
  }, [isShown, language])

  const {email = '', name = ''} = user || {}
  useEffect((): void => {
    if (!isShown || !email && !name) {
      return
    }
    onZopim().then($zopim => $zopim?.livechat?.set({email, name}))
  }, [isShown, email, name])

  return null
}
ZendeskChatButtonBase.propTypes = {
  domain: PropTypes.string.isRequired,
  isShown: PropTypes.bool,
  language: PropTypes.string,
  user: PropTypes.shape({
    email: PropTypes.string,
    name: PropTypes.string,
  }),
}
const ZendeskChatButton = React.memo(ZendeskChatButtonBase)


export {ZendeskChatButton}
