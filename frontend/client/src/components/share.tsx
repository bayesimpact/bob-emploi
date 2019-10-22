import _pick from 'lodash/pick'
import PropTypes from 'prop-types'
import React from 'react'
import {EmailShareButton, FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton,
  TwitterIcon, TwitterShareButton, WhatsappIcon, WhatsappShareButton} from 'react-share'

import {DispatchAllActions, shareProductModalIsShown, shareProductToNetwork} from 'store/actions'
import {YouChooser} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import {Modal, ModalCloseButton, ModalConfig} from 'components/modal'
import {Button, SmoothTransitions, Textarea} from 'components/theme'
import {getAbsoluteUrl, Routes} from 'components/url'
import emailIcon from 'images/email-icon.png'
import facebookMessengerIcon from 'images/fb-messenger-logo.svg'
import smsIcon from 'images/sms-icon.png'


declare global {
  interface Navigator {
    share?: (options: {title?: string; url: string}) => void
  }
}


interface ButtonProps {
  beforeOnClick?: () => void | Promise<void>
  url: string
}


class SmsShareButton extends React.PureComponent<ButtonProps> {
  public static propTypes = {
    beforeOnClick: PropTypes.func,
    children: PropTypes.node,
    url: PropTypes.string.isRequired,
  }

  // TODO(cyrille): Make better (or more generic) text.
  private getSmsLink(): string {
    const text =
      `Salut!\nTu connais Bob\u00A0?\nEn 15 minutes, il te propose un diagnostic et des conseils
      personnalisés pour ta recherche d'emploi. Essaye, c'est gratuit\u00A0!\n\n${this.props.url}`
    return `sms:body=${encodeURIComponent(text)}`
  }

  private onClick = (): void => {
    const {beforeOnClick} = this.props
    const promise = beforeOnClick && beforeOnClick()
    if (promise && promise.then) {
      promise.then((): void => {
        window.open(this.getSmsLink(), '_blank')
      })
      return
    }
    window.open(this.getSmsLink(), '_blank')
  }

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  public render(): React.ReactNode {
    return <div onClick={this.onClick}>
      {this.props.children}
    </div>
  }
}


class FbMessengerShareButton extends React.PureComponent<ButtonProps> {
  public static propTypes = {
    beforeOnClick: PropTypes.func,
    children: PropTypes.node,
    url: PropTypes.string.isRequired,
  }

  private getFbMessengerLink(): string {
    return `fb-messenger://share?link=${
      encodeURIComponent(this.props.url)
    }&app_id=${encodeURIComponent(config.facebookSSOAppId)}`
  }

  private onClick = (): void => {
    const {beforeOnClick} = this.props
    const promise = beforeOnClick && beforeOnClick()
    if (promise && promise.then) {
      promise.then((): void => {
        window.open(this.getFbMessengerLink(), '_blank')
      })
      return
    }
    window.open(this.getFbMessengerLink(), '_blank')
  }

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  public render(): React.ReactNode {
    return <div onClick={this.onClick}>
      {this.props.children}
    </div>
  }
}


interface BannerProps {
  dispatch: DispatchAllActions
  onClose?: () => void
  style?: React.CSSProperties
  userYou: YouChooser
}


// TODO(cyrille): Find a way to put this back somewhere in the flow, we've had approx 20 people per
// months thanks to this one.
class ShareBanner extends React.PureComponent<BannerProps, {isShareBobShown: boolean}> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    onClose: PropTypes.func,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    isShareBobShown: false,
  }

  private handleShareClick = (): void => {
    this.setState({isShareBobShown: true})
  }

  private handleHideShareBob = (): void => this.setState({isShareBobShown: false})

  public render(): React.ReactNode {
    const {dispatch, onClose, style, userYou} = this.props
    const {isShareBobShown} = this.state
    const containerStyle = {
      backgroundColor: colors.PALE_BLUE,
      ...style,
    }
    const messageStyle: React.CSSProperties = {
      alignItems: isMobileVersion ? 'center' : 'baseline',
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      margin: 'auto',
      maxWidth: 1000,
    }
    const textStyle: React.CSSProperties = {
      flex: 1,
      fontSize: 14,
      lineHeight: '20px',
      marginRight: isMobileVersion ? 'initial' : 100,
      padding: isMobileVersion ? '0 20px' : 'initial',
    }
    // TODO(marielaure): Make sure the button is below the "See my advice" button in mobile.
    const shareButtonStyle: React.CSSProperties = {
      alignSelf: isMobileVersion ? 'center' : 'flex-end',
      flexShrink: 0,
      marginBottom: 30,
    }

    // TODO(marielaure): Move the close button to the center-left.
    const closeStyle: React.CSSProperties = {
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
      {onClose ? <ModalCloseButton onClick={onClose} style={closeStyle} /> : null}
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
        onClose={this.handleHideShareBob} isShown={isShareBobShown}
        title="Partagez avec vos amis" dispatch={dispatch}
        campaign="as" visualElement="assessment"
        intro={<React.Fragment>
          <strong>Merci&nbsp;!</strong><br />
          on s'occupe du reste&nbsp;!
        </React.Fragment>} />
    </div>
  }
}


type ModalProps = Omit<ModalConfig, 'children'> & ButtonsProps & {
  intro: React.ReactNode
}


class ShareModal extends React.PureComponent<ModalProps> {
  public static propTypes = {
    children: PropTypes.node,
    intro: PropTypes.node,
    isShown: PropTypes.bool,
    style: PropTypes.object,
    title: PropTypes.string,
  }

  public render(): React.ReactNode {
    const {children, intro, style, title, ...otherProps} = this.props
    const modalStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      fontWeight: 'normal',
      justifyContent: 'space-between',
      lineHeight: 1.19,
      margin: 20,
      width: isMobileVersion ? 'initial' : 500,
      ...style,
    }
    const contentStyle = {
      padding: isMobileVersion ? 30 : '30px 50px 50px',
    }
    // TODO(cyrille): Add content in share links (quote/hashtag in FB, title/desc in LinkedIn, ...).
    return <Modal style={modalStyle} title={title} {...otherProps}>
      <div style={contentStyle}>
        {intro ? <div style={{marginBottom: 15}}>
          {intro}
        </div> : null}

        <ShareButtons {..._pick(this.props, ['campaign', 'dispatch', 'url', 'visualElement'])} />

        {children ? <div style={{marginTop: 15}}>
          {children}
        </div> : null}
      </div>
    </Modal>
  }
}


interface ButtonsProps {
  campaign?: string
  dispatch?: DispatchAllActions
  url?: string
  visualElement?: string
}


interface ButtonsState {
  canBrowserShare: boolean
  isShareLinkJustCopied: boolean
  shareButtonWidth: number
}


class ShareButtons extends React.PureComponent<ButtonsProps, ButtonsState> {
  public static propTypes = {
    // The IDs are referenced at https://airtable.com/tblpbiUqtvn3poeXd.
    campaign: PropTypes.string,
    dispatch: PropTypes.func,
    url: PropTypes.string,
    // The visual element reference that explains the context in which this
    // modal is shown. This is only to differentiate in logs.
    visualElement: PropTypes.string.isRequired,
  }

  public state = {
    canBrowserShare: !!navigator.share,
    isShareLinkJustCopied: false,
    shareButtonWidth: 115,
  }

  public componentDidMount(): void {
    const {dispatch, visualElement} = this.props
    if (dispatch && visualElement) {
      dispatch(shareProductModalIsShown(visualElement))
    }
    if (this.buttonRef && this.buttonRef.current) {
      this.setState({shareButtonWidth: this.buttonRef.current.offsetWidth})
    }
  }

  public componentWillUnmount(): void {
    clearTimeout(this.timeout)
  }

  private timeout?: number

  private getLink(): string {
    const {campaign, url} = this.props
    return url ? url : getAbsoluteUrl(Routes.INVITE_PATH + (campaign ? `#${campaign}` : ''))
  }

  private dispatchShared = (): void => {
    const {dispatch, visualElement} = this.props
    if (dispatch && visualElement) {
      dispatch(shareProductToNetwork(visualElement))
    }
  }

  // TODO(cyrille): Reinstate default share if canBrowserShare.
  private copyShareLink = (): void => {
    const {canBrowserShare} = this.state
    if (!this.shareLinkRef || !this.shareLinkRef.current) {
      return
    }
    this.dispatchShared()
    this.shareLinkRef.current.select()
    if (canBrowserShare) {
      navigator.share && navigator.share({title: config.productName, url: this.getLink()})
    }
    document.execCommand('Copy')
    this.setState({isShareLinkJustCopied: true})
    this.timeout =
      window.setTimeout((): void => this.setState({isShareLinkJustCopied: false}), 4000)
  }

  private buttonRef: React.RefObject<HTMLDivElement> = React.createRef()

  private shareLinkRef: React.RefObject<Textarea> = React.createRef()

  private renderShareLink = (): React.ReactNode => {
    const {canBrowserShare, isShareLinkJustCopied, shareButtonWidth} = this.state
    const inputStyle: React.CSSProperties = {
      border: `solid 1px ${colors.SILVER}`,
      borderRadius: 4,
      justifyContent: 'center',
      minHeight: 58,
      padding: `10px ${shareButtonWidth}px 10px 15px`,
      resize: 'none',
      width: '100%',
    }
    const buttonStyle: React.CSSProperties = {
      bottom: 0,
      height: 40,
      margin: 'auto 0px',
      position: 'absolute',
      right: 9,
      top: 0,
    }
    const shareLinkCopiedStyle: React.CSSProperties = {
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
      <Textarea
        readOnly={true} className="blue-select"
        style={inputStyle}
        value={`Je recommande à tous mes amis en recherche d'emploi ${this.getLink()}`}
        ref={this.shareLinkRef} />
      <div ref={this.buttonRef} style={buttonStyle}>
        <Button
          onClick={this.copyShareLink} isRound={true} >
          {canBrowserShare ? 'Partager' : 'Copier'}
        </Button>
      </div>
      <span style={shareLinkCopiedStyle}>
        Lien copié dans le presse papier
      </span>
    </div>
  }

  public render(): React.ReactNode {
    const link = this.getLink()
    const iconProps = {
      size: isMobileVersion ? 50 : 32,
    }
    const iconStyle: React.CSSProperties = {
      borderRadius: 5,
      cursor: 'pointer',
      display: 'block',
      height: iconProps.size,
      marginBottom: 5,
      marginRight: isMobileVersion ? 'initial' : 5,
      overflow: 'hidden',
      width: iconProps.size,
    }
    const buttonsContainerStyle: React.CSSProperties = {
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
          <FbMessengerShareButton url={link} beforeOnClick={this.dispatchShared}>
            <img src={facebookMessengerIcon} alt="messenger" style={iconStyle} />
          </FbMessengerShareButton>
          <SmsShareButton url={link} beforeOnClick={this.dispatchShared}>
            <img src={smsIcon} alt="sms" style={iconStyle} />
          </SmsShareButton>
        </React.Fragment> : null}
        <EmailShareButton url={link} beforeOnClick={this.dispatchShared} openWindow={true}>
          <img src={emailIcon} alt="email" style={iconStyle} />
        </EmailShareButton>
        {/* Filler for regular space-between on different rows from flex-wrap. */}
        {new Array(3).fill(0).map((unused, index): React.ReactNode =>
          <div style={{height: 0, width: iconProps.size}} key={`filler-${index}`} />)}
      </div>
      {isMobileVersion ? null : this.renderShareLink()}
    </React.Fragment>
  }
}


export {ShareBanner, ShareButtons, ShareModal}
