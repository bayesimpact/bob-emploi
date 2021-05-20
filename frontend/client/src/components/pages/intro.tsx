import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {useLocation} from 'react-router'

import useFastForward from 'hooks/fast_forward'
import {Focusable} from 'hooks/focus'
import {DispatchAllActions, registerNewGuestUser} from 'store/actions'
import {inDepartement, lowerFirstLetter} from 'store/french'
import {getLanguage, getTranslatedMainChallenges, isTuPossible} from 'store/i18n'
import isMobileVersion from 'store/mobile'
import {parseQueryString} from 'store/parse'
import {NO_CHALLENGE_CATEGORY_ID} from 'store/project'
import {useCancelablePromises} from 'store/promise'
import {useSelfDiagnosticInIntro, useUserExample} from 'store/user'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import LabeledToggle from 'components/labeled_toggle'
import Markdown from 'components/markdown'
import {PageWithNavigationBar} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  QuestionBubble} from 'components/phylactery'
import {SelfDiagnostic} from 'components/pages/connected/profile/self_diagnostic'
import RadioGroup from 'components/radio_group'
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
  onSubmit: (userData: bayes.bob.AuthUserData, name: string) => Promise<boolean>
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
const linkStyle: React.CSSProperties = {
  color: colors.BOB_BLUE,
  textDecoration: 'none',
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
const MarkdownSpan = (props: React.HTMLProps<HTMLParagraphElement>): React.ReactElement =>
  <span {...props} />
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
  const isNameUpdateNeeded = !name
  const {search} = useLocation()
  const nameFromURL = parseQueryString(search).name || ''
  const [newName, setNewName] = useState('')
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
  }, [])

  const finalName = isNameUpdateNeeded && newName || name
  const canSubmit =
    !!(areCGUAccepted && finalName && (!isTuNeeded || typeof canTutoie === 'boolean'))

  const locale = `${getLanguage()}${canTutoie ? '@tu' : ''}`

  useEffect((): void => {
    i18n.changeLanguage(locale)
  }, [i18n, locale])

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!canSubmit || !finalName) {
      return
    }
    setIsSubmitClicked(true)
    await cancelOnUnmount(onSubmit({
      isAlpha: isFastForwarded,
      locale,
      originalSelfDiagnostic: selfDiagnostic,
    }, finalName))
    setIsSubmitClicked(false)
  }, [canSubmit, cancelOnUnmount, finalName, isFastForwarded, locale, onSubmit, selfDiagnostic])

  const handleTutoieQuestionIsShown = useCallback((): void => {
    tutoieRadioGroup.current?.focus()
  }, [])

  const handleFinalGroupIsShown = useCallback((): void => {
    cguRef.current?.focus()
  }, [])

  const updateName = useCallback((newName: string): void => {
    isNameUpdateNeeded && setNewName(newName.trim())
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
        {isNameUpdateNeeded ? <BubbleToRead>
          <Trans parent={null}>
            Mais avant de commencer, comment vous appelez-vous&nbsp;?
          </Trans>
        </BubbleToRead> :
          isTuNeeded ? <BubbleToRead>
            Mais avant de commencer, peut-on se tutoyer&nbsp;?
          </BubbleToRead> : null}
      </DiscussionBubble>
      {isNameUpdateNeeded ? <QuestionBubble isDone={!!newName}>
        <ValidateInput
          defaultValue={name || newName || nameFromURL} onChange={updateName}
          autoComplete="given-name"
          placeholder={t('Tapez votre prénom')}
          style={nameStyle} shouldFocusOnMount={true} />
      </QuestionBubble> : null}
      {isNameUpdateNeeded ? <BubbleToRead>
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
          ref={tutoieRadioGroup}
          onChange={setCanTutoie}
          options={tutoiementOptions}
          value={canTutoie}
          type="button" />
      </QuestionBubble> : null}
      {hasSelfDiagnostic ? <DiscussionBubble>
        {isTuNeeded ? <BubbleToRead>
          Parfait, c'est noté.
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
          <SelfDiagnostic value={selfDiagnostic} onChange={setSelfDiagnostic} />
        </div>
      </QuestionBubble> : null}
      {!hasSelfDiagnostic || isSelfDiagnosticAnswered ? <DiscussionBubble
        key={categoryId || status}>
        {!hasSelfDiagnostic && isTuNeeded || (isSelfDiagnosticAnswered && noPriority) ?
          <BubbleToRead>
            Parfait, c'est noté.
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
        style={{margin: '20px auto 0', textAlign: 'center'}}
        onShown={handleFinalGroupIsShown}>
        {isGuest ? <React.Fragment>
          <LabeledToggle ref={cguRef} label={<Trans parent={null}>
            J'ai lu et j'accepte
            les <ExternalLink href={Routes.TERMS_AND_CONDITIONS_PAGE} style={linkStyle}>
              CGU
            </ExternalLink>
          </Trans>} isSelected={areCGUAccepted} onClick={toggleCGU}
          type="checkbox" /><br />
        </React.Fragment> : null}
        <Button
          isRound={true} onClick={handleSubmit} style={buttonStyle}
          disabled={!canSubmit || isSubmitClicked} isProgressShown={isSubmitClicked}>
          <Trans parent={null}>Commencer le questionnaire</Trans>
        </Button>
      </NoOpElement> : null}
    </Discussion>
  </React.Fragment>
}
IntroBase.propTypes = {
  city: PropTypes.shape({
    cityId: PropTypes.string.isRequired,
  }),
  isGuest: PropTypes.bool,
  job: PropTypes.shape({
    codeOgr: PropTypes.string.isRequired,
  }),
  name: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  stats: PropTypes.shape({
    jobGroupInfo: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
    localStats: PropTypes.shape({
      imt: PropTypes.object,
    }),
  }),
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
  const authUserData = useMemo((): bayes.bob.AuthUserData => maVoieId ? {
    maVoie: {maVoieId, stepId},
  } : {}, [maVoieId, stepId])
  const handleSubmit = useCallback(
    async (userData: bayes.bob.AuthUserData, name: string): Promise<boolean> =>
      !!await dispatch(registerNewGuestUser(name, {...authUserData, ...userData})),
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
