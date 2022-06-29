import i18next from 'i18next'
import ExitToAppIcon from 'mdi-react/ExitToAppIcon'
import React, {Suspense, useCallback, useMemo, useState} from 'react'
import ReactDOM from 'react-dom'
import {useTranslation} from 'react-i18next'
import {Provider, useDispatch} from 'react-redux'
import type {Dispatch} from 'redux'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import {composeWithDevTools} from 'redux-devtools-extension'
import thunk from 'redux-thunk'

import type {DispatchAllActions, AllActions} from 'store/actions'
import {setUserProfile} from 'store/actions'
import createAmplitudeMiddleware from 'store/amplitude'
import {app} from 'store/app_reducer'
import {inDepartement, lowerFirstLetter, ofJobName} from 'store/french'
import {cleanHtmlError, hasErrorStatus} from 'store/http'
import {init as i18nInit, localizeOptions, prepareT} from 'store/i18n'
import {genderizeJob} from 'store/job'
import {Logger} from 'store/logging'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import {getTranslatedImpactMeasurement} from 'store/project'
import {useAsynceffect, useCancelablePromises} from 'store/promise'
import createSentryEnhancer from 'store/sentry'

import logoProductImage from 'deployment/bob-logo.svg?fill=%23fff'

import BobInteraction from 'components/bob_interaction'
import Button from 'components/button'
import CheckboxList from 'components/checkbox_list'
import Emoji from 'components/emoji'
import ExternalLink from 'components/external_link'
import FieldSet from 'components/field_set'
import Trans from 'components/i18n_trans'
import {useModal} from 'components/modal'
import {FixedButtonNavigation} from 'components/navigation'
import WaitingPage from 'components/pages/waiting'
import RadioGroup from 'components/radio_group'
import {ShareModal} from 'components/share'
import Snackbar from 'components/snackbar'
import Textarea from 'components/textarea'
import {MIN_CONTENT_PADDING} from 'components/theme'

import 'styles/App.css'


type AllNPSActions =
  | AllActions
  | {type: 'SAVE_NPS_RESPONSE'}
  | {type: 'LOAD_NPS_PAGE'}
type DispatchAllNPSActions = DispatchAllActions & Dispatch<AllNPSActions>


const oni18nInit = i18nInit()


interface AckFeedbackProps {
  score: number
  style?: React.CSSProperties
}


export const AckFeedback = ({score, style}: AckFeedbackProps): React.ReactElement => {
  const containerStyle: React.CSSProperties = useMemo((): React.CSSProperties => ({
    ...style,
    textAlign: 'center',
  }), [style])
  if (score >= 6) {
    return <Trans style={containerStyle}>
      <p>
        Merci d'avoir pris le temps de nous faire ce retour&nbsp;:
      </p>
      <p>
        c'est très précieux pour nous&nbsp;!
      </p>
    </Trans>
  }
  return <Trans style={containerStyle}>
    <p>
      Merci d'avoir pris le temps de nous faire ce retour&nbsp;!
    </p>
    <p>
      C'est important pour {{productName: config.productName}}.
      Nous tâcherons de faire mieux dans le futur&nbsp;!
    </p>
  </Trans>
}



const NPSShareModalBase = ({isShown}: {isShown: boolean}): React.ReactElement => {
  const {t} = useTranslation()
  return <ShareModal
    isShown={isShown} campaign="nps" visualElement="nps"
    title={t('Merci pour votre retour\u00A0!')}
    intro={<Trans parent={null}>
      Si vous pensez que {{productName: config.productName}} peut aider une personne que vous
      connaissez, n'hésitez pas à lui <strong>partager ce lien</strong>&nbsp;:
    </Trans>}
  >
    {config.isEmploiStoreEnabled ? <React.Fragment>
      <Trans style={{marginBottom: isMobileVersion ? 25 : 40}}>
        Vous pouvez également partager votre avis sur {{productName: config.productName}} en nous
        laissant une note sur l'Emploi Store&nbsp;:
      </Trans>

      <div style={{textAlign: 'center'}}>
        <ExternalLink
          href="http://www.emploi-store.fr/portail/services/bobEmploi"
          style={{textDecoration: 'none'}}>
          <Button type="validation" style={{display: 'flex', margin: 'auto'}}>
            {t("Accéder à l'Emploi Store")}
            <ExitToAppIcon style={{fill: '#fff', height: 19, marginLeft: 10}} />
          </Button>
        </ExternalLink>
      </div>
    </React.Fragment> : null}
  </ShareModal>
}
const NPSShareModal = React.memo(NPSShareModalBase)


const queryParams = parseQueryString(window.location.search) || {}
const initScore = Number.parseInt(queryParams.score, 10) || 0
const {token: authToken, user: userId} = queryParams


const headerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: colors.BOB_BLUE,
  display: 'flex',
  height: 56,
  justifyContent: 'center',
  width: '100%',
} as const

export const header = <header style={headerStyle}>
  <a href="/">
    <img
      style={{height: 40}}
      src={logoProductImage} alt={config.productName} />
  </a>
</header>


export const pageStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.DARK_TWO,
  display: 'flex',
  flexDirection: 'column',
  fontSize: 15,
  fontWeight: 500,
  justifyContent: 'center',
  lineHeight: 1.5,
  minHeight: '100vh',
}
export const contentStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 500,
  padding: isMobileVersion ? `0 ${MIN_CONTENT_PADDING}px 50px` : '0 0 50px',
}
const textareaStyle: React.CSSProperties = {
  minHeight: 200,
  width: '100%',
}

const thankYouTitleContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: 33,
  fontWeight: 'bold',
  justifyContent: 'center',
  margin: '25px auto',
  textAlign: 'center',
}
const bobInteractionStyle: React.CSSProperties = {
  margin: '20px auto',
  maxWidth: 355,
}

const NPSFeedbackPage: React.FC = (): React.ReactElement => {
  const [isFormSent, setIsFormSent] = useState(false)
  const [isSendingUpdate, setIsSendingUpdate] = useState(false)
  const [isValidated, setIsValidated] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string|undefined>()
  const [comment, setComment] = useState<string|undefined>()
  const [isShareModalShown, showShareModal] = useModal()
  const {t} = useTranslation()
  const dispatch = useDispatch<DispatchAllNPSActions>()
  const [impactMeasurementValues, setImpactMeasurementValues] =
    useState <readonly string[]>([])
  const buttonValidationText = t('Envoyer')

  const impactMeasurementOptions = getTranslatedImpactMeasurement(t).
    map(({actionId, name}) => ({name, value: actionId}))

  useAsynceffect(async () => {
    await oni18nInit
    dispatch(setUserProfile({locale: i18next.language}, false))
    dispatch({type: 'LOAD_NPS_PAGE'})
  }, [dispatch])

  const handleUpdateResponse = useCallback(async (response: Response): Promise<void> => {
    if (hasErrorStatus(response)) {
      setErrorMessage(await cleanHtmlError(response))
      setIsSendingUpdate(false)
      return
    }
    setIsFormSent(true)
    setIsSendingUpdate(false)
    if (!!comment && initScore > 8) {
      showShareModal()
    }
  }, [comment, showShareModal])

  const handleUpdate = useCallback(async (): Promise<void> => {
    if (!comment && !impactMeasurementValues) {
      setIsValidated(true)
      return
    }
    dispatch({type: 'SAVE_NPS_RESPONSE'})
    setErrorMessage(undefined)
    setIsSendingUpdate(true)
    const response = await fetch('/api/nps', {
      body: JSON.stringify({
        comment,
        nextActions: impactMeasurementValues,
        userId,
      }),
      headers: {'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json'},
      method: 'post',
    })
    handleUpdateResponse(response)
  }, [comment, dispatch, handleUpdateResponse, impactMeasurementValues])

  const thankYouTitle = useMemo((): string => {
    if (initScore >= 8) {
      return t('Merci infiniment pour votre réponse\u00A0!')
    }
    return t('Merci pour votre réponse\u00A0!')
  }, [t])

  const commentQuestion = useMemo((): string => {
    if (initScore >= 8) {
      return t('Pouvez-vous en dire plus sur ce qui vous a plu ou aidé\u00A0?')
    }
    if (initScore >= 6) {
      return t('Pouvez-vous en dire plus sur ce qui vous a plu\u00A0? (ou ce que nous ' +
        'pourrions améliorer)',
      )
    }
    return t('Pour nous aider à nous améliorer, pourriez-vous répondre à la question ' +
      'suivante\u00A0?')
  }, [t])

  if (isFormSent && !isShareModalShown) {
    return <AckFeedback style={pageStyle} score={initScore} />
  }

  return <div style={pageStyle}>
    {header}
    <NPSShareModal isShown={isShareModalShown} />
    <div style={contentStyle}>
      <div style={thankYouTitleContainerStyle}>
        <div style={{margin: 'auto'}}>
          <Emoji size={40} aria-hidden={true}>{initScore >= 8 ? '❤' : '👍'}</Emoji>
        </div>
        {thankYouTitle}
      </div>
      {initScore >= 6 ? <React.Fragment>
        <BobInteraction style={bobInteractionStyle}>{commentQuestion}</BobInteraction>
        <FieldSet isValidated={isValidated} isValid={!!comment}>
          <Textarea
            onChange={setComment}
            value={comment} style={textareaStyle} />
        </FieldSet>
      </React.Fragment> : null}
      <BobInteraction style={bobInteractionStyle}>
        {t('Quelle sont la (ou les) action(s) que vous voudriez, ou avez déjà mise(s) en ' +
        'place\u00A0?')}
      </BobInteraction>
      <FieldSet isValidated={isValidated} isValid={!!impactMeasurementValues}>
        <CheckboxList
          options={impactMeasurementOptions}
          values={impactMeasurementValues}
          onChange={setImpactMeasurementValues} />
      </FieldSet>

      <div style={{textAlign: 'center'}}>
        {isMobileVersion ? <FixedButtonNavigation onClick={handleUpdate}>
          {buttonValidationText}</FixedButtonNavigation> : <Button onClick={handleUpdate}
          isProgressShown={isSendingUpdate}>{buttonValidationText}</Button>}
        {errorMessage ? <div style={{marginTop: 20}}>
          {errorMessage}
        </div> : null}
      </div>
    </div>
  </div>
}


const radioGroupStyle: React.CSSProperties = {
  flexDirection: 'column',
}

const localMarketUserEstimateOptions = [
  {name: prepareT('favorable pour moi, il y a peu de concurrence'), value: 'LOCAL_MARKET_GOOD'},
  {name: prepareT('difficile, il y a beaucoup de concurrence'), value: 'LOCAL_MARKET_BAD'},
  {name: prepareT('je ne sais pas trop'), value: 'LOCAL_MARKET_UNKNOWN'},
  {
    name: prepareT("c'est difficile à dire à cause du coronavirus"),
    value: 'LOCAL_MARKET_UNKNOWN_COVID',
  },
] as const
const bobRelativePersonalizationOptions = [
  {name: prepareT('{{productName}} est plus personnalisé'), value: 12},
  {name: prepareT('{{productName}} est aussi personnalisé'), value: 10},
  {name: prepareT('{{productName}} est moins personnalisé'), value: 8},
  {name: prepareT("Je n'ai pas reçu d'autre accompagnement"), value: 0},
] as const
const informedOptions = [
  {name: prepareT('comme avant'), value: 1},
  {name: prepareT('mieux informé·e'), value: 2},
  {name: prepareT('bien mieux informé·e'), value: 3},
] as const
// TODO(pascal): Fix this to include a text version.
const usabilityOptions = [
  {name: '😤', value: 1},
  {name: '😕', value: 2},
  {name: '😶', value: 3},
  {name: '🙂', value: 4},
  {name: '😁', value: 5},
] as const


function useSavedState<
  K extends keyof bayes.bob.NPSSurveyResponse,
  T = bayes.bob.NPSSurveyResponse[K],
>(
  save: (response: bayes.bob.NPSSurveyResponse) => Promise<void>,
  field: K,
) {
  const [state, setState] = useState<T|undefined>(undefined)
  const handleSave = useCallback((value: T) => {
    save({[field]: value})
    setState(value)
  }, [field, save])
  return [state, handleSave]
}


const NPSFullFeedbackPage = (): React.ReactElement => {
  const dispatch = useDispatch<DispatchAllNPSActions>()
  const {t} = useTranslation()
  const [errorMessage, setErrorMessage] = useState<string|undefined>()
  const clearErrorMessage = useCallback((): void => setErrorMessage(undefined), [])
  const makeCancelable = useCancelablePromises()
  const impactMeasurementOptions = getTranslatedImpactMeasurement(t).
    map(({actionId, name}) => ({name, value: actionId}))
  const buttonValidationText = t('Envoyer')

  const [user, setUser] = useState<bayes.bob.User|undefined>()
  useAsynceffect(async (checkIfCanceled: () => boolean) => {
    dispatch({type: 'LOAD_NPS_PAGE'})
    const response = await fetch(`/api/nps/user/${userId}`, {
      headers: {'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json'},
    })
    if (hasErrorStatus(response)) {
      const errorMessage = await cleanHtmlError(response)
      if (!checkIfCanceled()) {
        setErrorMessage(errorMessage)
      }
      return
    }
    const user = await response.json()
    if (user && !checkIfCanceled()) {
      setUser(user)
    }
  }, [dispatch])

  const saveResponse = useCallback(async (answers: bayes.bob.NPSSurveyResponse) => {
    dispatch({type: 'SAVE_NPS_RESPONSE'})
    const response = await makeCancelable(fetch('/api/nps', {
      body: JSON.stringify({
        answers,
        userId,
      }),
      headers: {'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json'},
      method: 'post',
    }))
    if (hasErrorStatus(response)) {
      setErrorMessage(await cleanHtmlError(response))
    }
  }, [dispatch, makeCancelable])

  const [isFormSent, setIsFormSent] = useState(false)
  const [isValidated, setIsValidated] = useState(false)

  const [localMarketUserEstimate, estimateLocalMarket] =
    useSavedState(saveResponse, 'localMarketEstimate')
  const [bobRelativePersonalization, setBobRelativePersonalization] =
    useSavedState(saveResponse, 'bobRelativePersonalization')
  const [userInformedAboutCareerOptions, setUserInformedAboutCareerOptions] =
    useSavedState(saveResponse, 'userInformedAboutCareerOptions')
  const [productUsabilityScore, setProductUsabilityScore] =
    useSavedState(saveResponse, 'productUsabilityScore')
  const [impactMeasurementValues, setImpactMeasurementValues] =
    useSavedState(saveResponse, 'nextActions')
  const isValid = !!impactMeasurementValues && !!localMarketUserEstimate &&
    !!bobRelativePersonalization && !!userInformedAboutCareerOptions && !!productUsabilityScore

  const handleSend = useCallback((): void => {
    if (isValid) {
      setIsFormSent(true)
    } else {
      setIsValidated(true)
    }
  }, [isValid])

  useAsynceffect(async () => {
    await oni18nInit
    dispatch(setUserProfile({locale: i18next.language}, false))
  }, [dispatch])

  const localizedLocalMarketUserEstimateOptions = useMemo(
    (): readonly {name: string; value: bayes.bob.LocalMarketUserEstimate}[] =>
      localizeOptions(t, localMarketUserEstimateOptions),
    [t],
  )
  const localizedRelativePersonalizationOptions = useMemo(
    (): readonly {name: string; value: number}[] =>
      localizeOptions(t, bobRelativePersonalizationOptions, {productName: config.productName}),
    [t],
  )
  const localizedInformedOptions = useMemo(
    (): readonly {name: string; value: number}[] =>
      localizeOptions(t, informedOptions, {context: user?.profile?.gender}),
    [t, user],
  )

  if (isFormSent) {
    return <AckFeedback style={pageStyle} score={initScore} />
  }

  const city = user?.projects?.[0]?.city
  const targetJob = user?.projects?.[0]?.targetJob
  const targetJobName = targetJob &&
    lowerFirstLetter(genderizeJob(targetJob, user?.profile?.gender))

  return <div style={pageStyle}>
    {header}
    <div style={contentStyle}>
      <div style={{fontSize: 16, margin: '40px 0 10px'}}>
        <div style={thankYouTitleContainerStyle}>
          <div style={{margin: 'auto'}}><Emoji size={40} aria-hidden={true}>👍</Emoji></div>
          {t('Merci\u00A0!')}
        </div>
        <div>
          {t('Pour nous aider à améliorer {{productName}}, pourriez-vous répondre à ' +
            'quelques questions\u00A0?', {productName: config.productName},
          )}
        </div>
      </div>
      <BobInteraction style={bobInteractionStyle}>
        {t('Quelle sont la (ou les) action(s) que vous voudriez, ou avez déjà mise(s) en ' +
          'place\u00A0?')}
      </BobInteraction>
      <FieldSet isValidated={isValidated} isValid={!!impactMeasurementValues}>
        <CheckboxList
          options={impactMeasurementOptions}
          values={impactMeasurementValues}
          onChange={setImpactMeasurementValues} />
      </FieldSet>
      <BobInteraction style={bobInteractionStyle}>
        {t(
          "Après avoir utilisé {{productName}}, est-ce que vous pensez que le marché de l'emploi " +
          'pour le métier {{ofJobName}} {{inCity}} est\u00A0?',
          {
            inCity: city ? inDepartement(city, t) : t('dans votre ville'),
            ofJobName: targetJobName ? ofJobName(targetJobName, t) : t('que vous cherchez'),
            productName: config.productName,
          },
        )}
      </BobInteraction>
      <FieldSet isValidated={isValidated} isValid={!!localMarketUserEstimate}>
        <RadioGroup<bayes.bob.LocalMarketUserEstimate>
          options={localizedLocalMarketUserEstimateOptions}
          onChange={estimateLocalMarket}
          value={localMarketUserEstimate}
          style={radioGroupStyle} />
      </FieldSet>
      <BobInteraction style={bobInteractionStyle}>
        {t(
          "En comparant avec d'autres accompagnements dont vous avez bénéficié vous trouvez " +
          'que\u00A0:',
        )}
      </BobInteraction>
      <FieldSet>
        <RadioGroup<number>
          options={localizedRelativePersonalizationOptions}
          onChange={setBobRelativePersonalization}
          value={bobRelativePersonalization}
          style={radioGroupStyle} />
      </FieldSet>
      <BobInteraction style={bobInteractionStyle}>
        {t(
          'En pensant à mes différentes options de carrières, après avoir utilisé ' +
          '{{productName}}, je me sens\u00A0:',
          {productName: config.productName},
        )}
      </BobInteraction>
      <FieldSet isValidated={isValidated} isValid={!!userInformedAboutCareerOptions}>
        <RadioGroup<number>
          options={localizedInformedOptions}
          onChange={setUserInformedAboutCareerOptions}
          value={userInformedAboutCareerOptions}
          style={radioGroupStyle} />
      </FieldSet>
      <BobInteraction style={bobInteractionStyle}>
        {t(
          'Est-ce que vous avez trouvé {{productName}} facile à utiliser\u00A0?',
          {productName: config.productName},
        )}
      </BobInteraction>
      <FieldSet isValidated={isValidated} isValid={!!productUsabilityScore}>
        <RadioGroup<number>
          options={usabilityOptions}
          onChange={setProductUsabilityScore}
          value={productUsabilityScore}
          childStyle={{marginRight: '1em'}} />
      </FieldSet>
      <div style={{textAlign: 'center'}}>
        {isMobileVersion ? <FixedButtonNavigation onClick={handleSend}>
          {buttonValidationText}</FixedButtonNavigation> : <Button onClick={handleSend}>
          {buttonValidationText}</Button>}
      </div>
    </div>
    <Snackbar snack={errorMessage} onHide={clearErrorMessage} timeoutMillisecs={4000} />
  </div>
}


const NPSFinalPage = React.memo(config.npsSurvey === 'full' ? NPSFullFeedbackPage : NPSFeedbackPage)


const initialUser = {
  profile: {locale: i18next.language},
}


function user(state: bayes.bob.User = initialUser, action: AllActions): bayes.bob.User {
  if (action.type === 'SET_USER_PROFILE') {
    return {
      ...state,
      profile: {
        ...state.profile,
        ...action.userProfile,
      },
    }
  }
  return state
}

const amplitudeMiddleware = createAmplitudeMiddleware(new Logger({
  LOAD_NPS_PAGE: 'Load NPS Page',
  SAVE_NPS_RESPONSE: 'Save NPS details response',
}))


const finalCreateStore = composeWithDevTools(applyMiddleware(
  amplitudeMiddleware,
  thunk,
), createSentryEnhancer())(createStore)

// Create the store that will be provided to connected components via Context.
const store = finalCreateStore(combineReducers({app, user}))


ReactDOM.render(<Suspense fallback={<WaitingPage />}>
  <Provider store={store}>
    <NPSFinalPage />
  </Provider>
</Suspense>, document.getElementById('app'))
