import _pick from 'lodash/pick'
import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {EmailShareButton, FacebookIcon, FacebookShareButton, LinkedinIcon, LinkedinShareButton,
  TwitterIcon, TwitterShareButton, WhatsappIcon, WhatsappShareButton} from 'react-share'

import type {DispatchAllActions} from 'store/actions'
import {shareProductModalIsShown, shareProductToNetwork} from 'store/actions'
import isMobileVersion from 'store/mobile'
import {isPromise} from 'store/promise'

import Button from 'components/button'
import Trans from 'components/i18n_trans'
import ModalCloseButton from 'components/modal_close_button'
import type {ModalConfig} from 'components/modal'
import {Modal, useModal} from 'components/modal'
import type {Inputable} from 'components/input'
import Textarea from 'components/textarea'
import {SmoothTransitions} from 'components/theme'
import {getAbsoluteUrl, Routes} from 'components/url'
import emailIcon from 'images/email-icon.png'
import facebookMessengerIcon from 'images/fb-messenger-logo.svg'
import smsIcon from 'images/sms-icon.png'


// TODO(pascal): Remove once we upgrade TypeScript to v3.9+
declare global {
  interface Navigator {
    share(data?: {text?: string; title?: string; url?: string}): Promise<void>
  }
}


interface ButtonProps {
  beforeOnClick?: () => void | Promise<void>
  children: React.ReactNode
  url: string
}


function useOpenUrl(url: string, beforeOnClick?: () => void | Promise<void>): (() => void) {
  return useCallback(async (): Promise<void> => {
    const promise = beforeOnClick && beforeOnClick()
    if (promise && isPromise(promise)) {
      await promise
    }
    window.open(url, '_blank')
  }, [beforeOnClick, url])
}

const buttonStyle: React.CSSProperties = {
  background: 'none',
  padding: 0,
}

const SmsShareButtonBase: React.FC<ButtonProps> = (props: ButtonProps): React.ReactElement => {
  const {beforeOnClick, children, url} = props
  const {t} = useTranslation('components')

  // TODO(cyrille): Make better (or more generic) text.
  const smsLink = useMemo((): string => {
    const text =
      t(
        'Salut\u00A0!\nTu connais {{productName}}\u00A0?\nEn 15 minutes, il te propose un ' +
        "diagnostic et des conseils personnalisés pour ta recherche d'emploi. Essaye, c'est " +
        'gratuit\u00A0!',
        {productName: config.productName},
      ) + '\n\n' + url
    return `sms:body=${encodeURIComponent(text)}`
  }, [t, url])

  const onClick = useOpenUrl(smsLink, beforeOnClick)

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  return <button style={buttonStyle} onClick={onClick} type="button">
    {children}
  </button>
}
const SmsShareButton = React.memo(SmsShareButtonBase)


const FbMessengerButtonBase: React.FC<ButtonProps> = (props: ButtonProps): React.ReactElement => {
  const {beforeOnClick, children, url} = props

  const link = useMemo((): string => {
    return `fb-messenger://share?link=${
      encodeURIComponent(url)
    }&app_id=${encodeURIComponent(config.facebookSSOAppId)}`
  }, [url])

  const onClick = useOpenUrl(link, beforeOnClick)

  // TODO(cyrille): Try not to render anything if protocol is not understood by browser.
  return <button style={buttonStyle} onClick={onClick} type="button">
    {children}
  </button>
}
const FbMessengerShareButton = React.memo(FbMessengerButtonBase)


interface BannerProps {
  dispatch: DispatchAllActions
  onClose?: () => void
  style?: React.CSSProperties
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
const shareButtonStyle: React.CSSProperties = {
  alignSelf: isMobileVersion ? 'center' : 'flex-end',
  flexShrink: 0,
  marginBottom: 30,
}
// TODO(sil): Move the close button to the center-left.
const closeStyle: React.CSSProperties = {
  backgroundColor: colors.COOL_GREY,
  boxShadow: 'initial',
  fontSize: 10,
  left: 0,
  position: 'static',
  right: 'initial',
  width: 35,
}


// TODO(cyrille): Find a way to put this back somewhere in the flow, we've had approx 20 people per
// months thanks to this one.
const ShareBannerBase: React.FC<BannerProps> = (props: BannerProps): React.ReactElement => {
  const {dispatch, onClose, style} = props
  const {t} = useTranslation('components')
  const [isShareBobShown, showModal, hideModal] = useModal()
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.PALE_BLUE,
    ...style,
  }), [style])
  const titleId = useMemo(_uniqueId, [])

  return <div style={containerStyle}>
    {onClose ?
      <ModalCloseButton onClick={onClose} style={closeStyle} aria-describedby={titleId} /> : null}
    <div style={messageStyle}>
      <div style={textStyle}>
        <p id={titleId}>
          <strong style={{fontSize: 18}}>
            {t('Nous avons une petite faveur à vous demander…')}
          </strong>
        </p>

        <Trans parent="p" ns="components">
          Nous pensons que personne ne devrait être seul dans sa recherche. C'est
          pourquoi <strong>{{productName: config.productName}} est entièrement gratuit et à but non
          lucratif.</strong> Notre mission est de redistribuer l'information pour éclairer
          le chemin de chacun. Mais nous n'avons pas le budget marketing d'une entreprise
          commerciale. Pour aider le plus de monde possible, nous avons besoin
          de vous.
        </Trans>

        <Trans parent="p" ns="components">
          <strong style={{color: colors.BOB_BLUE}}>
            En partageant {{productName: config.productName}} à une personne à qui nous pourrions
            être utiles, vous nous aidez à rendre le monde un peu meilleur
          </strong> - et ça ne prend qu'une minute.
        </Trans>

        <Trans parent="p" ns="components">
          Merci <span aria-label={t('on vous aime')} role="img">
            &#x2764;&#xfe0F;</span>
        </Trans>
      </div>
      <Button onClick={showModal} style={shareButtonStyle} type="validation">
        Partager {config.productName} maintenant
      </Button>
    </div>
    <ShareModal
      onClose={hideModal} isShown={isShareBobShown}
      title={t('Partagez avec vos amis')} dispatch={dispatch}
      campaign="as" visualElement="assessment"
      intro={<Trans parent={null} ns="components">
        <strong>Merci&nbsp;!</strong><br />
        on s'occupe du reste&nbsp;!
      </Trans>} />
  </div>
}
const ShareBanner = React.memo(ShareBannerBase)


type ModalProps = Omit<ModalConfig, 'children'> & ButtonsProps & {
  children?: React.ReactNode
  intro: React.ReactNode
}


const shareModalContentStyle = {
  padding: isMobileVersion ? 30 : '30px 50px 50px',
}
const shareModalIntroStyle = {
  marginBottom: 15,
}
const shareModalChildrenStyle = {
  marginTop: 15,
}


const ShareModalBase: React.FC<ModalProps> = (props: ModalProps): React.ReactElement => {
  const {children, intro, style, title, ...otherProps} = props
  const modalStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    fontWeight: 'normal',
    justifyContent: 'space-between',
    lineHeight: 1.19,
    margin: 20,
    width: isMobileVersion ? 'initial' : 500,
    ...style,
  }), [style])
  // TODO(cyrille): Add content in share links (quote/hashtag in FB, title/desc in LinkedIn, ...).
  return <Modal style={modalStyle} title={title} {...otherProps}>
    <div style={shareModalContentStyle}>
      {intro ? <div style={shareModalIntroStyle}>
        {intro}
      </div> : null}

      <ShareButtons {..._pick(props, ['campaign', 'dispatch', 'url', 'visualElement'])} />

      {children ? <div style={shareModalChildrenStyle}>
        {children}
      </div> : null}
    </div>
  </Modal>
}
const ShareModal = React.memo(ShareModalBase)


interface ButtonsProps {
  // The IDs are referenced at https://airtable.com/tblpbiUqtvn3poeXd.
  campaign?: string
  dispatch?: DispatchAllActions
  url?: string
  // The visual element reference that explains the context in which this
  // modal is shown. This is only to differentiate in logs.
  visualElement?: string
}


const canBrowserShare = !!navigator.share


const ShareButtonsBase = (props: ButtonsProps): React.ReactElement => {
  const {campaign, dispatch, url, visualElement} = props
  const [isShareLinkJustCopied, setIsShareLinkJustCopied] = useState(false)
  const [shareButtonWidth, setShareButtonWidth] = useState(115)

  useEffect((): void => {
    if (dispatch && visualElement) {
      dispatch(shareProductModalIsShown(visualElement))
    }
  }, [dispatch, visualElement])

  const buttonRef = useRef<HTMLDivElement>(null)
  useEffect((): void => {
    if (buttonRef.current) {
      setShareButtonWidth(buttonRef.current.offsetWidth)
    }
  }, [])

  const link = url ? url : getAbsoluteUrl(Routes.INVITE_PATH + (campaign ? `#${campaign}` : ''))

  const dispatchShared = useCallback((): void => {
    if (dispatch && visualElement) {
      dispatch(shareProductToNetwork(visualElement))
    }
  }, [dispatch, visualElement])

  const shareLinkRef = useRef<Inputable>(null)

  // TODO(cyrille): Reinstate default share if canBrowserShare.
  const copyShareLink = useCallback((): void => {
    if (!shareLinkRef.current) {
      return
    }
    dispatchShared()
    shareLinkRef.current.select()
    if (canBrowserShare) {
      navigator.share?.({title: config.productName, url: link})
    }
    document.execCommand('Copy')
    setIsShareLinkJustCopied(true)
  }, [dispatchShared, link])

  useEffect((): (() => void) => {
    if (!isShareLinkJustCopied) {
      return (): void => void 0
    }
    const timeout = window.setTimeout((): void => setIsShareLinkJustCopied(false), 4000)
    return (): void => {
      window.clearTimeout(timeout)
    }
  }, [isShareLinkJustCopied])

  const {t} = useTranslation('components')

  const shareLink = useMemo((): React.ReactNode => {
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
        value={t("Je recommande à tous mes amis en recherche d'emploi ") + link}
        ref={shareLinkRef} />
      <div ref={buttonRef} style={buttonStyle}>
        <Button
          onClick={copyShareLink} isRound={true} >
          {canBrowserShare ? t('Partager') : t('Copier')}
        </Button>
      </div>
      <span style={shareLinkCopiedStyle}>
        {t('Lien copié dans le presse papier')}
      </span>
    </div>
  }, [copyShareLink, isShareLinkJustCopied, link, shareButtonWidth, t])

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
      <FacebookShareButton url={link} style={iconStyle} beforeOnClick={dispatchShared}>
        <FacebookIcon {...iconProps} />
      </FacebookShareButton>
      <TwitterShareButton url={link} style={iconStyle} beforeOnClick={dispatchShared}>
        <TwitterIcon {...iconProps} />
      </TwitterShareButton>
      <LinkedinShareButton url={link} style={iconStyle} beforeOnClick={dispatchShared}>
        <LinkedinIcon {...iconProps} />
      </LinkedinShareButton>
      {isMobileVersion ? <React.Fragment>
        <WhatsappShareButton url={link} style={iconStyle} beforeOnClick={dispatchShared}>
          <WhatsappIcon {...iconProps} />
        </WhatsappShareButton>
        <FbMessengerShareButton url={link} beforeOnClick={dispatchShared}>
          <img src={facebookMessengerIcon} alt="messenger" style={iconStyle} />
        </FbMessengerShareButton>
        <SmsShareButton url={link} beforeOnClick={dispatchShared}>
          <img src={smsIcon} alt="sms" style={iconStyle} />
        </SmsShareButton>
      </React.Fragment> : null}
      <EmailShareButton url={link} beforeOnClick={dispatchShared} openShareDialogOnClick={true}>
        <img src={emailIcon} alt="email" style={iconStyle} />
      </EmailShareButton>
      {/* Filler for regular space-between on different rows from flex-wrap. */}
      {Array.from({length: 3}, (unused, index): React.ReactNode =>
        <div style={{height: 0, width: iconProps.size}} key={`filler-${index}`} />)}
    </div>
    {isMobileVersion ? null : shareLink}
  </React.Fragment>
}
const ShareButtons = React.memo(ShareButtonsBase)


export {ShareBanner, ShareButtons, ShareModal}
