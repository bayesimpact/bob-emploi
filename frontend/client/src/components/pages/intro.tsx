import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {useLocation} from 'react-router'

import useFastForward from 'hooks/fast_forward'
import type {Focusable} from 'hooks/focus'
import type {DispatchAllActions} from 'store/actions'
import {registerNewGuestUser} from 'store/actions'
import {inDepartement, lowerFirstLetter} from 'store/french'
import {getLanguage, isTuPossible} from 'store/i18n'
import {getTranslatedMainChallenges} from 'store/main_challenges'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import {NO_CHALLENGE_CATEGORY_ID} from 'store/project'
import {useCancelablePromises} from 'store/promise'
import {useActionPlan, useSelfDiagnosticInIntro, useUserExample} from 'store/user'

import Button from 'components/button'
import Trans from 'components/i18n_trans'
import type {Inputable} from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import Markdown from 'components/markdown'
import {PageWithNavigationBar} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  QuestionBubble} from 'components/phylactery'
import RadioGroup from 'components/radio_group'
import {SmartLink} from 'components/radium'
import {SelfDiagnostic} from 'components/pages/connected/profile/self_diagnostic'
import {Routes} from 'components/url'
import ValidateInput from 'components/validate_input'


const tutoiementOptions = [
  {name: 'oui, pourquoi pas', value: true},
  {name: 'non, merci', value: false},
]


interface IntroProps {
  city?: bayes.bob.FrenchCity
  isGuest?: boolean
  job?: bayes.bob.Job
  name?: string
  onSubmit: (
    userData: bayes.bob.AuthUserData, name: string, isPersistent: boolean,
  ) => Promise<boolean>
  stats?: bayes.bob.LaborStatsData
}


interface IntroState {
  areCGUAccepted?: boolean
  canTutoie?: boolean
  isFastForwarded?: boolean
  isSubmitClicked?: boolean
  isTuNeeded: boolean
  newName?: string
}

const boldStyle = {
  color: colors.BOB_BLUE,
}
const linkStyle: RadiumCSSProperties = {
  ':focus': {
    textDecoration: 'underline',
  },
  ':hover': {
    textDecoration: 'underline',
  },
  'color': colors.BOB_BLUE,
  'fontWeight': 'bold',
  'textDecoration': 'none',
}
const buttonStyle = {
  maxWidth: 250,
  padding: '12px 20px 13px',
}
const discussionStyle = {
  flexGrow: 1,
  flexShrink: 0,
  paddingBottom: 10,
  width: isMobileVersion ? 335 : 'initial',
}
const nameStyle: React.CSSProperties = {
  borderRadius: 100,
  marginBottom: 5,
  marginTop: 15,
}
const tuStyle: React.CSSProperties = {
  justifyContent: 'space-between',
  margin: '20px 0',
}
const submitBlockStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  margin: '20px auto 0',
}
const errorStyle: React.CSSProperties = {
  marginTop: 20,
  textAlign: 'left',
}
const MarkdownSpan = ({children}: React.HTMLProps<HTMLParagraphElement>): React.ReactElement =>
  <span>{children}</span>
const markdownComponents = {p: MarkdownSpan}
const IntroBase = (props: IntroProps): React.ReactElement => {
  const {
    city, city: {departementName = ''} = {},
    isGuest,
    job: {jobGroup: {name: jobGroupName = ''} = {}} = {},
    name,
    onSubmit,
    stats: {localStats: {imt: {yearlyAvgOffersPer10Candidates = 0} = {}} = {}} = {},
  } = props
  const {i18n, t} = useTranslation()
  const [areCGUAccepted, setAreCguAccepted] = useState(!isGuest)
  const [isUserPersistent, setIsUserPersistent] = useState(false)
  const isNameUpdateNeeded = !name
  const {search} = useLocation()
  const nameFromURL = parseQueryString(search).name || ''
  const [newName, setNewName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitClicked, setIsSubmitClicked] = useState(false)
  // Keep it as state so that we do not change the question even if the language changes.
  const [isTuNeeded] = useState(isTuPossible(i18n.language))
  const [canTutoie, setCanTutoie] = useState<undefined|boolean>()
  const [isFastForwarded, setIsFastForwarded] = useState(false)
  const cancelOnUnmount = useCancelablePromises()
  const [selfDiagnostic, setSelfDiagnostic] = useState<bayes.bob.SelfDiagnostic>({})
  const tutoieRadioGroup = useRef<Focusable>(null)
  const cguRef = useRef<Focusable>(null)
  const hasSelfDiagnostic = useSelfDiagnosticInIntro()
  const {categoryDetails, categoryId, status} = selfDiagnostic
  const isSelfDiagnosticAnswered = status &&
    (status !== 'OTHER_SELF_DIAGNOSTIC' || !!categoryDetails)
  const noPriority = status === 'UNDEFINED_SELF_DIAGNOSTIC' ||
      (status === 'KNOWN_SELF_DIAGNOSTIC' && categoryId === NO_CHALLENGE_CATEGORY_ID)

  const toggleCGU = useCallback((): void => {
    setAreCguAccepted((before: boolean): boolean => !before)
    setErrorMessage('')
  }, [])

  const toggleIsUserPersistent = useCallback((): void => {
    setIsUserPersistent((before: boolean): boolean => !before)
  }, [])

  const handleTutoieChange = useCallback((canTutoie: boolean): void => {
    setCanTutoie(canTutoie)
    setErrorMessage('')
  }, [])

  const finalName = isNameUpdateNeeded && newName || name
  const isTuMissing = isTuNeeded && typeof canTutoie !== 'boolean'

  const locale = `${getLanguage()}${canTutoie ? '@tu' : ''}`

  useEffect((): void => {
    i18n.changeLanguage(locale)
  }, [i18n, locale])

  const nameRef = useRef<Inputable>(null)
  const nameLabelId = useMemo(_uniqueId, [])
  const tutoieLabelId = useMemo(_uniqueId, [])
  const errorFieldId = useMemo(_uniqueId, [])
  const [errorField, setErrorField] = useState('')

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!finalName) {
      setErrorMessage(t(
        'Donnez-moi votre prénom ci-dessus avant de continuer. Si vous préférez rester ' +
        'discret·e, vous pouvez mettre un prénom au hasard\u00A0: Camille, Laurent ou Lisa par ' +
        'exemple.',
      ))
      setErrorField('name')
      nameRef.current?.focus()
      return
    }
    if (isTuMissing) {
      setErrorMessage(t('Avant de continuer, choisissez ci-dessus si on va se tutoyer ou non.'))
      setErrorField('tu')
      tutoieRadioGroup.current?.focus()
      return
    }
    if (!areCGUAccepted) {
      setErrorMessage(t('Avant de continuer, lisez et acceptez les CGU ci-dessus.'))
      setErrorField('cgu')
      cguRef.current?.focus()
      return
    }
    setIsSubmitClicked(true)
    await cancelOnUnmount(onSubmit({
      isAlpha: isFastForwarded,
      locale,
      originalSelfDiagnostic: selfDiagnostic,
    }, finalName, isUserPersistent))
    setIsSubmitClicked(false)
  }, [
    areCGUAccepted, cancelOnUnmount, finalName, isFastForwarded, isTuMissing, isUserPersistent,
    locale, onSubmit, selfDiagnostic, t,
  ])

  const handleTutoieQuestionIsShown = useCallback((): void => {
    tutoieRadioGroup.current?.focus()
  }, [])

  const handleFinalGroupIsShown = useCallback((): void => {
    cguRef.current?.focus()
  }, [])

  const updateName = useCallback((newName: string): void => {
    isNameUpdateNeeded && setNewName(newName.trim())
    setErrorMessage('')
  }, [isNameUpdateNeeded])

  const challengesData = getTranslatedMainChallenges(t, 'UNKNOWN_GENDER')
  const selfDiagnosticDescription = status === 'KNOWN_SELF_DIAGNOSTIC' && categoryId ?
    challengesData[categoryId]?.descriptionAnswer || '' :
    status === 'OTHER_SELF_DIAGNOSTIC' ? categoryDetails : ''

  const {profile: {name: nameExample}} = useUserExample()

  const onFastForward = useCallback((): void => {
    if (!isFastForwarded) {
      setIsFastForwarded(true)
      return
    }
    let isInfoComplete = true
    if (isNameUpdateNeeded && !newName) {
      setNewName(nameFromURL || nameExample)
      isInfoComplete = false
    }
    if (typeof canTutoie !== 'boolean' && isTuNeeded) {
      setCanTutoie(Math.random() < .5)
      isInfoComplete = false
    }
    if (hasSelfDiagnostic && !status) {
      // TODO(émilie): Randomize the self diagnostic.
      setSelfDiagnostic({categoryId: 'stuck-market', status: 'KNOWN_SELF_DIAGNOSTIC'})
    }
    if (!areCGUAccepted) {
      setAreCguAccepted(true)
      isInfoComplete = false
    }
    if (isInfoComplete) {
      handleSubmit()
    }
  }, [areCGUAccepted, canTutoie, handleSubmit, hasSelfDiagnostic, isFastForwarded,
    isNameUpdateNeeded, isTuNeeded, newName, nameFromURL, nameExample, status])
  useFastForward(onFastForward)

  const isCompetitionShown = jobGroupName && departementName && !!yearlyAvgOffersPer10Candidates
  const isToughCompetition = isCompetitionShown && yearlyAvgOffersPer10Candidates < 6
  const inCity = city ? inDepartement(city, t) : ''
  const toughCompetition = isToughCompetition ? t('rude') : t('faible')
  return <React.Fragment>
    <Discussion style={discussionStyle} isFastForwarded={isFastForwarded}>
      <DiscussionBubble>
        {isCompetitionShown && city ? <BubbleToRead>
          <Trans parent={null} count={yearlyAvgOffersPer10Candidates} key="bob-intro">
            Le saviez-vous&nbsp;?! La concurrence
            en {{jobGroupName: lowerFirstLetter(jobGroupName)}} {{inCity}} est{' '}
            {{toughCompetition}}, <strong>
              {{yearlyAvgOffersPer10Candidates}} offre pour 10 candidats
            </strong>.
          </Trans>
        </BubbleToRead> : null}
        {isCompetitionShown ? <BubbleToRead>
          {isToughCompetition ?
            t("Ce n'est pas simple mais vous pouvez y arriver.") :
            t("C'est une très bonne nouvelle\u00A0!")}
        </BubbleToRead> : null}
        <BubbleToRead><Trans parent={null}>
          Bienvenue<strong>{{optionalName: !name ? '' : (' ' + name)}}</strong>&nbsp;!
        </Trans></BubbleToRead>
        <BubbleToRead>
          <Trans parent={null}>
            Je suis <strong style={boldStyle}>{{productName: config.productName}}</strong>, votre
            assistant personnel pour accélérer votre recherche.
          </Trans>
        </BubbleToRead>
        <BubbleToRead>
          <Trans parent={null}>
            Je vais vous accompagner tout au long de votre projet et vous aider à le réaliser au
            plus vite.
          </Trans>
        </BubbleToRead>
        {isNameUpdateNeeded ? <BubbleToRead id={nameLabelId}>
          <Trans parent={null}>
            Mais avant de commencer, comment vous appelez-vous&nbsp;?
          </Trans>
        </BubbleToRead> :
          isTuNeeded ? <BubbleToRead id={tutoieLabelId}>
            Mais avant de commencer, peut-on se tutoyer&nbsp;?
          </BubbleToRead> : null}
      </DiscussionBubble>
      {isNameUpdateNeeded ? <QuestionBubble isDone={!!newName}>
        <ValidateInput
          defaultValue={name || newName || nameFromURL} onChange={updateName}
          autoComplete="given-name" name="given-name"
          placeholder={t('Tapez votre prénom')} ref={nameRef}
          style={nameStyle} shouldFocusOnMount={true} aria-labelledby={nameLabelId}
          aria-describedby={errorMessage && (errorField === 'name') && errorFieldId || undefined}
          aria-required={true} aria-invalid={!!errorMessage && (errorField === 'name')} />
      </QuestionBubble> : null}
      {isNameUpdateNeeded ? <BubbleToRead id={isTuNeeded ? tutoieLabelId : undefined}>
        <Trans parent={null}>
          Enchanté, {{newName}}&nbsp;!
        </Trans>{' '}{isTuNeeded ? <React.Fragment>
          Peut-on se tutoyer&nbsp;?
        </React.Fragment> : null}
      </BubbleToRead> : null}
      {isTuNeeded ? <QuestionBubble
        isDone={typeof canTutoie === 'boolean'}
        onShown={handleTutoieQuestionIsShown}>
        <RadioGroup
          style={tuStyle}
          childStyle={{padding: isMobileVersion ? '12px 20px' : '12px 35px'}}
          ref={tutoieRadioGroup}
          onChange={handleTutoieChange}
          options={tutoiementOptions}
          value={canTutoie}
          type="button"
          aria-labelledby={tutoieLabelId}
          aria-required={true}
          aria-describedby={!!errorMessage && (errorField === 'tu') && errorFieldId || undefined}
          aria-invalid={!!errorMessage && (errorField === 'tu')} />
      </QuestionBubble> : null}
      {hasSelfDiagnostic ? <DiscussionBubble>
        {isTuNeeded ? <BubbleToRead>
          {t("Parfait, c'est noté.")}
        </BubbleToRead> : null}
        <BubbleToRead>
          <Trans parent={null}>
            Selon vous, quelle est <strong>la plus grande priorité de votre
            recherche d'emploi</strong>&nbsp;?
          </Trans>
        </BubbleToRead>
        <BubbleToRead>
          <Trans parent={null}>
            Votre choix m'aidera à comprendre ce qui vous semble prioritaire, mais je vous
            préviendrai si je pense que votre priorité est ailleurs. Promis&nbsp;!
          </Trans>
        </BubbleToRead>
      </DiscussionBubble> : null}
      {hasSelfDiagnostic ? <QuestionBubble isDone={isSelfDiagnosticAnswered}>
        <div style={{marginBottom: 5, marginTop: 15}}>
          <SelfDiagnostic
            value={selfDiagnostic} onChange={setSelfDiagnostic} isAlpha={isFastForwarded} />
        </div>
      </QuestionBubble> : null}
      {!hasSelfDiagnostic || isSelfDiagnosticAnswered ? <DiscussionBubble
        key={categoryId || status}>
        {!hasSelfDiagnostic && isTuNeeded || (isSelfDiagnosticAnswered && noPriority) ?
          <BubbleToRead>
            {t("Parfait, c'est noté.")}
          </BubbleToRead> : null}
        {isSelfDiagnosticAnswered && selfDiagnosticDescription && !noPriority ? <BubbleToRead>
          <Trans parent={null}>
            Compris, <Markdown content={lowerFirstLetter(selfDiagnosticDescription)}
              components={markdownComponents} /> est votre priorité en ce moment.
          </Trans>
        </BubbleToRead> : null}
        <BubbleToRead>
          <Trans parent={null}>
            Nous allons maintenant analyser votre projet grâce à un petit questionnaire.
          </Trans>
        </BubbleToRead>
        <BubbleToRead>
          <Trans parent={null}>
            Cela ne prendra qu'entre <strong style={boldStyle}>2</strong> et
            <strong style={boldStyle}> 5 minutes</strong> et me permettra de bien
            cerner vos besoins.
          </Trans>
        </BubbleToRead>
        <BubbleToRead>
          <Trans parent={null}>
            On commence&nbsp;?
          </Trans>
        </BubbleToRead>
      </DiscussionBubble> : null}
      {!hasSelfDiagnostic || isSelfDiagnosticAnswered ? <NoOpElement
        style={submitBlockStyle} onShown={handleFinalGroupIsShown}>
        <div>
          {isGuest ? <LabeledToggle
            aria-describedby={errorMessage && (errorField === 'cgu') && errorFieldId || undefined}
            aria-required={true} aria-invalid={!!errorMessage && (errorField === 'cgu')}
            ref={cguRef} label={<Trans parent={null}>
              J'ai lu et j'accepte
              les <SmartLink href={Routes.TERMS_AND_CONDITIONS_PAGE} style={linkStyle}>
                CGU
              </SmartLink>
            </Trans>} isSelected={areCGUAccepted} onClick={toggleCGU}
            type="checkbox" /> : null}
          <LabeledToggle
            label={t('Sauver ma progression au fur et à mesure')} isSelected={isUserPersistent}
            onClick={toggleIsUserPersistent} type="checkbox" />
          <br />
        </div>
        <Button
          isRound={true} onClick={handleSubmit} style={buttonStyle}
          disabled={isSubmitClicked} isProgressShown={isSubmitClicked}>
          <Trans parent={null}>Commencer le questionnaire</Trans>
        </Button>
        {errorMessage ? <div id={errorFieldId} style={errorStyle}>
          {errorMessage}
        </div> : null}
      </NoOpElement> : null}
    </Discussion>
  </React.Fragment>
}
const Intro = React.memo(IntroBase)


interface IntroState {
  city?: bayes.bob.FrenchCity
  job?: bayes.bob.Job
  stats?: bayes.bob.LaborStatsData
}


const pageStyle: React.CSSProperties = {
  alignItems: 'flex-end',
  backgroundColor: '#fff',
  display: 'flex',
  justifyContent: 'center',
  padding: '0 20px',
}


const IntroPageBase = (): React.ReactElement => {
  const location = useLocation<IntroState>()

  const dispatch = useDispatch<DispatchAllActions>()
  // TODO(cyrille): Also fetch the email, and pre-fill it in the relevant form.
  const {maVoieId, stepId} = parseQueryString(location.search)
  const isActionPlanEnabled = useActionPlan()
  const authUserData = useMemo((): bayes.bob.AuthUserData => ({
    ...maVoieId && {maVoie: {maVoieId, stepId}},
    isActionPlanEnabled,
  }), [isActionPlanEnabled, maVoieId, stepId])
  const handleSubmit = useCallback(
    async (
      userData: bayes.bob.AuthUserData, name: string, isPersistent: boolean,
    ): Promise<boolean> =>
      !!await dispatch(registerNewGuestUser(name, isPersistent, {...authUserData, ...userData})),
    [authUserData, dispatch],
  )

  const {city = undefined, job = undefined, stats = undefined} = location.state || {}
  return <PageWithNavigationBar page="intro" style={pageStyle}>
    <div style={{maxWidth: 440}}>
      <Intro onSubmit={handleSubmit} isGuest={true} {...{city, job, stats}} />
    </div>
  </PageWithNavigationBar>
}
const IntroPage = React.memo(IntroPageBase)


export {Intro, IntroPage}
