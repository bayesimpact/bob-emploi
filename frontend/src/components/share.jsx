import PropTypes from 'prop-types'
import React from 'react'
import {EmailShareButton, FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton,
  TwitterIcon, TwitterShareButton, WhatsappIcon, WhatsappShareButton} from 'react-share'

import {shareProductModalIsShown, shareProductToNetwork} from 'store/actions'

import config from 'config'

import {Modal} from 'components/modal'
import {Button, Colors, Input, SmoothTransitions} from 'components/theme'
import emailIcon from 'images/email-icon.png'
import facebookMessengerIcon from 'images/fb-messenger-logo.svg'
import smsIcon from 'images/sms-icon.png'


class SmsShareButton extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    url: PropTypes.string,
  }

  getSmsLink() {
    const text =
      `Salut les copains!! Regardez le super site de la mort qui tue!\n\n${this.props.url}`
    return `sms:body=${encodeURIComponent(text)}`
  }

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  render() {
    return <div onClick={() => window.open(this.getSmsLink(), '_blank')}>
      {this.props.children}
    </div>
  }
}


class FbMessengerShareButton extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    url: PropTypes.string,
  }

  getFbMessengerLink() {
    return `fb-messenger://share?link=${
      encodeURIComponent(this.props.url)
    }&app_id=${encodeURIComponent(config.facebookSSOAppId)}`
  }

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  render() {
    return <div onClick={() => window.open(this.getFbMessengerLink(), '_blank')}>
      {this.props.children}
    </div>
  }
}


class ShareModal extends React.Component {
  static propTypes = {
    // The IDs are referenced at https://airtable.com/tblpbiUqtvn3poeXd.
    campaign: PropTypes.string,
    children: PropTypes.node,
    intro: PropTypes.node,
    isShown: PropTypes.bool,
    sharedBody: PropTypes.string,
    sharedTitle: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.string,
    // The visual element reference that explains the context in which this
    // modal is shown. This is only to differentiate in logs.
    visualElement: PropTypes.string,
  }

  static defaultProps = {
    // default sharedBody is defined in render, since it depends on link.
    sharedTitle: 'Tu connais Bob\u00a0?',
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
    store: PropTypes.shape({
      dispatch: PropTypes.func.isRequired,
    }),
  }

  state = {
    canBrowserShare: !!navigator.share,
    isShareLinkJustCopied: false,
  }

  componentWillMount() {
    const {isShown, visualElement} = this.props
    const {store} = this.context
    if (isShown && store) {
      store.dispatch(shareProductModalIsShown(visualElement))
    }
  }

  componentWillReceiveProps(nextProps) {
    const {isShown, visualElement} = nextProps
    const {store} = this.context
    if (isShown && !this.props.isShown && store) {
      store.dispatch(shareProductModalIsShown(visualElement))
    }
  }

  getLink() {
    const {campaign} = this.props
    return `https://www.bob-emploi.fr/invite${campaign ? `#${campaign}` : ''}`
  }

  copyShareLink = () => {
    const {visualElement} = this.props
    const {store} = this.context
    const {canBrowserShare} = this.state
    if (!this.shareLink) {
      return
    }
    if (store) {
      store.dispatch(shareProductToNetwork(visualElement))
    }
    this.shareLink.select()
    if (canBrowserShare) {
      navigator.share({title: config.productName, url: this.getLink()})
    }
    document.execCommand('Copy')
    this.setState({isShareLinkJustCopied: true})
    this.timeout = setTimeout(() => this.setState({isShareLinkJustCopied: false}), 4000)
  }

  renderShareLink = () => {
    const {canBrowserShare, isShareLinkJustCopied} = this.state
    const inputStyle = {
      border: `solid 1px ${Colors.SILVER}`,
      borderRadius: 4,
      justifyContent: 'center',
      minHeight: 58,
    }
    const buttonStyle = {
      bottom: 0,
      height: 40,
      margin: 'auto 0px',
      position: 'absolute',
      right: 9,
      top: 0,
    }
    const shareLinkCopiedStyle = {
      color: Colors.BOB_BLUE,
      fontSize: 13,
      left: 0,
      marginTop: 5,
      opacity: isShareLinkJustCopied ? 1 : 0,
      position: 'absolute',
      right: 0,
      textAlign: 'center',
      top: '100%',
      transition: isShareLinkJustCopied ? 'none' : SmoothTransitions.transition,
    }
    return <div style={{position: 'relative'}}>
      <Input
        readOnly={true} className="blue-select"
        style={inputStyle}
        value={this.getLink()} ref={shareLink => this.shareLink = shareLink} />
      <Button
        onClick={this.copyShareLink} isRound={true} style={buttonStyle}>
        {canBrowserShare ? 'Partager' : 'Copier'}
      </Button>
      <span style={shareLinkCopiedStyle}>
        Lien copié dans le presse papier
      </span>
    </div>
  }

  render() {
    const {children, intro, style, title, ...otherProps} = this.props
    const {isMobileVersion} = this.context
    const link = this.getLink()
    const modalStyle = {
      borderRadius: 10,
      color: Colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      fontWeight: 'normal',
      justifyContent: 'space-between',
      lineHeight: 1.19,
      margin: 20,
      padding: isMobileVersion ? 30 : 50,
      textAlign: 'center',
      width: isMobileVersion ? 'initial' : 500,
      ...style,
    }
    const buttonsContainerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: isMobileVersion ? 'space-between' : 'initial',
    }
    const iconProps = {
      size: isMobileVersion ? 50 : 32,
    }
    const iconStyle = {
      borderRadius: 5,
      cursor: 'pointer',
      display: 'block',
      height: iconProps.size,
      marginBottom: 5,
      marginRight: isMobileVersion ? 'initial' : 5,
      overflow: 'hidden',
      width: iconProps.size,
    }
    // TODO(cyrille): Add content in share links (quote/hashtag in FB, title/desc in LinkedIn, ...).
    return <Modal style={modalStyle} {...otherProps}>
      <div style={{fontSize: 25, fontWeight: 'bold'}}>{title}</div>

      {intro ? <div style={{margin: isMobileVersion ? '25px 0' : '40px 0'}}>
        {intro}
      </div> : null}

      <div style={buttonsContainerStyle}>
        <FacebookShareButton url={link} style={iconStyle}>
          <FacebookIcon {...iconProps} />
        </FacebookShareButton>
        <TwitterShareButton url={link} style={iconStyle}>
          <TwitterIcon {...iconProps} />
        </TwitterShareButton>
        <LinkedinShareButton url={link} style={iconStyle}>
          <LinkedinIcon {...iconProps} />
        </LinkedinShareButton>
        {isMobileVersion ? <React.Fragment>
          <WhatsappShareButton url={link} style={iconStyle}>
            <WhatsappIcon {...iconProps} />
          </WhatsappShareButton>
          <FbMessengerShareButton url={link} style={{height: '100%'}}>
            <img src={facebookMessengerIcon} alt="messenger" style={iconStyle} />
          </FbMessengerShareButton>
          <SmsShareButton url={link}>
            <img src={smsIcon} alt="sms" style={iconStyle} />
          </SmsShareButton>
        </React.Fragment> : null}
        <EmailShareButton url={link} style={{}}>
          <img src={emailIcon} alt="email" style={iconStyle} />
        </EmailShareButton>
        {/* Filler for regular space-between on different rows from flex-wrap. */}
        {Array(3).fill().map((unused, index) =>
          <div style={{height: 0, width: iconProps.size}} key={`filler-${index}`} />)}
      </div>
      {isMobileVersion ? null : this.renderShareLink()}
      {children ? <div style={{marginTop: isMobileVersion ? 25 : 40}}>
        {children}
      </div> : null}
    </Modal>
  }
}


export {ShareModal}
