import PropTypes from 'prop-types'
import React, {useCallback} from 'react'
import {WithTranslation, withTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'
import {RouteComponentProps, StaticContext, withRouter} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import {inDepartement, lowerFirstLetter} from 'store/french'
import {getLanguage, isTuPossible} from 'store/i18n'
import {DispatchAllActions, registerNewGuestUser} from 'store/actions'

import {FastForward} from 'components/fast_forward'
import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {PageWithNavigationBar} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  QuestionBubble} from 'components/phylactery'
import {Button, ExternalLink, Input, InputProps, LabeledToggle, RadioGroup} from 'components/theme'
import {Routes} from 'components/url'


type ValidateInputProps = InputProps & {
  defaultValue?: string
  onChange: (newValue: string) => void
  shouldFocusOnMount?: boolean
  // Should never set a value, but used defaultValue and onChange.
  value?: never
}


interface ValidateInputState {
  defaultValue?: string
  value?: string
}


class ValidateInput extends React.PureComponent<ValidateInputProps, ValidateInputState> {
  public static propTypes = {
    defaultValue: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    shouldFocusOnMount: PropTypes.bool,
    style: PropTypes.object,
  }

  public static getDerivedStateFromProps(
    props: ValidateInputProps, state: ValidateInputState): ValidateInputState|null {
    const defaultValue = props.defaultValue || ''
    if (defaultValue === state.defaultValue) {
      return null
    }
    if (state.value === state.defaultValue) {
      return {defaultValue, value: defaultValue}
    }
    return {defaultValue}
  }

  public state: ValidateInputState = {}

  public componentDidMount(): void {
    const {shouldFocusOnMount} = this.props
    if (shouldFocusOnMount && !isMobileVersion) {
      this.handleFocus()
    }
  }

  private input: React.RefObject<Input> = React.createRef()

  private handleFocus = (): void => {
    this.input.current && this.input.current.focus()
  }

  private handleClick = (): void => {
    if (!this.state.value) {
      this.handleFocus()
      return
    }
    this.input.current && this.input.current.blur()
    this.props.onChange(this.state.value)
  }

  private handleChange = (value: string): void => this.setState({value})

  private handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    this.handleClick()
  }

  public render(): React.ReactNode {
    const {style,
      defaultValue: omittedDefaultValue,
      onChange: omittedOnChange,
      shouldFocusOnMount: omittedShouldFocusOnMount,
      ...otherProps} = this.props
    const buttonStyle: React.CSSProperties = {
      fontSize: 13,
      padding: '6px 16px 7px',
      position: 'absolute',
      right: 6,
      top: 6,
    }
    return <form style={{...style, position: 'relative'}} onSubmit={this.handleSubmit}>
      <Input
        {...otherProps} ref={this.input}
        value={this.state.value} onChange={this.handleChange} />
      <Button style={buttonStyle} onClick={this.handleClick} isRound={true}>
        <Trans parent={null}>Valider</Trans>
      </Button>
    </form>
  }
}


const tutoiementOptions = [
  {name: 'oui, pourquoi pas', value: true},
  {name: 'non, je ne préfère pas', value: false},
]


interface IntroProps extends WithTranslation {
  city?: bayes.bob.FrenchCity
  job?: bayes.bob.Job
  name?: string
  onSubmit: (canTutoie: boolean, locale: string, name: string) => Promise<boolean>
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


class IntroBase extends React.PureComponent<IntroProps, IntroState> {
  public static propTypes = {
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
    t: PropTypes.func.isRequired,
  }

  public state: IntroState = {
    areCGUAccepted: !!this.props.name,
    isGuest: !this.props.name,
    isSubmitClicked: false,
    // Keep it as state so that we do not change the question even if the language changes.
    isTuNeeded: isTuPossible(this.props.i18n.language),
  }

  public componentWillUnmount(): void {
    this.isUnmounted = true
  }

  private isUnmounted = false

  private tutoieRadioGroup: React.RefObject<RadioGroup<boolean>> = React.createRef()

  private cguRef: React.RefObject<LabeledToggle> = React.createRef()

  private toggleCGU = (): void => {
    this.setState(({areCGUAccepted}: IntroState): Pick<IntroState, 'areCGUAccepted'> =>
      ({areCGUAccepted: !areCGUAccepted}))
  }

  private canSubmit = (): boolean => {
    const {areCGUAccepted, canTutoie, isGuest, isTuNeeded, newName} = this.state
    const finalName = isGuest ? newName : this.props.name
    return !!(areCGUAccepted && finalName && (!isTuNeeded || typeof canTutoie === 'boolean'))
  }

  private getLocale(): string {
    const {canTutoie} = this.state
    const rootLanguage = getLanguage()
    return `${rootLanguage}${canTutoie ? '@tu' : ''}`
  }

  private handleChangeTutoiement = (canTutoie?: boolean): void => {
    const {i18n} = this.props
    this.setState({canTutoie}, () => i18n.changeLanguage(this.getLocale()))
  }

  private handleSubmit = (): void => {
    const {canTutoie, isGuest, newName} = this.state
    const {name, onSubmit} = this.props
    const finalName = isGuest ? newName : name
    if (this.canSubmit() && finalName) {
      this.setState({isSubmitClicked: true})
      onSubmit(!!canTutoie, this.getLocale(), finalName).then((): void => {
        if (!this.isUnmounted) {
          this.setState({isSubmitClicked: false})
        }
      })
    }
  }

  private handleTutoieQuestionIsShown = (): void => {
    this.tutoieRadioGroup.current && this.tutoieRadioGroup.current.focus()
  }

  private handleFinalGroupIsShown = (): void => {
    this.cguRef.current && this.cguRef.current.focus()
  }

  private updateName = (newName: string): void =>
    this.setState({newName: newName.trim()})

  private onFastForward = (): void => {
    const {areCGUAccepted, canTutoie, isFastForwarded, isGuest, isTuNeeded, newName} = this.state
    if (!isFastForwarded) {
      this.setState({isFastForwarded: true})
      return
    }
    if (isGuest && !newName) {
      this.setState({newName: 'Angèle'})
      return
    }
    if (typeof canTutoie !== 'boolean' && isTuNeeded) {
      this.setState({canTutoie: Math.random() < .5})
      return
    }
    if (!areCGUAccepted) {
      this.setState({areCGUAccepted: true})
      return
    }
    this.handleSubmit()
  }

  public render(): React.ReactNode {
    const {
      city, city: {departementName = ''} = {},
      job: {jobGroup: {name: jobGroupName = ''} = {}} = {},
      name,
      stats: {localStats: {imt: {yearlyAvgOffersPer10Candidates = 0} = {}} = {}} = {},
      t,
    } = this.props
    const {areCGUAccepted, canTutoie, isGuest, isSubmitClicked, isTuNeeded, newName} = this.state
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
      <FastForward onForward={this.onFastForward} />
      <Discussion
        style={discussionStyle} isFastForwarded={this.state.isFastForwarded}>
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
            defaultValue={name || newName} onChange={this.updateName}
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
          onShown={this.handleTutoieQuestionIsShown}>
          <RadioGroup
            style={{justifyContent: 'space-between', margin: 20}}
            ref={this.tutoieRadioGroup}
            onChange={this.handleChangeTutoiement}
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
          onShown={this.handleFinalGroupIsShown}>
          {isGuest ? <React.Fragment>
            <LabeledToggle ref={this.cguRef} label={<Trans parent={null}>
              J'ai lu et j'accepte
              les <ExternalLink href={Routes.TERMS_AND_CONDITIONS_PAGE} style={linkStyle}>
                CGU
              </ExternalLink>
            </Trans>} isSelected={areCGUAccepted} onClick={this.toggleCGU}
            type="checkbox" /><br />
          </React.Fragment> : null}
          <Button
            isRound={true} onClick={this.handleSubmit} style={buttonStyle}
            disabled={!this.canSubmit() || isSubmitClicked} isProgressShown={isSubmitClicked}>
            <Trans parent={null}>Commencer le questionnaire</Trans>
          </Button>
        </NoOpElement>
      </Discussion>
    </React.Fragment>
  }
}
const Intro = withTranslation()(IntroBase)


interface IntroSate {
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
(props: RouteComponentProps<{}, StaticContext, IntroSate>): React.ReactElement => {
  const {location} = props

  const dispatch = useDispatch<DispatchAllActions>()
  const handleSubmit = useCallback(
    (canTutoie: boolean, locale: string, name: string): Promise<boolean> => {
      return dispatch(registerNewGuestUser(name, {canTutoie, locale})).
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
  dispatch: PropTypes.func.isRequired,
  location: ReactRouterPropTypes.location.isRequired,
}
const IntroPage = withRouter(React.memo(IntroPageBase))


export {Intro, IntroPage}
