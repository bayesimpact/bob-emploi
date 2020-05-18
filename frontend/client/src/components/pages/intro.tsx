import PropTypes from 'prop-types'
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {RouteComponentProps, StaticContext, withRouter} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, registerNewGuestUser} from 'store/actions'
import {inDepartement, lowerFirstLetter} from 'store/french'
import {getLanguage, isTuPossible} from 'store/i18n'
import {useCancelablePromises} from 'store/promise'

import {useFastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  QuestionBubble} from 'components/phylactery'
import {Button, ExternalLink, Focusable, Input, Inputable, InputProps, LabeledToggle,
  RadioGroup} from 'components/theme'
import {Routes} from 'components/url'


type ValidateInputProps = InputProps & {
  defaultValue?: string
  onChange: (newValue: string) => void
  // Should never set a value, but used defaultValue and onChange.
  value?: never
}


const ValidateInputBase = (props: ValidateInputProps): React.ReactElement => {
  const {style, defaultValue, onChange, ...otherProps} = props
  const [value, setValue] = useState('')
  const input = useRef<Inputable>(null)

  const handleFocus = useCallback((): void => {
    input.current?.focus()
  }, [])

  useLayoutEffect((): void => {
    setValue(defaultValue || '')
  }, [defaultValue])

  const handleClick = useCallback((): void => {
    if (!value) {
      handleFocus()
      return
    }
    input.current?.blur()
    onChange(value)
  }, [handleFocus, onChange, value])

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault()
    handleClick()
  }, [handleClick])

  const buttonStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '6px 16px 7px',
    position: 'absolute',
    right: 6,
    top: 6,
  }
  return <form style={{...style, position: 'relative'}} onSubmit={handleSubmit}>
    <Input {...otherProps} ref={input} value={value} onChange={setValue} />
    <Button style={buttonStyle} onClick={handleClick} isRound={true}>
      <Trans parent={null}>Valider</Trans>
    </Button>
  </form>
}
ValidateInputBase.propTypes = {
  defaultValue: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  shouldFocusOnMount: PropTypes.bool,
  style: PropTypes.object,
}
const ValidateInput = React.memo(ValidateInputBase)


const tutoiementOptions = [
  {name: 'oui, pourquoi pas', value: true},
  {name: 'non, je ne préfère pas', value: false},
]


interface IntroProps {
  city?: bayes.bob.FrenchCity
  job?: bayes.bob.Job
  name?: string
  onSubmit: (userData: bayes.bob.AuthUserData, name: string) => Promise<boolean>
  stats?: bayes.bob.LaborStatsData
}


interface IntroState {
  areCGUAccepted?: boolean
  canTutoie?: boolean
  isFastForwarded?: boolean
  isGuest?: boolean
  isSubmitClicked?: boolean
  isTuNeeded: boolean
  newName?: string
}


const IntroBase = (props: IntroProps): React.ReactElement => {
  const {
    city, city: {departementName = ''} = {},
    job: {jobGroup: {name: jobGroupName = ''} = {}} = {},
    name,
    onSubmit,
    stats: {localStats: {imt: {yearlyAvgOffersPer10Candidates = 0} = {}} = {}} = {},
  } = props
  const {i18n, t} = useTranslation()
  const [areCGUAccepted, setAreCguAccepted] = useState(!!name)
  const [isGuest] = useState(!name)
  const [newName, setNewName] = useState('')
  const [isSubmitClicked, setIsSubmitClicked] = useState(false)
  // Keep it as state so that we do not change the question even if the language changes.
  const [isTuNeeded] = useState(isTuPossible(i18n.language))
  const [canTutoie, setCanTutoie] = useState<undefined|boolean>()
  const [isFastForwarded, setIsFastForwarded] = useState(false)
  const cancelOnUnmount = useCancelablePromises()

  const tutoieRadioGroup = useRef<Focusable>(null)
  const cguRef = useRef<Focusable>(null)

  const toggleCGU = useCallback((): void => {
    setAreCguAccepted((before: boolean): boolean => !before)
  }, [])

  const finalName = isGuest ? newName : name
  const canSubmit =
    !!(areCGUAccepted && finalName && (!isTuNeeded || typeof canTutoie === 'boolean'))

  const locale = `${getLanguage()}${canTutoie ? '@tu' : ''}`

  useEffect((): void => {
    i18n.changeLanguage(locale)
  }, [i18n, locale])

  const handleSubmit = useCallback((): void => {
    if (canSubmit && finalName) {
      setIsSubmitClicked(true)
      cancelOnUnmount(onSubmit({
        isAlpha: isFastForwarded,
        locale,
      }, finalName)).then((): void => {
        setIsSubmitClicked(false)
      })
    }
  }, [canSubmit, cancelOnUnmount, finalName, isFastForwarded, locale, onSubmit])

  const handleTutoieQuestionIsShown = useCallback((): void => {
    tutoieRadioGroup.current?.focus()
  }, [])

  const handleFinalGroupIsShown = useCallback((): void => {
    cguRef.current?.focus()
  }, [])

  const updateName = useCallback((newName: string): void => setNewName(newName.trim()), [])

  const onFastForward = useCallback((): void => {
    if (!isFastForwarded) {
      setIsFastForwarded(true)
      return
    }
    let isInfoComplete = true
    if (isGuest && !newName) {
      setNewName(t('Angèle'))
      isInfoComplete = false
    }
    if (typeof canTutoie !== 'boolean' && isTuNeeded) {
      setCanTutoie(Math.random() < .5)
      isInfoComplete = false
    }
    if (!areCGUAccepted) {
      setAreCguAccepted(true)
      isInfoComplete = false
    }
    if (isInfoComplete) {
      handleSubmit()
    }
  }, [areCGUAccepted, canTutoie, handleSubmit, isFastForwarded, isGuest, isTuNeeded, newName, t])
  useFastForward(onFastForward)

  const isCompetitionShown = jobGroupName && departementName && !!yearlyAvgOffersPer10Candidates
  const isToughCompetition = isCompetitionShown && yearlyAvgOffersPer10Candidates < 6
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
    width: isMobileVersion ? 280 : 'initial',
  }
  const inCity = city ? inDepartement(city, t) : ''
  const toughCompetition = isToughCompetition ? t('rude') : t('faible')
  const isNameNeeded = isGuest
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
          Bienvenue<strong>{{optionalName: isGuest ? '' : (' ' + name)}}</strong>&nbsp;!
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
        {isNameNeeded ? <BubbleToRead>
          <Trans parent={null}>
            Mais avant de commencer, comment vous appelez-vous&nbsp;?
          </Trans>
        </BubbleToRead> :
          isTuNeeded ? <BubbleToRead>
            Mais avant de commencer, peut-on se tutoyer&nbsp;?
          </BubbleToRead> : null}
      </DiscussionBubble>
      {isNameNeeded ? <QuestionBubble isDone={!!newName}>
        <ValidateInput
          defaultValue={name || newName} onChange={updateName}
          placeholder={t('Tapez votre prénom')}
          style={{marginBottom: 5, marginTop: 15}} shouldFocusOnMount={true} />
      </QuestionBubble> : null}
      {isNameNeeded ? <BubbleToRead>
        <Trans parent={null}>
          Enchanté, {{newName: newName || ''}}&nbsp;!
        </Trans>{' '}{isTuNeeded ? <React.Fragment>
          Peut-on se tutoyer&nbsp;?
        </React.Fragment> : null}
      </BubbleToRead> : null}
      {isTuNeeded ? <QuestionBubble
        isDone={typeof canTutoie === 'boolean'}
        onShown={handleTutoieQuestionIsShown}>
        <RadioGroup
          style={{justifyContent: 'space-between', margin: 20}}
          ref={tutoieRadioGroup}
          onChange={setCanTutoie}
          options={tutoiementOptions} value={canTutoie} />
      </QuestionBubble> : null}
      <DiscussionBubble>
        {isTuNeeded ? <BubbleToRead>
          Parfait, c'est noté.
        </BubbleToRead> : null}
        <BubbleToRead>
          <Trans parent={null}>
            Pour évaluer votre projet je vais avoir besoin de vous poser quelques questions
            rapides.
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
      </DiscussionBubble>
      <NoOpElement
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
      </NoOpElement>
    </Discussion>
  </React.Fragment>
}
IntroBase.propTypes = {
  city: PropTypes.shape({
    cityId: PropTypes.string.isRequired,
  }),
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


const IntroPageBase =
(props: RouteComponentProps<{}, StaticContext, IntroState>): React.ReactElement => {
  const {location} = props

  const dispatch = useDispatch<DispatchAllActions>()
  const handleSubmit = useCallback(
    (userData: bayes.bob.AuthUserData, name: string): Promise<boolean> => {
      return dispatch(registerNewGuestUser(name, userData)).
        then((response): boolean => !!response)
    },
    [dispatch],
  )

  const {city = undefined, job = undefined, stats = undefined} = location.state || {}
  return <PageWithNavigationBar page="intro" style={pageStyle}>
    <div style={{maxWidth: 440}}>
      <Intro onSubmit={handleSubmit} {...{city, job, stats}} />
    </div>
  </PageWithNavigationBar>
}
IntroPageBase.propTypes = {
  location: ReactRouterPropTypes.location.isRequired,
}
const IntroPage = withRouter(React.memo(IntroPageBase))


export {Intro, IntroPage}
