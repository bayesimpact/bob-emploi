import {parse} from 'query-string'
import React, {Suspense, useCallback, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import ReactDOM from 'react-dom'

import {cleanHtmlError, hasErrorStatus} from 'store/http'
import type {LocalizableString} from 'store/i18n'
import {init as i18nInit, localizeOptions, prepareT,
  prepareT as prepareTNoExtract} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import logoProductImage from 'deployment/bob-logo.svg?fill=%23fff'

import Button from 'components/button'
import {OneField} from 'components/field_set'
import Trans from 'components/i18n_trans'
import type {Inputable} from 'components/input'
import Input from 'components/input'
import LikertGrid from 'components/likert_grid'
import RadioButton from 'components/radio_button'
import RadioGroup from 'components/radio_group'
import {ShareModal} from 'components/share'
import Textarea from 'components/textarea'
import {MIN_CONTENT_PADDING} from 'components/theme'
import {Routes} from 'components/url'
import WaitingPage from 'components/pages/waiting'

import 'styles/App.css'

// TODO(cyrille): Report events to Amplitude.


// i18next-extract-mark-ns-start statusUpdate

i18nInit()


// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
interface LocalizableOption<T extends unknown> {
  name: LocalizableString
  value: T
}


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

const FORM_OPTIONS: {[page: string]: {
  headerText: LocalizableString
  seeking?: bayes.bob.SeekingStatus
  seekingOptions: readonly LocalizableOption<bayes.bob.SeekingStatus>[]
  situationOptions: readonly LocalizableOption<string>[]
}} = {
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


const NEW_JOB_CONTRACT_TYPE_OPTIONS = [
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


const opinionAnswers = [
  {name: prepareT("Pas du tout d'accord"), value: 1},
  {name: prepareTNoExtract(''), value: 2},
  {name: prepareT('Neutre'), value: 3},
  {name: prepareTNoExtract(''), value: 4},
  {name: prepareT("Tout à fait d'accord"), value: 5},
] as const

const opinionQuestions = [
  {
    id: 'personalizedAdviceScore',
    name: prepareT(
      "{{productName}} m'a donné des conseils personnalisés sur la façon d'améliorer ma " +
        "recherche d'emploi.",
      {productName: config.productName},
    ),
  },
  {
    id: 'newIdeasScore',
    name: prepareT(
      "{{productName}} m'a donné de nouvelles idées sur ce que je dois faire dans ma " +
        "recherche d'emploi.",
      {productName: config.productName},
    ),
  },
  {
    id: 'usefulResourceScore',
    name: prepareT(
      "{{productName}} m'a fourni des ressources et des informations utiles.",
      {productName: config.productName},
    ),
  },
  {
    id: 'helpsPlanScore',
    // i18next-extract-mark-context-next-line ["", "FEMININE", "MASCULINE"]
    name: prepareT(
      "{{productName}} m'a aidé·e à planifier ma recherche d'emploi.",
      {productName: config.productName},
    ),
  },
  {
    id: 'motivationScore',
    // i18next-extract-mark-context-next-line ["", "FEMININE", "MASCULINE"]
    name: prepareT(
      "{{productName}} m'a aidé·e à garder ma motivation et à me sentir soutenu·e",
      {productName: config.productName},
    ),
  },
  {
    id: 'improveSelfConfidenceScore',
    // i18next-extract-mark-context-next-line ["", "FEMININE", "MASCULINE"]
    name: prepareT(
      "{{productName}} m'a aidé·e à avoir plus confiance en moi",
      {productName: config.productName},
    ),
  },
  {
    id: 'newFromCoachingEmailsScore',
    name: prepareT(
      "Les emails de coaching que j'ai reçus m'ont donné de nouvelles idées à essayer dans ma " +
      "recherche d'emploi."),
  },
] as const



interface Params {
  page?: PageType
  params: {
    can_tutoie?: string
    employed?: 'True'|'False'
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

const {page, params, seeking: initialSeeking} = getParamsFromLocation(window.location)


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
const paragraphStyle: React.CSSProperties = {
  marginBottom: 20,
}
const textareaStyle: React.CSSProperties = {
  minHeight: 200,
  width: '100%',
}

type ES = bayes.bob.EmploymentStatus
type ScoreField = {[F in keyof ES]: ES[F] extends number|undefined ? F : never}[keyof ES] & string


const StatusUpdatePageBase: React.FC = (): React.ReactElement => {
  const [bobHasHelped, setBobHasHelped] = useState('')
  const [isNewJob, setIsNewJob] = useState<bayes.OptionalBool|undefined>(undefined)
  const [isJobInDifferentSector, setIsJobInDifferentSector] =
    useState<bayes.OptionalBool|undefined>(undefined)
  const [newJobContractType, setNewJobContractType] =
    useState<bayes.bob.EmploymentType|undefined>(undefined)
  const [hasSalaryIncreased, setHasSalaryIncreased] =
    useState<bayes.OptionalBool|undefined>(undefined)
  const [hasGreaterRole, setHasGreaterRole] =
    useState<bayes.OptionalBool|undefined>(undefined)
  const [hasBeenPromoted, setHasBeenPromoted] =
    useState<bayes.OptionalBool|undefined>(undefined)
  const [opinions, setOpinions] = useState<bayes.bob.EmploymentStatus>({})
  const [seeking, setSeeking] = useState(initialSeeking)
  const [situation, setSituation] = useState('')
  const [isFormSent, setIsFormSent] = useState(false)
  const [isValidated, setIsValidated] = useState(false)
  const [isSendingUpdate, setIsSendingUpdate] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string|undefined>(undefined)
  const {t, t: translate} = useTranslation('statusUpdate')
  const updateOpinionScore = useCallback(
    (field: ScoreField, newValue: number) =>
      setOpinions(status => ({...status, [field]: newValue})),
    [setOpinions],
  )
  const [feedback, setFeedback] = useState('')

  const handleUpdateResponse = useCallback(async (response: Response): Promise<void> => {
    setIsSendingUpdate(false)
    if (hasErrorStatus(response)) {
      setErrorMessage(await cleanHtmlError(response))
      return
    }
    setIsFormSent(true)
    setIsSendingUpdate(false)
  }, [])

  const handleUpdate = useCallback(async (): Promise<void> => {
    if (!bobHasHelped || !situation) {
      setIsValidated(true)
      return
    }
    const {token = '', user = ''} = params || {}
    setErrorMessage(undefined)
    setIsSendingUpdate(true)
    const newStatus: bayes.bob.EmploymentStatus = {
      ...opinions,
      bobHasHelped,
      feedback,
      hasBeenPromoted,
      hasGreaterRole,
      hasSalaryIncreased,
      isJobInDifferentSector,
      isNewJob,
      newJobContractType,
      seeking,
      situation,
    }
    const updateResponse = await fetch(`/api/employment-status/${user}`, {
      body: JSON.stringify(newStatus),

      headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    })
    handleUpdateResponse(updateResponse)
  }, [bobHasHelped, feedback, handleUpdateResponse, hasBeenPromoted, hasGreaterRole,
    hasSalaryIncreased, newJobContractType, seeking, situation, isNewJob, isJobInDifferentSector,
    opinions])
  const {headerText, seekingOptions, situationOptions} = FORM_OPTIONS[page || 'mise-a-jour']
  const {gender, employed: wasAlreadyEmployed} = params
  const localizedSeekingOptions = useMemo(
    (): readonly Option<bayes.bob.SeekingStatus>[] =>
      localizeOptions(t, seekingOptions),
    [seekingOptions, t],
  )
  const localizedSituationOptions = useMemo(
    (): readonly Option<string>[] => localizeOptions(t, situationOptions),
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
  const localizedOptionalBoolOptions = useMemo(
    (): readonly Option<bayes.OptionalBool>[] =>
      localizeOptions(t, optionalBoolOptions),
    [t],
  )
  const translatedOpinionAnswers = useMemo(() => localizeOptions(t, opinionAnswers), [t])
  const translatedOpinionQuestions = useMemo(
    () => localizeOptions(t, opinionQuestions, {context: gender}),
    [gender, t],
  )
  const hasCustomSituation = !!situation &&
    !localizedSituationOptions.some(({value}) => value === situation)
  const [isSituationInputFocused, setIsSituationInputFocused] = useState(false)
  const handleSituationInputFocus = useCallback(() => setIsSituationInputFocused(true), [])
  const handleSituationInputBlur = useCallback(() => setIsSituationInputFocused(false), [])
  const situationInputRef = useRef<Inputable>(null)
  const handleCustomSituationClick = useCallback(() => {
    situationInputRef.current?.focus()
  }, [])

  if (!page) {
    return <Trans style={pageStyle} t={t}>Page introuvable</Trans>
  }
  const isEmployedAndStoppedSeeking = seeking === 'STOP_SEEKING' && situation === 'WORKING'
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
      <a href={Routes.ROOT}>
        <img
          style={{height: 40}}
          src={logoProductImage} alt={config.productName} />
      </a>
    </header>
    <div style={containerStyle}>
      <div style={{fontSize: 16, margin: '40px 0 20px', maxWidth: 640}}>
        {translate(...headerText)}
      </div>
      <div style={{maxWidth: 640}}>
        {seekingOptions.length ?
          <OneField
            label={t("Êtes-vous toujours à la recherche d'un emploi\u00A0?")}
            isValidated={isValidated} isValid={!!seeking}>
            <RadioGroup<bayes.bob.SeekingStatus>
              onChange={setSeeking}
              style={{flexDirection: 'column'}}
              options={localizedSeekingOptions}
              value={seeking} />
          </OneField> : null}
        <OneField
          label={t("Quelle est votre situation aujourd'hui\u00A0?")}
          isValidated={isValidated} isValid={!!situation}>
          <RadioGroup<string>
            onChange={setSituation}
            style={{flexDirection: 'column'}}
            options={localizedSituationOptions}
            value={situation}>
            <span style={{alignItems: 'center', display: 'flex'}}>
              <RadioButton
                isSelected={hasCustomSituation || isSituationInputFocused}
                onClick={handleCustomSituationClick} />
              <Input
                value={hasCustomSituation ? situation : ''} onChange={setSituation}
                placeholder={t('décrire moi-même')} name="situation"
                onFocus={handleSituationInputFocus} onBlur={handleSituationInputBlur}
                ref={situationInputRef} style={{marginLeft: 10, maxWidth: 400}} />
            </span>
          </RadioGroup>
        </OneField>
        {isEmployedAndStoppedSeeking ? <React.Fragment>
          <OneField
            label={t('Est-ce un nouvel emploi\u00A0?')}
            isValidated={isValidated} isValid={!!isNewJob}>
            <RadioGroup<bayes.OptionalBool>
              onChange={setIsNewJob}
              options={localizedOptionalBoolOptions}
              value={isNewJob}
              childStyle={optionalChildStyle} />
          </OneField>
          <OneField
            // TODO(cyrille): Consider limiting to people who ever had a job
            // (kind !== FIND_A_FIRST_JOB).
            label={t('Vos responsabilités ont-elles évolué depuis votre dernier emploi\u00A0?')}
            isValidated={isValidated} isValid={!!hasGreaterRole}>
            <RadioGroup<bayes.OptionalBool>
              onChange={setHasGreaterRole}
              options={localizedOptionalBoolOptions}
              value={hasGreaterRole}
              childStyle={optionalChildStyle} />
          </OneField>
        </React.Fragment> : null}
        {isEmployedAndStoppedSeeking && isNewJob === 'TRUE' ? <OneField
          label={t('Quel type de contrat avez-vous décroché\u00A0?')}
          isValidated={isValidated} isValid={!!newJobContractType}>
          <RadioGroup<bayes.bob.EmploymentType>
            onChange={setNewJobContractType}
            style={{flexDirection: 'column'}}
            options={localizedContractTypeOptions}
            value={newJobContractType} />
        </OneField> : null}
        {isEmployedAndStoppedSeeking && wasAlreadyEmployed === 'True' ? <React.Fragment>
          <OneField
            label={t('Avez-vous reçu une promotion\u00A0?')}
            isValidated={isValidated} isValid={!!hasBeenPromoted}>
            <RadioGroup<bayes.OptionalBool>
              onChange={setHasBeenPromoted}
              options={localizedOptionalBoolOptions}
              value={hasBeenPromoted}
              childStyle={optionalChildStyle} />
          </OneField>
          <OneField
            label={t('Avez-vous reçu une augmentation salariale\u00A0?')}
            isValidated={isValidated} isValid={!!hasSalaryIncreased}>
            <RadioGroup<bayes.OptionalBool>
              onChange={setHasSalaryIncreased}
              options={localizedOptionalBoolOptions}
              value={hasSalaryIncreased}
              childStyle={optionalChildStyle} />
          </OneField>
        </React.Fragment> : null}
        {isEmployedAndStoppedSeeking && isNewJob === 'TRUE' ? <OneField
          label={t('Votre nouvel emploi est-il dans un secteur différent du précédent\u00A0?')}
          isValidated={isValidated} isValid={!!isJobInDifferentSector}>
          <RadioGroup<bayes.OptionalBool>
            onChange={setIsJobInDifferentSector}
            options={localizedOptionalBoolOptions}
            value={isJobInDifferentSector}
            childStyle={optionalChildStyle} />
        </OneField> : null}
        <OneField
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
        </OneField>
        <section style={paragraphStyle}>
          <p style={{margin: '0 0 11px'}}>{t(
            "Dans quelle mesure êtes-vous d'accord ou non avec les affirmations suivantes\u00A0:",
          )}</p>
          <LikertGrid
            scale={translatedOpinionAnswers} questions={translatedOpinionQuestions}
            values={opinions} onChange={updateOpinionScore} isShownAsGrid={!isMobileVersion} />
        </section>
        <OneField
          label={t(
            'Y a-t-il autre chose que vous aimeriez partager avec nous au sujet de votre ' +
            'expérience avec {{productName}}\u00A0?',
            {productName: config.productName},
          )}>
          <Textarea
            placeholder={t('Saisissez un commentaire ici')}
            value={feedback} onChange={setFeedback} style={textareaStyle} />
        </OneField>
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
