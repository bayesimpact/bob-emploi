import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Link, useHistory} from 'react-router-dom'
import {useDispatch, useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'
import useRouteStepper from 'hooks/stepper'
import {RootState} from 'store/actions'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import {Departement, DepartementSuggest} from 'components/suggestions'

import {DispatchAllUpskillingActions, setDepartementUpskillingAction} from '../../store/actions'

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  height: '100vh',
  justifyContent: 'center',
  margin: '0 auto',
  maxWidth: 570,
  padding: isMobileVersion ? '20px 30px 60px' : '100px 0',
  textAlign: 'center',
}
const contentStyle: React.CSSProperties = {
  fontSize: 19,
}
const selfCenteredStyle: React.CSSProperties = {
  alignSelf: 'center',
}


const WelcomePage = () => {
  const {t} = useTranslation()
  const [step, goToStep] = useRouteStepper(2)
  const history = useHistory()
  const dispatch: DispatchAllUpskillingActions = useDispatch()
  const departementId = useSelector(
    ({user}: RootState) => user?.projects?.[0]?.city?.departementId)
  const [departement, setDepartement] = useState<Departement>({id: departementId})
  const nextStep = useCallback(() => {
    if (!departementId) {
      if (step) {
        goToStep(0)
      }
      return
    }
    if (!step) {
      goToStep(1)
      return
    }
    history.push('/')
  }, [departementId, goToStep, history, step])

  const handleDepartementChange = useCallback((departement: Departement|null): void => {
    if (!departement || !departement.id || departement.id === departementId) {
      return
    }
    setDepartement(departement)
    dispatch(setDepartementUpskillingAction(departement.id))
  }, [departementId, dispatch])
  const fastForward = useCallback((): void => {
    if (!departementId) {
      handleDepartementChange({id: '45', name: 'Loiret'})
      return
    }
    nextStep()
  }, [departementId, handleDepartementChange, nextStep])
  useFastForward(fastForward)
  const [isFocused, setIsFocused] = useState(false)
  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])
  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])
  const departementSuggestStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    borderColor: colorToAlpha('#fff', isFocused ? 1 : .5),
    borderRadius: 3,
    color: colors.WHITE_THREE,
    fontFamily: 'Lato, Helvetica',
    fontSize: 20,
    fontStyle: 'italic',
    minWidth: isMobileVersion ? 'initial' : 470,
  }

  const icon = step ? '🚀' : '🔥'
  const title = step ? t('Trouvez la formation adaptée') :
    t('Découvrez les meilleures carrières dans votre département')
  const content = step ? t('Dans votre département ou votre région') :
    <div className="jobflix-autocomplete">
      <DepartementSuggest onChange={handleDepartementChange} style={departementSuggestStyle}
        value={departement} onFocus={handleFocus} onBlur={handleBlur}
        placeholder={t('🔎 Choisissez un département')} />
      <p style={{fontSize: 14, fontStyle: 'italic'}}>
        {t('Vous pourrez modifier votre département à tout moment')}
      </p>
    </div>
  const StepButton = step ? <Link to="/"><Button type="navigation">
    {t('Voir les carrières maintenant')}</Button></Link> :
    <Button style={selfCenteredStyle} onClick={nextStep} type="navigation">{t('Valider')}</Button>
  return <div style={pageStyle}>
    <div style={{flex: 1}} />
    <div style={contentStyle}>
      <div style={{fontSize: 45, marginBottom: 20}} role="img" aria-label="">{icon}</div>
      <div style={{fontSize: 34, fontWeight: 'bold', marginBottom: '2em'}}>{title}</div>
      <div style={{color: colors.WHITE_THREE}}>{content}</div>
    </div>
    <div style={{flex: 1}} />
    <div style={{flex: 1}}>{StepButton}</div>
  </div>
}
export default React.memo(WelcomePage)
