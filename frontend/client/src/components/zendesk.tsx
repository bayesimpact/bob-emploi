import React from 'react'
import PropTypes from 'prop-types'


// Number of ZendeskChatButton components that are mounted and shown. We keep
// the help button visible unless this number goes down to 0.
let numChatButtonsShown = 0
// Timeout for pending show/hide action so we can avoid quick back & forth
// between shown & hidden states.
let timeout: ReturnType<typeof setTimeout>|undefined


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


class ZendeskChatButton extends React.PureComponent<ButtonProps> {
  public static propTypes = {
    domain: PropTypes.string.isRequired,
    isShown: PropTypes.bool,
    language: PropTypes.string,
    user: PropTypes.shape({
      email: PropTypes.string,
      name: PropTypes.string,
    }),
  }

  public componentDidMount(): void {
    if (this.props.isShown) {
      this.show()
    }
  }

  public componentDidUpdate({isShown: wasShown}: ButtonProps): void {
    const {isShown} = this.props
    if (!isShown === !wasShown) {
      return
    }
    if (isShown) {
      this.show()
    } else {
      this.hide()
    }
  }

  public componentWillUnmount(): void {
    if (this.props.isShown) {
      this.hide()
    }
  }

  private show(): void {
    const {domain, language, user} = this.props
    if (numChatButtonsShown++ || !domain) {
      return
    }

    /* eslint-disable unicorn/no-abusive-eslint-disable */
    // @ts-ignore
    window.zEmbed||function(e,t){var n,o,d,i,s,a=[],r=document.createElement("iframe");window.zEmbed=function(){a.push(arguments)},window.zE=window.zE||window.zEmbed,r.src="javascript:false",r.title="",r.role="presentation",(r.frameElement||r).style.cssText="display: none",d=document.getElementsByTagName("script"),d=d[d.length-1],d.parentNode.insertBefore(r,d),i=r.contentWindow,s=i.document;try{o=s}catch(e){n=document.domain,r.src='javascript:var d=document.open();d.domain="'+n+'";void(0);',o=s}o.open()._l=function(){var o=this.createElement("script");n&&(this.domain=n),o.id="js-iframe-async",o.src=e,this.t=+new Date,this.zendeskHost=t,this.zEQueue=a,this.body.appendChild(o)},o.write('<body onload="document._l();">'),o.close()}("https://assets.zendesk.com/embeddable_framework/main.js", domain);  // eslint-disable-line
    /* eslint-enable unicorn/no-abusive-eslint-disable */

    const w = window as ZopimWindow

    w.zE && w.zE((): void => {
      w.zE && w.zE.hide()
      w.$zopim && w.$zopim((): void => {
        // More configuration values here:
        // https://api.zopim.com/files/meshim/widget/controllers/LiveChatAPI-js.html
        const {$zopim} = w
        if (language && $zopim && $zopim.livechat) {
          $zopim.livechat.setLanguage(language)
        }
        if (user && $zopim && $zopim.livechat) {
          const {email, name} = user
          if (email || name) {
            $zopim.livechat.set({email: email || '', name: name || ''})
          }
        }
        if (timeout) {
          clearTimeout(timeout)
        }
        timeout = setTimeout((): void => {
          w.$zopim && w.$zopim((): void => {
            const {button, window} = w.$zopim && w.$zopim.livechat || {}
            if (!button || !button.show) {
              return
            }
            if (window && window.onHide) {
              window.onHide(button.show)
            }
            button.show()
          })
        }, 1)
      })
    })
  }

  private hide(): void {
    const w = window as ZopimWindow
    if (!--numChatButtonsShown) {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout((): void => {
        w.$zopim && w.$zopim((): void => {
          w.$zopim && w.$zopim.livechat && w.$zopim.livechat.hideAll && w.$zopim.livechat.hideAll()
        })
      }, 1)
    }
  }

  public render(): React.ReactNode {
    return null
  }
}


export {ZendeskChatButton}
