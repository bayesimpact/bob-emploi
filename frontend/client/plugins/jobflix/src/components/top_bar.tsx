import _uniqueId from 'lodash/uniqueId'
import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useHistory, useRouteMatch} from 'react-router'

import isMobileVersion from 'store/mobile'

import type {Focusable} from 'components/autocomplete'
import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import ExternalLink from 'components/external_link'
import LabeledToggle from 'components/labeled_toggle'

import logo from 'deployment/bob-logo.svg'
import DepartementSuggest, {DepartementName, countryAreaContext} from './departement'
import Menu from './menu'

import type {DispatchAllUpskillingActions} from '../store/actions'
import {setCityUpskillingAction} from '../store/actions'

interface RouteMatch {
  jobId?: string
  sectionId?: string
}
const topBarStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.NAVIGATION_BACKGROUND,
  color: colors.NAVIGATION_TEXT,
  display: 'flex',
  justifyContent: 'space-between',
  minHeight: 60,
  padding:
    `${isMobileVersion ? 10 : 0}px ${isMobileVersion ? 10 : 50}px ${isMobileVersion ? 7 : 0}px`,
  width: '100%',
}
const topBarContentStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'grid',
  gridTemplateColumns: `1fr ${isMobileVersion ? 'auto' : '2fr'} 1fr`,
  width: '100%',
}
const inlinePStyle: React.CSSProperties = {
  display: 'inline',
  margin: 0,
}
const titleStyle: React.CSSProperties = {
  color: colors.NAVIGATION_TEXT,
  display: 'inline',
  fontSize: 17,
  fontWeight: 'bold',
  margin: 0,
  textTransform: 'uppercase',
}
const deptSuggestContainerStyle: React.CSSProperties = {
  padding: '5px 0',
  textAlign: 'center',
  ...isMobileVersion ? {
    gridColumnEnd: 4,
    gridColumnStart: 1,
    gridRowStart: 2,
    marginTop: 17,
    width: '100%',
  } : {},
}
const backArrowStyle: React.CSSProperties = {
  color: colors.TEXT,
}
const editButtonStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: 'transparent',
  border: `1px solid ${colors.PINKISH_GREY_TWO}`,
  boxShadow: 'none',
  color: colors.TEXT,
  display: 'inline-flex',
  fontSize: 14,
  fontWeight: 'bold',
  margin: '0 0 0 10px',
  padding: isMobileVersion ? 8 : 10,
  textShadow: 'none',
}
const editCityStyle: React.CSSProperties = {
  textAlign: 'left',
}
const cityLabelStyle: React.CSSProperties = {
  fontSize: 16,
  margin: '0 0 5px',
}
const errorStyle = {
  color: colors.ERROR_RED,
  margin: '10px 0 0',
}

const EditableDepartementNameBase = (): React.ReactElement => {
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const [isFocused, setIsFocused] = useState(false)
  const {t} = useTranslation()
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])
  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])
  const departementSuggestStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: 'transparent',
    borderColor: colorToAlpha(colors.DEPARTEMENT_SUGGEST_BORDER, isFocused ? 1 : .5),
    borderRadius: 3,
    color: colors.DEPARTEMENT_SUGGEST_COLOR,
    fontFamily: config.font,
    fontSize: 14,
    fontStyle: 'italic',
    height: 37,
  }), [isFocused])
  const [isEditingCity, setIsEditingCity] = useState(false)
  const [isValidated, setIsValidated] = useState(false)
  const [city, setCity] = useState<bayes.bob.FrenchCity|undefined>()

  const reduxCityPersistent = useSelector(
    ({app}: {app: AppState}) => !!app.upskillingIsCityPersistent)
  const [isCityPersistent, setIsCityPersistent] = useState(reduxCityPersistent)
  const toggleCityPersistent = useCallback(
    () => setIsCityPersistent((wasPersistent: boolean) => !wasPersistent), [])
  const checkboxStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: isCityPersistent ? colors.BOB_BLUE : 'transparent',
  }), [isCityPersistent])

  const handleEditCity = useCallback(() => {
    setCity(undefined)
    setIsValidated(false)
    setIsEditingCity(true)
  }, [])
  const suggestRef = useRef<Focusable>(null)
  const handleSetCity = useCallback((e: React.SyntheticEvent): void => {
    e.preventDefault()
    if (!city?.departementId) {
      setIsValidated(true)
      suggestRef.current?.focus()
      return
    }
    const cityWithDptId = city as bayes.bob.FrenchCity & {departementId: string}
    dispatch(setCityUpskillingAction(cityWithDptId, isCityPersistent))
    setIsEditingCity(false)
  }, [city, dispatch, isCityPersistent])
  useEffect((): void => {
    if (!isEditingCity) {
      return
    }
    suggestRef.current?.focus()
  }, [isEditingCity])
  const cityLabelId = useMemo(_uniqueId, [])
  const errorId = useMemo(_uniqueId, [])
  if (isEditingCity) {
    return <form style={editCityStyle} onSubmit={handleSetCity}>
      <p id={cityLabelId} style={cityLabelStyle} aria-live="polite">
        {
          // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
          t(
            'Entrez un département\u00A0:',
            countryAreaContext,
          )
        }
      </p>
      <div style={{display: 'flex'}} className="jobflix-autocomplete">
        <DepartementSuggest style={departementSuggestStyle}
          onFocus={handleFocus} onBlur={handleBlur} ref={suggestRef}
          onChange={setCity} aria-labelledby={cityLabelId}
          aria-describedby={(isValidated && !city?.departementId) ? errorId : undefined}
          value={city || undefined} />
        <Button style={editButtonStyle} onClick={handleSetCity}>{t('Valider')}</Button>
      </div>
      {isValidated && !city?.departementId ? <p style={errorStyle} id={errorId}>{
        // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
        t(
          'Saisissez un département valide avant de continuer (exemple\u00A0: 42, Loire, ' +
          'Gers, …)',
          countryAreaContext,
        )
      }</p> : null}
      <LabeledToggle
        isSelected={isCityPersistent} onClick={toggleCityPersistent}
        style={{marginTop: 5}} inputStyle={checkboxStyle}
        label={
          // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
          t('Se souvenir de mon département sur cet appareil', countryAreaContext)
        } type="checkbox" />
    </form>
  }
  return <React.Fragment>
    <p style={inlinePStyle}>
      {
        // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
        t('Votre département\u00A0:', countryAreaContext)
      } <DepartementName />
    </p> <Button
      onClick={handleEditCity} style={editButtonStyle} isNarrow={true}
      // i18next-extract-mark-context-next-line ["fr_DEPARTEMENT", "uk_CITY", "fr_CITY"]
      type="navigation" aria-label={t('Modifier votre département', countryAreaContext)}>
      {t('Modifier')}
    </Button>
  </React.Fragment>
}
export const EditableDepartementName = React.memo(EditableDepartementNameBase)

const TopBar = ({isBlur}: {isBlur: boolean}): React.ReactElement => {
  const isAtRoot = (useRouteMatch<RouteMatch>()?.url || '/') === '/'
  const history = useHistory()
  const {t} = useTranslation()
  const goBack = useCallback(() => history.goBack(), [history])
  const logoContent = config.hasLogo ?
    <img src={logo} alt={t('Accueil')} height="40" style={{display: 'block'}} /> :
    <p style={titleStyle}>{config.productName}</p>
  const logoDisplay = config.logoUrl ?
    // TODO(émilie): Correct a11y for this link.
    <ExternalLink href={config.logoUrl}>{logoContent}</ExternalLink> : logoContent

  return <header role="banner" style={{...topBarStyle, ...isBlur && {filter: 'blur(1px)'}}}>
    <div style={topBarContentStyle}>
      {isMobileVersion && !isAtRoot ?
        <button onClick={goBack} type="button">
          <ArrowLeftIcon style={backArrowStyle} aria-label={t('Retour')} focusable={false} />
        </button> : null}
      <div style={{gridColumnStart: isMobileVersion ? 2 : 1}}>
        {logoDisplay}
      </div>
      {isAtRoot ? <div style={deptSuggestContainerStyle}><EditableDepartementName /></div> : null}
      <div style={{gridColumnStart: 3, textAlign: 'right'}}>
        <Menu />
      </div>
    </div>
  </header>
}

export default React.memo(TopBar)
