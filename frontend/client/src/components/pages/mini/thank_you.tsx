import {FastForward} from 'components/fast_forward'
import PropTypes from 'prop-types'
import React, {useEffect, useCallback, useMemo} from 'react'
import {connect} from 'react-redux'

import likeImage from 'images/mini/like.svg'

import {GenericPage} from './page'
import {MiniRootState, DispatchActions, Routes, makeUrlUser} from './store'
import {Button} from './theme'


interface ThankYouProps {
  dispatch: DispatchActions
  isUserSupervised: boolean
  user: string
}


const pageStyle: React.CSSProperties = {
  color: colors.MINI_WARM_GREY,
  fontSize: 19,
  textAlign: 'center',
}
const imageBackgroundStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.MINI_FOOTER_GREY,
  borderRadius: 84,
  display: 'flex',
  height: 168,
  justifyContent: 'center',
  margin: '0 auto 15px',
  width: 168,
}
const restartButtonstyle: React.CSSProperties = {
  position: 'absolute',
  right: 15,
  top: 80,
}


const ThankYouPageBase: React.FC<ThankYouProps> = (props: ThankYouProps): React.ReactElement => {
  const {dispatch, isUserSupervised, user} = props

  useEffect(() => {
    dispatch({type: 'MINI_GENERATE_SUMMARY'})
  })

  const handleRestart = useCallback((event: React.MouseEvent): void => {
    if (window.confirm('Êtes-vous sûr·e de vouloir supprimer toutes les réponses\u00A0?')) {
      dispatch({type: 'MINI_ONBOARDING_RESTART'})
    } else {
      event.preventDefault()
    }
  }, [dispatch])

  const bottomButton = useMemo((): React.ReactNode => <React.Fragment>
    <div style={{marginBottom: 30, width: 350}}>
      Tu peux maintenant imprimer ton bilan et tes réponses détaillées.
    </div>
    <Button target="_blank" to={`${Routes.BILAN_PAGE}/imprimer#${user}`}>
      Imprimer mon bilan
    </Button>
  </React.Fragment>, [user])

  const redirectTo = isUserSupervised ? Routes.HUB_PAGE : Routes.USER_LANDING_PAGE

  return <GenericPage
    hasLogo={true} bottomButton={bottomButton} style={pageStyle} footerSize={216}>
    <FastForward to={Routes.BILAN_PAGE} />
    <Button to={redirectTo} type="back" style={restartButtonstyle} onClick={handleRestart}>
      Recommencer
    </Button>
    <div style={{flex: 1}} />
    <div style={imageBackgroundStyle}>
      <img src={likeImage} style={{width: 140}} alt="" />
    </div>
    <div style={{color: colors.MINI_PEA, fontFamily: 'Fredoka One', fontSize: 40}}>
      Merci&nbsp;!
    </div>
    <div style={{marginBottom: 30, marginTop: 25, width: 420}}>
      Voici le bilan à partir duquel tu peux échanger avec un professionnel de la Mission Locale.
    </div>
    <Button to={Routes.BILAN_PAGE}>
      Afficher mon bilan
    </Button>
    <div style={{flex: 1}} />
  </GenericPage>
}
ThankYouPageBase.propTypes = {
  dispatch: PropTypes.func.isRequired,
  isUserSupervised: PropTypes.bool.isRequired,
  user: PropTypes.string.isRequired,
}
const ThankYouPage = connect(({app: {isUserSupervised}, user}: MiniRootState) =>
  ({isUserSupervised: !!isUserSupervised, user: makeUrlUser(user)}))(React.memo(ThankYouPageBase))


export {ThankYouPage}
