import ArrowLeftIcon from 'mdi-react/ArrowLeftIcon'
import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {useHistory, useRouteMatch} from 'react-router'

import {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import {colorToAlpha} from 'components/colors'
import {Departement, DepartementSuggest} from 'components/suggestions'

import {DispatchAllUpskillingActions, setDepartementUpskillingAction} from '../store/actions'
import Menu from './menu'

interface RouteMatch {
  jobId?: string
  sectionId?: string
}
const topBarStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.PURPLISH_BROWN,
  color: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  minHeight: 60,
  padding:
    `${isMobileVersion ? 10 : 0}px ${isMobileVersion ? 10 : 60}px ${isMobileVersion ? 7 : 0}px`,
  width: '100%',
}
const topBarContentStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'grid',
  gridTemplateColumns: `1fr ${isMobileVersion ? 'auto' : '1fr'} 1fr`,
  width: '100%',
}
const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 17,
  fontWeight: 'bold',
  textTransform: 'uppercase',
}
const subtitleStyle: React.CSSProperties = {
  color: colors.WINDOWS_BLUE_TWO,
  fontSize: 17,
}
const deptSuggestContainerStyle: React.CSSProperties = {
  height: 37,
  maxWidth: 437,
  ...isMobileVersion ? {
    gridColumnEnd: 4,
    gridColumnStart: 1,
    gridRowStart: 2,
    marginTop: 17,
    width: '100%',
  } : {},
}
const backArrowStyle: React.CSSProperties = {
  color: '#fff',
}

const TopBar = (): React.ReactElement => {
  const {t} = useTranslation()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const departementId = useSelector(
    ({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  // TODO(émilie): get the departement data from redux to display in the suggest value.
  const [departement, setDepartement] = useState<Departement>({id: departementId})

  const handleDepartementChange = useCallback((departement: Departement|null): void => {
    if (!departement?.id || departement.id === departementId) {
      return
    }
    setDepartement(departement)
    dispatch(setDepartementUpskillingAction(departement.id))
  }, [departementId, dispatch])

  const [isFocused, setIsFocused] = useState(false)
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])
  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])
  const isAtRoot = (useRouteMatch<RouteMatch>()?.url || '/') === '/'
  const history = useHistory()
  const goBack = useCallback(() => history.goBack(), [history])
  const departementSuggestStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    borderColor: colorToAlpha('#fff', isFocused ? 1 : .5),
    borderRadius: 3,
    color: colors.WHITE_THREE,
    fontFamily: 'Lato, Helvetica',
    fontSize: 14,
    fontStyle: 'italic',
    height: 37,
  }

  return <nav style={topBarStyle}>
    <div style={topBarContentStyle}>
      {isMobileVersion && !isAtRoot ?
        <button onClick={goBack}><ArrowLeftIcon style={backArrowStyle} /></button> : null}
      <div style={{gridColumnStart: isMobileVersion ? 2 : 1}}>
        <span style={titleStyle}>{config.productName}</span>
        &nbsp;
        <span style={subtitleStyle}>{t('(beta)')}</span>
      </div>
      {isAtRoot ? <div className="jobflix-autocomplete" style={deptSuggestContainerStyle}>
        <DepartementSuggest onChange={handleDepartementChange} style={departementSuggestStyle}
          onFocus={handleFocus} onBlur={handleBlur} value={departement} />
      </div> : null}
      <div style={{gridColumnStart: 3, textAlign: 'right'}}>
        <Menu />
      </div>
    </div>
  </nav>
}

export default React.memo(TopBar)
