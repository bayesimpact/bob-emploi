import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps, StaticContext, withRouter} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import {inDepartement, lowerFirstLetter} from 'store/french'
import {DispatchAllActions, registerNewGuestUser} from 'store/actions'

import {FastForward} from 'components/fast_forward'
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

  private handleSubmit = (e): void => {
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
        Valider
      </Button>
    </form>
  }
}


const tutoiementOptions = [
  {name: 'oui, pourquoi pas', value: true},
  {name: 'non, je ne préfère pas', value: false},
]


interface IntroProps {
  city?: bayes.bob.FrenchCity
  job?: bayes.bob.Job
  name?: string
  onSubmit: (canTutoie: boolean, name: string) => Promise<boolean>
  stats?: bayes.bob.LaborStatsData
}


interface IntroState {
  areCGUAccepted?: boolean
  canTutoie?: boolean
  isFastForwarded?: boolean
  isGuest?: boolean
  isSubmitClicked?: boolean
  newName?: string
}


class Intro extends React.PureComponent<IntroProps, IntroState> {
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
  }

  public state: IntroState = {
    areCGUAccepted: !!this.props.name,
    isGuest: !this.props.name,
    isSubmitClicked: false,
  }

  public componentWillUnmount(): void {
    this.isUnmounted = true
  }

  private isUnmounted = false

  private tutoieRadioGroup: React.RefObject<RadioGroup<boolean>> = React.createRef()

  private cguRef: React.RefObject<LabeledToggle> = React.createRef()

  private toggleCGU = (): void => {
    this.setState(({areCGUAccepted}: IntroState): IntroState => ({areCGUAccepted: !areCGUAccepted}))
  }

  private canSubmit = (): boolean => {
    const {areCGUAccepted, canTutoie, isGuest, newName} = this.state
    const finalName = isGuest ? newName : this.props.name
    return !!(areCGUAccepted && finalName && typeof canTutoie === 'boolean')
  }

  private handleChangeTutoiement = (canTutoie): void => this.setState({canTutoie})

  private handleSubmit = (): void => {
    const {canTutoie, isGuest, newName} = this.state
    const {name, onSubmit} = this.props
    const finalName = isGuest ? newName : name
    if (this.canSubmit() && finalName) {
      this.setState({isSubmitClicked: true})
      onSubmit(!!canTutoie, finalName).then((): void => {
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

  private updateName = (newName: string): void => this.setState({newName})

  private onFastForward = (): void => {
    const {areCGUAccepted, canTutoie, isFastForwarded, isGuest, newName} = this.state
    if (!isFastForwarded) {
      this.setState({isFastForwarded: true})
      return
    }
    if (isGuest && !newName) {
      this.setState({newName: 'Angèle'})
      return
    }
    if (typeof canTutoie !== 'boolean') {
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
    } = this.props
    const {areCGUAccepted, canTutoie, isGuest, isSubmitClicked, newName} = this.state
    const userYou = (tu: string, vous: string): string => canTutoie ? tu : vous
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
    // TODO(pascal): Use stats props if it's set.
    return <React.Fragment>
      <FastForward onForward={this.onFastForward} />
      <Discussion
        style={discussionStyle} isFastForwarded={this.state.isFastForwarded}>
        <DiscussionBubble>
          {isCompetitionShown && city ? <BubbleToRead>
            Le saviez-vous&nbsp;?! La concurrence
            en {lowerFirstLetter(jobGroupName)} {inDepartement(city)} est {isToughCompetition ?
              'rude' : 'faible'},{' '}
            <strong>
              {yearlyAvgOffersPer10Candidates}{' '}
              offre{yearlyAvgOffersPer10Candidates > 1 ? 's' : null} pour 10 candidats
            </strong>.
          </BubbleToRead> : null}
          {isCompetitionShown ? <BubbleToRead>
            {isToughCompetition ?
              "Ce n'est pas simple mais vous pouvez y arriver." :
              "C'est une très bonne nouvelle\u00A0!"}
          </BubbleToRead> : null}
          <BubbleToRead>Bienvenue{isGuest ? null : <strong> {name}</strong>}&nbsp;!</BubbleToRead>
          <BubbleToRead>
            Je suis <strong style={boldStyle}>{config.productName}</strong>, votre assistant
            personnel pour accélérer votre recherche.
          </BubbleToRead>
          <BubbleToRead>
            Je vais vous accompagner tout au long de votre projet et vous aider à le réaliser au
            plus vite.
          </BubbleToRead>
          <BubbleToRead>
            Mais avant de commencer, {isGuest ? 'comment vous appelez-vous' : 'peut-on se tutoyer'}
            &nbsp;?
          </BubbleToRead>
        </DiscussionBubble>
        {isGuest ? <QuestionBubble isDone={!!newName}>
          <ValidateInput
            defaultValue={name || newName} onChange={this.updateName}
            placeholder="Tapez votre prénom"
            style={{marginBottom: 5, marginTop: 15}} shouldFocusOnMount={true} />
        </QuestionBubble> : null}
        {isGuest ? <BubbleToRead>
          Enchanté, {newName}&nbsp;! Peut-on se tutoyer&nbsp;?
        </BubbleToRead> : null}
        <QuestionBubble
          isDone={typeof canTutoie === 'boolean'}
          onShown={this.handleTutoieQuestionIsShown}>
          <RadioGroup
            style={{justifyContent: 'space-between', margin: 20}}
            ref={this.tutoieRadioGroup}
            onChange={this.handleChangeTutoiement}
            options={tutoiementOptions} value={canTutoie} />
        </QuestionBubble>
        <DiscussionBubble>
          <BubbleToRead>
            Parfait, c'est noté.
          </BubbleToRead>
          <BubbleToRead>
            Pour évaluer {userYou('ton', 'votre')} projet je vais avoir besoin
            de {userYou('te', 'vous')} poser quelques questions rapides.
          </BubbleToRead>
          <BubbleToRead>
            {userYou('Ça', 'Cela')} ne prendra qu'entre <strong style={boldStyle}>2</strong> et
            <strong style={boldStyle}> 5 minutes</strong> et me permettra de bien
            cerner {userYou('tes', 'vos')} besoins.
          </BubbleToRead>
          <BubbleToRead>
            On commence&nbsp;?
          </BubbleToRead>
        </DiscussionBubble>
        <NoOpElement
          style={{margin: '20px auto 0', textAlign: 'center'}}
          onShown={this.handleFinalGroupIsShown}>
          {isGuest ? <React.Fragment>
            <LabeledToggle ref={this.cguRef} label={<React.Fragment>
              J'ai lu et j'accepte
              les <ExternalLink href={Routes.TERMS_AND_CONDITIONS_PAGE} style={linkStyle}>
                CGU
              </ExternalLink>
            </React.Fragment>} isSelected={areCGUAccepted} onClick={this.toggleCGU}
            type="checkbox" /><br />
          </React.Fragment> : null}
          <Button
            isRound={true} onClick={this.handleSubmit} style={buttonStyle}
            disabled={!this.canSubmit() || isSubmitClicked} isProgressShown={isSubmitClicked}>
            Commencer le questionnaire
          </Button>
        </NoOpElement>
      </Discussion>
    </React.Fragment>
  }
}


interface IntroPageProps {
  dispatch: DispatchAllActions
}

interface IntroSate {
  city?: bayes.bob.FrenchCity
  job?: bayes.bob.Job
  stats?: bayes.bob.LaborStatsData
}


class IntroPageBase
  extends React.PureComponent<IntroPageProps & RouteComponentProps<{}, StaticContext, IntroSate>> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    location: ReactRouterPropTypes.location.isRequired,
  }

  private handleSubmit = (canTutoie: boolean, name: string): Promise<boolean> => {
    return this.props.dispatch(registerNewGuestUser(name, {canTutoie})).
      then((response): boolean => !!response)
  }

  public render(): React.ReactNode {
    const {city = undefined, job = undefined, stats = undefined} = this.props.location.state || {}
    const pageStyle: React.CSSProperties = {
      alignItems: 'flex-end',
      backgroundColor: '#fff',
      display: 'flex',
      justifyContent: 'center',
      padding: '0 20px',
    }
    return <PageWithNavigationBar page="intro" style={pageStyle} areNavLinksShown={false}>
      <div style={{maxWidth: 440}}>
        <Intro onSubmit={this.handleSubmit} {...{city, job, stats}} />
      </div>
    </PageWithNavigationBar>
  }
}
const IntroPage = withRouter(connect()(IntroPageBase))


export {Intro, IntroPage}
