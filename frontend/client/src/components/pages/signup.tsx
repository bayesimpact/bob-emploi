import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useLayoutEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useHistory, useLocation} from 'react-router'

import {DispatchAllActions, RootState, closeLoginModal, loginUserFromToken, openLoginModal,
  openRegistrationModal} from 'store/actions'
import {parseQueryString} from 'store/parse'

import {Trans} from 'components/i18n'
import {LoginButton, LoginMethods} from 'components/login'
import {isMobileVersion} from 'components/mobile'
import {ModalCloseButton} from 'components/modal'
import {Routes, SIGNUP_HASH} from 'components/url'
import bobHeadImage from 'images/bob-head.svg'

import {WaitingPage} from './waiting'


const SignUpPageBase = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllActions>()
  const history = useHistory()
  const hasLoginModal = useSelector(({app: {loginModal}}: RootState): boolean => !!loginModal)
  const canCloseModal = useSelector(
    ({app: {loginModal}}: RootState): boolean =>
      !!loginModal && !(loginModal.defaultValues && loginModal.defaultValues.resetToken),
  )
  const {hash, pathname, search, state} = useLocation<{pathname?: string}>()
  const [hadLoginModal, setHadLoginModal] = useState(hasLoginModal)

  useLayoutEffect((): void => {
    if (hasLoginModal === hadLoginModal) {
      return
    }
    if (!hasLoginModal) {
      if (pathname === Routes.SIGNUP_PAGE) {
        history.goBack()
        return
      }
      history.replace(hash || search ? pathname : Routes.ROOT)
    }
    setHadLoginModal(hasLoginModal)
  }, [hadLoginModal, hasLoginModal, hash, history, pathname, search])

  useLayoutEffect((): void => {
    if (isMobileVersion && hasLoginModal) {
      return
    }
    const {authToken, email = '', resetToken, state, userId: userId} =
      parseQueryString(search)
    if (hash === SIGNUP_HASH) {
      dispatch(openRegistrationModal({email}, 'urlHash'))
      return
    }
    if (resetToken) {
      dispatch(openLoginModal({email, resetToken}, 'resetpassword'))
      return
    }
    if (state) {
      dispatch(openLoginModal({email}, 'redirect-connect'))
      return
    }
    if (userId && authToken) {
      dispatch(loginUserFromToken(userId, authToken))
      return
    }
    dispatch(openLoginModal({email}, 'returninguser'))
  }, [dispatch, hash, hasLoginModal, search])

  useEffect((): (() => void) => {
    return (): void => void dispatch(closeLoginModal())
  }, [dispatch])

  const handleClick = useCallback((): void => {
    dispatch(closeLoginModal())
  }, [dispatch])

  if (isMobileVersion) {
    const containerStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
    }
    const closeButtonStyle: React.CSSProperties = {
      backgroundColor: colors.PINKISH_GREY,
      boxShadow: 'unset',
      right: 20,
      top: 20,
      transform: 'initial',
    }
    return <div style={containerStyle}>
      {canCloseModal ? <ModalCloseButton
        style={closeButtonStyle} onClick={handleClick} /> : null}
      <LoginMethods forwardLocation={state?.pathname || '/'} onFinish={handleClick} />
    </div>
  }
  return <WaitingPage />
}
const SignUpPage = React.memo(SignUpPageBase)


interface BannerProps {
  onClose?: () => void
  style?: React.CSSProperties
}

const closeStyle: React.CSSProperties = {
  backgroundColor: colors.SLATE,
  boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.2)',
  color: '#fff',
  fontSize: 12,
  height: 35,
  width: 35,
}
const textBannerStyle: React.CSSProperties = {
  fontSize: 18,
  fontStyle: 'italic',
  padding: isMobileVersion ? 20 : '33px 32px 35px',
}

const SignUpBannerBase = (props: BannerProps): React.ReactElement|null => {
  const {onClose, style} = props
  const {t} = useTranslation()
  const [isShown, setIsShown] = useState(true)

  const handleClose = useCallback((): void => {
    setIsShown(false)
    onClose?.()
  }, [onClose])

  const bannerStyle: React.CSSProperties = {
    alignItems: 'center',
    backgroundColor: '#fff',
    border: isMobileVersion ? `solid 2px ${colors.SILVER}` : 'initial',
    borderRadius: 10,
    boxShadow: isMobileVersion ? 'initial' : '0 4px 14px 0 rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: isMobileVersion ? 'column' : 'row',
    paddingBottom: isMobileVersion ? 20 : 0,
    paddingRight: isMobileVersion ? 0 : 40,
    position: 'relative',
    textAlign: isMobileVersion ? 'center' : 'left',
    ...style,
    ...(isMobileVersion ? {width: 'calc(100vw - 40px)'} : {}),
  }

  if (!isShown) {
    // TODO(pascal): Add a transition when hiding the banner.
    return null
  }

  return <div style={bannerStyle}>
    <ModalCloseButton onClick={handleClose} style={closeStyle} />
    {isMobileVersion ? null :
      <img src={bobHeadImage} alt="" style={{marginLeft: 32, width: 56}} />}
    {isMobileVersion ? <Trans style={textBannerStyle} parent="span">

      Pensez à sauvegarder votre progression
    </Trans> : <Trans style={textBannerStyle} parent="span">
      Pensez à créer votre compte pour sauvegarder votre progression
    </Trans>}
    <span style={{flex: 1}}></span>
    <LoginButton
      type="navigation" isRound={true} visualElement="diagnostic">
      {t('Créer mon compte')}
    </LoginButton>
  </div>

}
SignUpBannerBase.propTypes = {
  onClose: PropTypes.func,
  style: PropTypes.object,
}
const SignUpBanner = React.memo(SignUpBannerBase)


export {SignUpBanner, SignUpPage}
