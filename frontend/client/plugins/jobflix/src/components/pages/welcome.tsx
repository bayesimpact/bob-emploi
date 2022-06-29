import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useHistory} from 'react-router-dom'
import {useDispatch, useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'
import useDocumentTitle from 'hooks/document_title'
import isMobileVersion from 'store/mobile'

import type {Focusable} from 'components/autocomplete'
import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import LabeledToggle from 'components/labeled_toggle'

import WelcomeHeader from 'plugin/deployment/welcome_header'
import welcomeBackgroundImage from 'plugin/deployment/welcome_background'

import type {DispatchAllUpskillingActions} from '../../store/actions'
import {setCityUpskillingAction} from '../../store/actions'

import DepartementSuggest, {countryAreaContext, fullContext, useCity} from '../departement'

const pageContainerStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_WELCOME,
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  ...welcomeBackgroundImage ? {
    backgroundImage: `url(${welcomeBackgroundImage})`,
    backgroundPosition: 'center, center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  } : {},
}
const pageStyle: React.CSSProperties = {
  backgroundColor: welcomeBackgroundImage ? 'transparent' : colors.BACKGROUND_WELCOME,
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  justifyContent: 'center',
  margin: '0 auto',
  maxWidth: 570,
  padding: isMobileVersion ? '20px 30px 60px' : 0,
  textAlign: 'center',
}
const contentStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_WELCOME,
  fontSize: 19,
  ...config.hasRoundEdges ? {borderRadius: 20} : {},
  ...welcomeBackgroundImage ? {padding: '50px 30px'} : {},
}
const selfCenteredStyle: React.CSSProperties = {
  alignSelf: 'center',
  backgroundColor: colors.NAVIGATION_BUTTON_BACKGROUND,
  marginTop: isMobileVersion ? 30 : 50,
  textShadow: 'none',
  width: isMobileVersion ? '100%' : 'auto',
  ...config.hasRoundEdges ? {borderRadius: '100px'} : {},
}

const titleStyle: React.CSSProperties = {
  fontFamily: config.titleFont || config.font,
  fontSize: isMobileVersion ? 20 : 34,
  margin: '0 0 1em',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: isMobileVersion ? 16 : 20,
  margin: '0 0 2em',
}

const departementLabelStyle: React.CSSProperties = {
  fontSize: 16,
  margin: '0 0 5px',
  textAlign: 'left',
}

const errorStyle = {
  color: colors.ERROR_RED,
  margin: '10px 0 0',
}


const WelcomePage = () => {
  const {t} = useTranslation()
  const history = useHistory()
  const [isValidated, setIsValidated] = useState(false)

  const reduxCity = useCity()
  const reduxCityPersistent = useSelector(
    ({app}: {app: AppState}) => !!app.upskillingIsCityPersistent)
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const [city, setCity] = useState<bayes.bob.FrenchCity|undefined>(reduxCity)
  const [isCityPersistent, setIsCityPersistent] = useState(reduxCityPersistent)
  const toggleDepartementPersistent = useCallback(
    () => setIsCityPersistent((wasPersistent: boolean) => !wasPersistent), [])

  const suggestRef = useRef<Focusable>(null)
  const nextStep = useCallback(() => {
    if (!city?.departementId) {
      setIsValidated(true)
      suggestRef.current?.focus()
      return
    }

    const cityWithDptId = city as bayes.bob.FrenchCity & {departementId: string}
    dispatch(setCityUpskillingAction(cityWithDptId, isCityPersistent))
    history.push('/')
  }, [city, dispatch, history, isCityPersistent])

  const hasValidDepartement = !!city?.departementId
  const fastForward = useCallback((): void|boolean => {
    if (!hasValidDepartement) {
      return true
    }
    nextStep()
  }, [hasValidDepartement, nextStep])
  useFastForward(fastForward)
  const [isFocused, setIsFocused] = useState(false)
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])
  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])
  const isDepartementError = isValidated && !hasValidDepartement
  const departementSuggestStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: 'transparent',
    borderColor: isDepartementError ?
      colors.ERROR_RED : colorToAlpha(colors.DEPARTEMENT_SUGGEST_BORDER, isFocused ? 1 : .5),
    borderRadius: 3,
    color: colors.DEPARTEMENT_SUGGEST_COLOR,
    fontFamily: config.font,
    fontSize: 16,
    fontStyle: 'italic',
    minWidth: isMobileVersion ? 'initial' : 470,
  }), [isDepartementError, isFocused])
  const departementLabelId = useMemo(_uniqueId, [])
  const errorId = useMemo(_uniqueId, [])
  const checkboxStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isCityPersistent ? colors.BOB_BLUE : 'transparent',
  }), [isCityPersistent])
  // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
  const departementQuestion = t('Entrez un département\u00A0:', countryAreaContext)
  useDocumentTitle(`${config.productName} | ${departementQuestion}`)
  return <main style={pageContainerStyle} role="main">
    <WelcomeHeader />
    <div style={pageStyle}>
      <div style={contentStyle}>
        {welcomeBackgroundImage ? null :
          <span style={{fontSize: 45, marginBottom: 20}} aria-hidden={true}>🔥</span>}
        <h1 style={titleStyle}>
          {
            // eslint-disable-next-line max-len
            // i18next-extract-mark-context-next-line ["career_fr_DEPARTEMENT", "career_uk_CITY", "promising-job_fr_CITY"]
            t('Découvrez les meilleures carrières dans votre département', fullContext)
          }
        </h1>
        <p style={subtitleStyle}>
          {
            // i18next-extract-mark-context-next-line ["career", "promising-job"]
            t('Puis trouvez une formation adaptée', {context: config.goalWordingContext})
          }
        </p>
        <div style={{color: colors.DEPARTEMENT_SUGGEST_COLOR}}>
          <div className="jobflix-autocomplete">
            <p id={departementLabelId} style={departementLabelStyle}>
              {departementQuestion}
            </p>
            <DepartementSuggest
              style={departementSuggestStyle} ref={suggestRef}
              onFocus={handleFocus} onBlur={handleBlur} aria-labelledby={departementLabelId}
              onChange={setCity} value={city || undefined}
              aria-describedby={(isValidated && !hasValidDepartement) ? errorId : undefined} />
            <div style={{fontSize: 16, marginTop: 10, textAlign: 'left'}}>
              <LabeledToggle
                isSelected={isCityPersistent} onClick={toggleDepartementPersistent}
                inputStyle={checkboxStyle}
                label={
                  // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
                  t('Se souvenir de mon département sur cet appareil', countryAreaContext)
                } type="checkbox" />
            </div>
            <p style={{fontSize: isMobileVersion ? 12 : 14, fontStyle: 'italic', marginTop: 20}}>
              {
                // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
                t('Vous pourrez modifier votre département à tout moment', countryAreaContext)
              }
            </p>
          </div>
        </div>
        <Button style={selfCenteredStyle} onClick={nextStep} type="navigation">
          {t('Voir les métiers maintenant')}</Button>
        {isValidated && !hasValidDepartement ? <p style={errorStyle} id={errorId}>{
          // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
          t(
            'Saisissez un département valide avant de continuer (exemple\u00A0: 42, Loire, ' +
            'Gers, …)',
            countryAreaContext,
          )
        }</p> : null}
      </div>
    </div>
  </main>
}
export default React.memo(WelcomePage)
