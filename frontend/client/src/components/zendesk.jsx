import React from 'react'
import PropTypes from 'prop-types'


// Number of ZendeskChatButton components that are mounted and shown. We keep
// the help button visible unless this number goes down to 0.
var numChatButtonsShown = 0
// Timeout for pending show/hide action so we can avoid quick back & forth
// between shown & hidden states.
var timeout = null


class ZendeskChatButton extends React.Component {
  static propTypes = {
    domain: PropTypes.string.isRequired,
    isShown: PropTypes.bool,
    language: PropTypes.string,
    user: PropTypes.shape({
      email: PropTypes.string,
      name: PropTypes.string,
    }),
  }

  componentDidMount() {
    if (this.props.isShown) {
      this.show()
    }
  }

  componentDidUpdate({isShown: wasShown}) {
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

  componentWillUnmount() {
    if (this.props.isShown) {
      this.hide()
    }
  }

  show() {
    const {domain, language, user} = this.props
    if (numChatButtonsShown++ || !domain) {
      return
    }

    window.zEmbed||function(e,t){var n,o,d,i,s,a=[],r=document.createElement("iframe");window.zEmbed=function(){a.push(arguments)},window.zE=window.zE||window.zEmbed,r.src="javascript:false",r.title="",r.role="presentation",(r.frameElement||r).style.cssText="display: none",d=document.getElementsByTagName("script"),d=d[d.length-1],d.parentNode.insertBefore(r,d),i=r.contentWindow,s=i.document;try{o=s}catch(e){n=document.domain,r.src='javascript:var d=document.open();d.domain="'+n+'";void(0);',o=s}o.open()._l=function(){var o=this.createElement("script");n&&(this.domain=n),o.id="js-iframe-async",o.src=e,this.t=+new Date,this.zendeskHost=t,this.zEQueue=a,this.body.appendChild(o)},o.write('<body onload="document._l();">'),o.close()}("https://assets.zendesk.com/embeddable_framework/main.js", domain);  // eslint-disable-line

    window.zE(() => {
      window.zE.hide()
      window.$zopim && window.$zopim(() => {
        // More configuration values here:
        // https://api.zopim.com/files/meshim/widget/controllers/LiveChatAPI-js.html
        const {$zopim} = window
        if (language) {
          $zopim.livechat.setLanguage(language)
        }
        if (user) {
          const {email, name} = user
          if (email || name) {
            $zopim.livechat.set({email: email || '', name: name || ''})
          }
        }
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          window.$zopim(() => {
            window.$zopim.livechat.window.onHide(window.$zopim.livechat.button.show)
            window.$zopim.livechat.button.show()
          })
        }, 1)
      })
    })
  }

  hide() {
    if (!--numChatButtonsShown) {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        window.$zopim && window.$zopim(() => window.$zopim.livechat.hideAll())
      }, 1)
    }
  }

  render() {
    return null
  }
}


export {ZendeskChatButton}
