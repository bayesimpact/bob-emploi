import i18next from 'i18next'
import {parse} from 'query-string'
import React, {Suspense, useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import ReactDOM from 'react-dom'

import {init as i18nInit, localizeOptions, prepareT} from 'store/i18n'

import logoProductImage from 'images/bob-logo.svg'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {ShareModal} from 'components/share'
import {Button, MIN_CONTENT_PADDING, RadioGroup} from 'components/theme'
import {WaitingPage} from 'components/pages/waiting'
import {CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

require('styles/App.css')

// TODO(cyrille): Report events to Amplitude.


// i18next-extract-mark-ns-start statusUpdate

i18nInit()


const commonSituationOptions = [
  {name: prepareT('Je suis en formation'), value: 'FORMATION'},
  {name: prepareT('Je suis en stage'), value: 'INTERNSHIP'},
  {name: prepareT('Je suis en alternance'), value: 'ALTERNANCE'},
  {name: prepareT('Je travaille en freelance'), value: 'FREELANCE'},
  {name: prepareT("J'ai monté ou repris une entreprise"), value: 'CREATE_OR_TAKE_OVER_COMPANY'},
] as const

const optionalBoolOptions = [
  {name: prepareT('oui'), value: 'TRUE'},
  {name: prepareT('non'), value: 'FALSE'},
] as const

const FORM_OPTIONS = {
  'en-recherche': {
    headerText: prepareT(
      "Merci de nous avoir donné des nouvelles, vous nous rendez un fier service\u00A0! J'ai " +
      'juste quelques questions de plus.',
    ),
    seeking: 'STILL_SEEKING',
    seekingOptions: [],
    situationOptions: [
      {name: prepareT("J'ai un travail mais je cherche encore"), value: 'WORKING'},
      ...commonSituationOptions,
      {name: prepareT('Je cherche toujours un emploi'), value: 'SEEKING'},
    ],
  },
  'mise-a-jour': {
    headerText: prepareT(
      "Merci de nous avoir donné des nouvelles, vous nous rendez un fier service\u00A0! J'ai " +
      'juste quelques questions de plus.',
    ),
    seeking: undefined,
    seekingOptions: [
      {name: prepareT("Je suis toujours à la recherche d'un emploi"), value: 'STILL_SEEKING'},
      {name: prepareT('Je ne cherche plus'), value: 'STOP_SEEKING'},
    ],
    situationOptions: [
      {name: prepareT("J'ai un travail"), value: 'WORKING'},
      ...commonSituationOptions,
      {name: prepareT("Je suis à la recherche d'un emploi"), value: 'SEEKING'},
      {name: prepareT("C'est compliqué"), value: 'COMPLICATED'},
    ],
  },
  'ne-recherche-plus': {
    headerText: prepareT(
      "Merci de nous avoir donné des nouvelles, vous nous rendez un fier service\u00A0! J'ai " +
      'juste quelques questions de plus qui nous servent à collecter des statistiques pour ' +
      'améliorer notre impact\u00A0:',
    ),
    seeking: 'STOP_SEEKING',
    seekingOptions: [],
    situationOptions: [
      {name: prepareT("J'ai un travail"), value: 'WORKING'},
      ...commonSituationOptions,
      {name: prepareT("C'est compliqué"), value: 'COMPLICATED'},
    ],
  },
} as const

type PageType = keyof typeof FORM_OPTIONS


type Option<T> = {
  name: string
  value: T
}


const NEW_JOB_CONTRACT_TYPE_OPTIONS: readonly Option<bayes.bob.EmploymentType>[] = [
  {name: prepareT('Un contrat de moins de 30 jours'), value: 'ANY_CONTRACT_LESS_THAN_A_MONTH'},
  {name: prepareT('Un CDD de 1 à 3 mois'), value: 'CDD_LESS_EQUAL_3_MONTHS'},
  {name: prepareT('Un CDD de plus de 3 mois'), value: 'CDD_OVER_3_MONTHS'},
  {name: prepareT('Un CDI'), value: 'CDI'},
] as const


const bobHasHelpedOptions = [
  {name: prepareT('Oui, vraiment décisif'), value: 'YES_A_LOT'},
  {name: prepareT("Oui, ça m'a aidé·e", {context: ''}), value: 'YES'},
  {name: prepareT('Non, pas du tout'), value: 'NOT_AT_ALL'},
] as const


const bobFeaturesThatHelpedOptions = [
  {name: prepareT("Le diagnostic m'a été utile"), value: 'DIAGNOSTIC'},
  {name: prepareT('Utiliser plus le bouche à oreille'), value: 'NETWORK'},
  {name: prepareT('Utiliser plus les candidatures spontanées'), value: 'SPONTANEOUS'},
  {name: prepareT('Des astuces pour mon CV et lettre de motivation'), value: 'RESUME_TIPS'},
  {name: prepareT('Des astuces pour les entretiens'), value: 'INTERVIEW_TIPS'},
  {
    name: prepareT(
      "{{productName}} m'a poussé·e à changer de stratégie",
      {context: '', productName: config.productName},
    ),
    value: 'STRATEGY_CHANGE',
  },
] as const


interface Params {
  page?: PageType
  params: {
    can_tutoie?: string
    gender?: bayes.bob.Gender
    hl?: string
    token?: string
    user?: string
  }
  seeking?: bayes.bob.SeekingStatus
}


type Location = typeof window.location
function getParamsFromLocation({pathname, search}: Location): Params {
  const page = pathname.replace('/statut/', '') as PageType
  const {seeking = undefined} = FORM_OPTIONS[page] || {}
  return {
    page: FORM_OPTIONS[page] ? page : undefined,
    params: parse(search),
    ...seeking && {seeking},
  }
}

function redirectToLandingPage(): void {
  window.location.href = '/'
}

const {page, params, seeking: initialSeeking} = getParamsFromLocation(window.location)
// TODO(pascal): Drop that after 2020-02-15
if (params.can_tutoie && !params.hl) {
  i18next.changeLanguage('fr@tu')
}


const headerStyle = {
  alignItems: 'center',
  backgroundColor: colors.BOB_BLUE,
  display: 'flex',
  height: 56,
  justifyContent: 'center',
  width: '100%',
}
const containerStyle: React.CSSProperties = {
  padding: isMobileVersion ? `0 ${MIN_CONTENT_PADDING}px` : 'initial',
}
const pageStyle: React.CSSProperties = {
  alignItems: 'center',
  color: colors.DARK_TWO,
  display: 'flex',
  flexDirection: 'column',
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.5,
  minHeight: '100vh',
  paddingBottom: 40,
}
const optionalChildStyle: React.CSSProperties = {
  marginRight: 20,
}


const StatusUpdatePageBase: React.FC = (): React.ReactElement => {
  const [bobFeaturesThatHelped, setBobFeaturesThatHelped] =
    useState<readonly bayes.bob.UsefulFeature[]>([])
  const [bobHasHelped, setBobHasHelped] = useState('')
  const [isNewJob, setIsNewJob] = useState<bayes.bob.OptionalBool|undefined>(undefined)
  const [isJobInDifferentSector, setIsJobInDifferentSector] =
    useState<bayes.bob.OptionalBool|undefined>(undefined)
  const [newJobContractType, setNewJobContractType] =
    useState<bayes.bob.EmploymentType|undefined>(undefined)
  const [seeking, setSeeking] = useState(initialSeeking)
  const [situation, setSituation] = useState('')
  const [isFormSent, setIsFormSent] = useState(false)
  const [isValidated, setIsValidated] = useState(false)
  const [isSendingUpdate, setIsSendingUpdate] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string|undefined>(undefined)
  const {t, t: translate} = useTranslation('statusUpdate')

  const handleUpdateResponse = useCallback((response: Response): void => {
    setIsSendingUpdate(false)
    if (response.status >= 400 || response.status < 200) {
      response.text().then((errorMessage: string): void => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P') as HTMLCollectionOf<HTMLElement>
        setErrorMessage(content.length && content[0].textContent || page.textContent || undefined)
      })
      return
    }
    setIsFormSent(true)
    setIsSendingUpdate(false)
  }, [])

  const handleUpdate = useCallback((): void => {
    if (!bobHasHelped || !situation) {
      setIsValidated(true)
      return
    }
    const {token = '', user = ''} = params || {}
    setErrorMessage(undefined)
    setIsSendingUpdate(true)
    const newStatus: bayes.bob.EmploymentStatus = {
      bobFeaturesThatHelped,
      bobHasHelped,
      isJobInDifferentSector,
      isNewJob,
      newJobContractType,
      seeking,
      situation,
    }
    fetch(`/api/employment-status/${user}`, {
      body: JSON.stringify(newStatus),

      headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    }).then(handleUpdateResponse)
  }, [bobFeaturesThatHelped, bobHasHelped, handleUpdateResponse, newJobContractType, seeking,
    situation, isNewJob, isJobInDifferentSector])
  const {headerText, seekingOptions, situationOptions} = FORM_OPTIONS[page || 'mise-a-jour']
  const {gender} = params
  const localizedSeekingOptions = useMemo(
    (): readonly Option<bayes.bob.SeekingStatus>[] =>
      localizeOptions<Option<bayes.bob.SeekingStatus>>(t, seekingOptions),
    [seekingOptions, t],
  )
  const localizedSituationOptions = useMemo(
    (): readonly Option<string>[] => localizeOptions<Option<string>>(t, situationOptions),
    [situationOptions, t],
  )
  const localizedContractTypeOptions = useMemo(
    (): readonly Option<bayes.bob.EmploymentType>[] =>
      localizeOptions(t, NEW_JOB_CONTRACT_TYPE_OPTIONS),
    [t],
  )
  const localizedBobHasHelpedOptions = useMemo(
    (): readonly Option<string>[] => localizeOptions(t, bobHasHelpedOptions, {context: gender}),
    [gender, t],
  )
  const localizedFeatureThatHelpedOptions = useMemo(
    (): readonly Option<bayes.bob.UsefulFeature>[] =>
      localizeOptions(t, bobFeaturesThatHelpedOptions, {
        context: gender, productName: config.productName,
      }),
    [gender, t],
  )
  const localizedOptionalBoolOptions = useMemo(
    (): readonly Option<bayes.bob.OptionalBool>[] =>
      localizeOptions(t, optionalBoolOptions),
    [t],
  )

  if (!page) {
    return <Trans style={pageStyle} t={t}>Page introuvable</Trans>
  }
  const isEmployedAndStoppedSeeking = seeking === 'STOP_SEEKING' && situation === 'WORKING'
  const isHowProductHelpedQuestionShown = bobHasHelped && /YES/.test(bobHasHelped)
  if (isFormSent) {
    return <div style={{...containerStyle, ...pageStyle}}>
      {t('Merci pour ces informations\u00A0!')}
      <ShareModal isShown={!!(bobHasHelped && /YES/.test(bobHasHelped))}
        campaign="rer" visualElement="status-update"
        title={t('Merci beaucoup\u00A0!')} intro={<React.Fragment>
          {newJobContractType || situation === 'FORMATION' ? <span>
            {newJobContractType ?
              <Trans style={{marginBottom: 20}} t={t}>
                Et félicitations pour votre nouvel emploi&nbsp;!<br />
                Nous sommes ravis d'avoir pu vous aider.
              </Trans> :
              <Trans style={{marginBottom: 20}} t={t}>
                Et félicitations pour votre nouvelle formation&nbsp;!<br />
                Nous sommes ravis d'avoir pu vous aider.
              </Trans>
            }
          </span> : null}
          <Trans parent={null} t={t}>
            Si vous pensez que {{productName: config.productName}} peut aider une
            personne que vous connaissez, n'hésitez pas à lui <strong>
              partager ce lien
            </strong>&nbsp;:
          </Trans>
        </React.Fragment>} />
    </div>
  }
  return <div style={pageStyle}>
    <header style={headerStyle}>
      <img
        style={{cursor: 'pointer', height: 30}} onClick={redirectToLandingPage}
        src={logoProductImage} alt={config.productName} />
    </header>
    <div style={containerStyle}>
      <div style={{fontSize: 16, margin: '40px 0 20px', maxWidth: 500}}>
        {translate(headerText)}
      </div>
      <div style={{maxWidth: 500}}>
        {seekingOptions.length ?
          <FieldSet
            label={t("Êtes-vous toujours à la recherche d'un emploi\u00A0?")}
            isValidated={isValidated} isValid={!!seeking}>
            <RadioGroup<bayes.bob.SeekingStatus>
              onChange={setSeeking}
              style={{flexDirection: 'column'}}
              options={localizedSeekingOptions}
              value={seeking} />
          </FieldSet> : null}
        <FieldSet
          label={t("Quelle est votre situation aujourd'hui\u00A0?")}
          isValidated={isValidated} isValid={!!situation}>
          <RadioGroup<string>
            onChange={setSituation}
            style={{flexDirection: 'column'}}
            options={localizedSituationOptions}
            value={situation} />
        </FieldSet>
        {isEmployedAndStoppedSeeking ? <FieldSet
          label={t('Est-ce un nouvel emploi\u00A0?')}
          isValidated={isValidated} isValid={!!isNewJob}>
          <RadioGroup<bayes.bob.OptionalBool>
            onChange={setIsNewJob}
            options={localizedOptionalBoolOptions}
            value={isNewJob}
            childStyle={optionalChildStyle} />
        </FieldSet> : null}
        {isEmployedAndStoppedSeeking && isNewJob === 'TRUE' ? <FieldSet
          label={t('Quel type de contrat avez-vous décroché\u00A0?')}
          isValidated={isValidated} isValid={!!newJobContractType}>
          <RadioGroup<bayes.bob.EmploymentType>
            onChange={setNewJobContractType}
            style={{flexDirection: 'column'}}
            options={localizedContractTypeOptions}
            value={newJobContractType} />
        </FieldSet> : null}
        {isEmployedAndStoppedSeeking && isNewJob === 'TRUE' ? <FieldSet
          label={t('Votre nouvel emploi est-il dans un secteur différent du précédent\u00A0?')}
          isValidated={isValidated} isValid={!!isJobInDifferentSector}>
          <RadioGroup<bayes.bob.OptionalBool>
            onChange={setIsJobInDifferentSector}
            options={localizedOptionalBoolOptions}
            value={isJobInDifferentSector}
            childStyle={optionalChildStyle} />
        </FieldSet> : null}
        <FieldSet
          label={t(
            '{{productName}} vous a-t-il apporté un plus dans votre recherche\u00A0?',
            {productName: config.productName},
          )}
          isValidated={isValidated} isValid={!!bobHasHelped}>
          <RadioGroup<string>
            onChange={setBobHasHelped}
            style={{flexDirection: 'column'}}
            options={localizedBobHasHelpedOptions}
            value={bobHasHelped} />
        </FieldSet>
        {isHowProductHelpedQuestionShown ? <FieldSet
          label={t(
            'Comment {{productName}} vous a-t-il aidé·e\u00A0?',
            {context: gender, productName: config.productName},
          )}>
          <CheckboxList<bayes.bob.UsefulFeature>
            options={localizedFeatureThatHelpedOptions}
            values={bobFeaturesThatHelped}
            onChange={setBobFeaturesThatHelped}
          />
          {/* TODO(pascal): Add a freeform text for "other feature that helped." */}
        </FieldSet> : null}
      </div>
      <div style={{textAlign: 'center'}}>
        <Button
          onClick={handleUpdate}
          isProgressShown={isSendingUpdate}>
          {t('Envoyer')}
        </Button>
        {errorMessage ? <div style={{marginTop: 20}}>
          {errorMessage}
        </div> : null}
      </div>
      <div style={{flex: 1}} />
    </div>
  </div>
}
const StatusUpdatePage = React.memo(StatusUpdatePageBase)


ReactDOM.render(<Suspense fallback={<WaitingPage />}>
  <StatusUpdatePage />
</Suspense>, document.getElementById('app'))
