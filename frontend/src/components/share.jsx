import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React from 'react'
// TODO(cyrille): Remove this lib, it causes more trouble than help.
import {EmailShareButton, FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton,
  TwitterIcon, TwitterShareButton, WhatsappIcon, WhatsappShareButton} from 'react-share'

import {shareProductModalIsShown, shareProductToNetwork} from 'store/actions'

import {isMobileVersion} from 'components/mobile'
import {Modal, ModalCloseButton} from 'components/modal'
import {Button, Input, SmoothTransitions} from 'components/theme'
import {getAbsoluteUrl, Routes} from 'components/url'
import emailIcon from 'images/email-icon.png'
import facebookMessengerIcon from 'images/fb-messenger-logo.svg'
import smsIcon from 'images/sms-icon.png'


class SmsShareButton extends React.Component {
  static propTypes = {
    beforeOnClick: PropTypes.func,
    children: PropTypes.node,
    url: PropTypes.string,
  }

  // TODO(cyrille): Make better (or more generic) text.
  getSmsLink() {
    const text =
      `Salut!\nTu connais Bob\u00A0?\nEn 15 minutes, il te propose un diagnostic et des conseils
      personnalisés pour ta recherche d'emploi. Essaye, c'est gratuit\u00A0!\n\n${this.props.url}`
    return `sms:body=${encodeURIComponent(text)}`
  }

  onClick = () => {
    const {beforeOnClick} = this.props
    const promise = beforeOnClick && beforeOnClick()
    if (promise && promise.then) {
      promise.then(() => window.open(this.getSmsLink(), '_blank'))
      return
    }
    window.open(this.getSmsLink(), '_blank')
  }

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  render() {
    return <div onClick={this.onClick}>
      {this.props.children}
    </div>
  }
}


class FbMessengerShareButton extends React.Component {
  static propTypes = {
    beforeOnClick: PropTypes.func,
    children: PropTypes.node,
    url: PropTypes.string,
  }

  getFbMessengerLink() {
    return `fb-messenger://share?link=${
      encodeURIComponent(this.props.url)
    }&app_id=${encodeURIComponent(config.facebookSSOAppId)}`
  }

  onClick = () => {
    const {beforeOnClick} = this.props
    const promise = beforeOnClick && beforeOnClick()
    if (promise && promise.then) {
      promise.then(() => window.open(this.getFbMessengerLink(), '_blank'))
      return
    }
    window.open(this.getFbMessengerLink(), '_blank')
  }

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  render() {
    return <div onClick={this.onClick}>
      {this.props.children}
    </div>
  }
}


// TODO(cyrille): Find a way to put this back somewhere in the flow, we've had approx 20 people per
// months thanks to this one.
class ShareBanner extends React.Component {
  static propTypes = {
    onClose: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isShareBobShown: false,
  }

  handleShareClick = () => {
    this.setState({isShareBobShown: true})
  }

  render() {
    const {onClose, style, userYou} = this.props
    const {isShareBobShown} = this.state
    const containerStyle = {
      backgroundColor: colors.PALE_BLUE,
      ...style,
    }
    const messageStyle = {
      alignItems: isMobileVersion ? 'center' : 'baseline',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      margin: 'auto',
      maxWidth: 1000,
    }
    const textStyle = {
      flex: 1,
      fontSize: 14,
      lineHeight: '20px',
      marginRight: isMobileVersion ? 'initial' : 100,
      padding: isMobileVersion ? '0 20px' : 'initial',
    }
    // TODO(marielaure): Make sure the button is below the "See my advice" button in mobile.
    const shareButtonStyle = {
      alignSelf: isMobileVersion ? 'center' : 'flex-end',
      flexShrink: 0,
      marginBottom: 30,
    }

    // TODO(marielaure): Move the close button to the center-left.
    const closeStyle = {
      backgroundColor: colors.COOL_GREY,
      boxShadow: 'initial',
      fontSize: 10,
      left: 0,
      position: 'static',
      right: 'initial',
      width: 35,
    }

    // TODO(marielaure): Add a close button and make this position fixed and enable it when user
    // has read most of the assessment.
    return <div style={containerStyle}>
      <ModalCloseButton onClick={onClose} style={closeStyle} />
      <div style={messageStyle}>
        <div style={textStyle}>
          <p>
            <strong style={{fontSize: 18}}>
              Nous avons une petite faveur à {userYou('te', 'vous')} demander…
            </strong>
          </p>

          <p>
            Nous pensons que personne ne devrait être seul dans sa recherche. C'est
            pourquoi <strong>{config.productName} est entièrement gratuit et à but non
            lucratif. </strong> Notre mission est de redistribuer l'information pour éclairer
            le chemin de chacun. Mais nous n'avons pas le budget marketing d'une entreprise
            commerciale. Pour aider le plus de monde possible, nous avons besoin
            de {userYou('toi', ' vous')}.
          </p>

          <p>
            <strong style={{color: colors.BOB_BLUE}}>
              En partageant {config.productName} à une personne à qui nous pourrions être utiles,
              {userYou(' tu nous aides', ' vous nous aidez')} à rendre le monde un peu meilleur
            </strong> - et ça ne prend qu'une minute.
          </p>

          <p>
            Merci <span aria-label={`on ${userYou("t'", 'vous ')}aime`} role="img">
              &#x2764;&#xfe0F;</span>
          </p>
        </div>
        <Button onClick={this.handleShareClick} style={shareButtonStyle} type="validation">
          Partager {config.productName} maintenant
        </Button>
      </div>
      {/* TODO(marielaure): Put more relevant text here. */}
      <ShareModal
        onClose={() => this.setState({isShareBobShown: false})} isShown={isShareBobShown}
        title="Partagez avec vos amis"
        campaign="as" visualElement="assessment"
        intro={<React.Fragment>
          <strong>Merci&nbsp;!</strong><br />
          on s'occupe du reste&nbsp;!
        </React.Fragment>} />
    </div>
  }
}


class ShareModal extends React.Component {
  static propTypes = {
    children: PropTypes.node,
    intro: PropTypes.node,
    isShown: PropTypes.bool,
    style: PropTypes.object,
    title: PropTypes.string,
  }

  render() {
    const {children, intro, style, title, ...otherProps} = this.props
    const modalStyle = {
      borderRadius: 10,
      color: colors.DARK_TWO,
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
    // TODO(cyrille): Add content in share links (quote/hashtag in FB, title/desc in LinkedIn, ...).
    return <Modal style={modalStyle} {...otherProps}>
      <div style={{fontSize: 25, fontWeight: 'bold'}}>{title}</div>

      {intro ? <div style={{margin: isMobileVersion ? '25px 0' : '40px 0'}}>
        {intro}
      </div> : null}

      <ShareButtons {..._pick(this.props, ['campaign', 'url', 'visualElement'])} />

      {children ? <div style={{marginTop: isMobileVersion ? 25 : 40}}>
        {children}
      </div> : null}
    </Modal>
  }
}


class ShareButtons extends React.Component {
  static propTypes = {
    // The IDs are referenced at https://airtable.com/tblpbiUqtvn3poeXd.
    campaign: PropTypes.string,
    url: PropTypes.string,
    // The visual element reference that explains the context in which this
    // modal is shown. This is only to differentiate in logs.
    visualElement: PropTypes.string,
  }

  static contextTypes = {
    store: PropTypes.shape({
      dispatch: PropTypes.func.isRequired,
    }),
  }

  state = {
    canBrowserShare: !!navigator.share,
    isShareLinkJustCopied: false,
  }

  componentDidMount() {
    const {visualElement} = this.props
    const {store} = this.context
    if (store) {
      store.dispatch(shareProductModalIsShown(visualElement))
    }
  }

  getLink() {
    const {campaign, url} = this.props
    return url ? url : getAbsoluteUrl(Routes.INVITE_PATH + (campaign ? `#${campaign}` : ''))
  }

  dispatchShared = () => {
    const {store} = this.context
    if (store) {
      store.dispatch(shareProductToNetwork(this.props.visualElement))
    }
  }

  // TODO(cyrille): Reinstate default share if canBrowserShare.
  copyShareLink = () => {
    const {canBrowserShare} = this.state
    if (!this.shareLink) {
      return
    }
    this.dispatchShared()
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
      border: `solid 1px ${colors.SILVER}`,
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
      color: colors.BOB_BLUE,
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
    const link = this.getLink()
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
    const buttonsContainerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: isMobileVersion ? 'space-between' : 'initial',
    }
    return <React.Fragment>
      <div style={buttonsContainerStyle}>
        <FacebookShareButton url={link} style={iconStyle} beforeOnClick={this.dispatchShared}>
          <FacebookIcon {...iconProps} />
        </FacebookShareButton>
        <TwitterShareButton url={link} style={iconStyle} beforeOnClick={this.dispatchShared}>
          <TwitterIcon {...iconProps} />
        </TwitterShareButton>
        <LinkedinShareButton url={link} style={iconStyle} beforeOnClick={this.dispatchShared}>
          <LinkedinIcon {...iconProps} />
        </LinkedinShareButton>
        {isMobileVersion ? <React.Fragment>
          <WhatsappShareButton url={link} style={iconStyle} beforeOnClick={this.dispatchShared}>
            <WhatsappIcon {...iconProps} />
          </WhatsappShareButton>
          <FbMessengerShareButton
            url={link} style={{height: '100%'}} beforeOnClick={this.dispatchShared}>
            <img src={facebookMessengerIcon} alt="messenger" style={iconStyle} />
          </FbMessengerShareButton>
          <SmsShareButton url={link} beforeOnClick={this.dispatchShared}>
            <img src={smsIcon} alt="sms" style={iconStyle} />
          </SmsShareButton>
        </React.Fragment> : null}
        <EmailShareButton url={link} beforeOnClick={this.dispatchShared}>
          <img src={emailIcon} alt="email" style={iconStyle} />
        </EmailShareButton>
        {/* Filler for regular space-between on different rows from flex-wrap. */}
        {Array(3).fill().map((unused, index) =>
          <div style={{height: 0, width: iconProps.size}} key={`filler-${index}`} />)}
      </div>
      {isMobileVersion ? null : this.renderShareLink()}
    </React.Fragment>
  }
}


export {ShareBanner, ShareButtons, ShareModal}
