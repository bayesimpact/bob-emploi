import _memoize from 'lodash/memoize'
import React from 'react'
import PropTypes from 'prop-types'

import {Checkbox, Input} from 'components/theme'
import {CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {ProfileStepProps, ProfileUpdater, Step} from './step'

const maybeE = (gender: 'FEMININE' | 'MASCULINE'): string => gender === 'FEMININE' ? 'e' : ''
// This is a stunt to acknowledge that we do not name what could be a named
// React component (an alternative would be to systimatically disable the
// react/display-name rule).
const unnamedComponent = (c): React.ReactNode => c


const jobSearchFrustrationOptions = [
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Le <strong>manque d'offres</strong>, correspondant à mes critères
    </span>),
    value: 'NO_OFFERS',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Le <strong>manque de réponses</strong> des recruteurs, même négatives
    </span>),
    value: 'NO_OFFER_ANSWERS',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      La rédaction des <strong>CVs</strong> et <strong>lettres de motivation</strong>
    </span>),
    value: 'RESUME',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Les <strong>entretiens</strong> d'embauche
    </span>),
    value: 'INTERVIEW',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Le système des <strong>formations</strong> professionnelles
    </span>),
    value: 'TRAINING',
  },
  {
    name: (gender): React.ReactNode => unnamedComponent(<span>
      La difficulté de <strong>rester motivé{maybeE(gender)}</strong> dans ma recherche
    </span>),
    value: 'MOTIVATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Le manque de <strong>confiance en moi</strong>
    </span>),
    value: 'SELF_CONFIDENCE',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      La gestion de mon temps pour être <strong>efficace</strong>
    </span>),
    value: 'TIME_MANAGEMENT',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      L'<strong>expérience demandée</strong> pour le poste
    </span>),
    value: 'EXPERIENCE',
  },
]

const personalFrustrationOptions = [
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      <strong>Ne pas rentrer dans les cases</strong> des recruteurs
    </span>),
    value: 'ATYPIC_PROFILE',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Des discriminations liées à mon <strong>âge</strong>
    </span>),
    value: 'AGE_DISCRIMINATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      Des discriminations liées à mon <strong>sexe</strong>
    </span>),
    value: 'SEX_DISCRIMINATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<span>
      L'interruption de ma carrière pour <strong>élever mes enfants</strong>.
    </span>),
    value: 'STAY_AT_HOME_PARENT',
  },
]


const isPotentialLongTermMom = ({familySituation, gender}): boolean => gender === 'FEMININE' &&
  new Set(['SINGLE_PARENT_SITUATION', 'FAMILY_WITH_KIDS']).has(familySituation)



interface SelectOption {
  name: React.ReactNode
  value: string
}


interface GenderizableSelectOption {
  name: (gender: 'FEMININE' | 'MASCULINE') => React.ReactNode
  value: string
}


const genderizedOptions = (options, profile): SelectOption[] => options.map(
  ({name, value}: GenderizableSelectOption): SelectOption => ({name: name(profile.gender), value})).
  filter(({value}): boolean =>
    (profile.gender === 'FEMININE' || value !== 'SEX_DISCRIMINATION') &&
      (isPotentialLongTermMom(profile) || value !== 'STAY_AT_HOME_PARENT'))


const frustrationsUpdater = new ProfileUpdater({
  customFrustrations: false,
  frustrations: false,
})


interface CustomFrustrationProps {
  onChange?: (value: string) => void
  onRemove?: () => void
  value?: string
}


interface SelectState {
  isSelected: boolean
}


class CustomFrustration extends React.PureComponent<CustomFrustrationProps, SelectState> {
  public static propTypes = {
    onChange: PropTypes.func,
    onRemove: PropTypes.func,
    value: PropTypes.string,
  }

  public state = {
    isSelected: !!this.props.value,
  }

  private handleEditValue = _memoize((isSelected: boolean): ((v: string) => void) =>
    (v: string): void => {
      isSelected === !v && this.setState({isSelected: !!v})
    })

  private removeEmpty = (): void => {
    const {onRemove} = this.props
    if (!this.state.isSelected) {
      onRemove && onRemove()
    }
  }

  public render(): React.ReactNode {
    const {onChange, onRemove, value} = this.props
    const {isSelected} = this.state
    const customFrustrationStyle = {
      alignItems: 'center',
      display: 'flex',
      marginBottom: 10,
      width: '100%',
    }
    const inputStyle = {
      flex: 1,
      height: 35,
      marginLeft: 10,
      width: 'initial',
    }
    return <div style={customFrustrationStyle}>
      <Checkbox
        isSelected={isSelected}
        onClick={isSelected ? onRemove : undefined} />
      <Input
        value={value} style={inputStyle} placeholder="Autre…" onChangeDelayMillisecs={1000}
        onEdit={this.handleEditValue(isSelected)}
        onChange={onChange} onBlur={this.removeEmpty} />
    </div>
  }
}


interface MaybeShownFrustration {
  isShown: boolean
  value: string
}


interface StepState {
  maybeShownCustomFrustrations: MaybeShownFrustration[]
}


class FrustrationsStep extends React.PureComponent<ProfileStepProps, StepState> {
  public static propTypes = {
    isShownAsStepsDuringOnboarding: PropTypes.bool,
    profile: PropTypes.shape({
      customFrustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
      frustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
      gender: PropTypes.string,
    }),
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    maybeShownCustomFrustrations: (this.props.profile.customFrustrations || []).
      map((value: string): MaybeShownFrustration => ({isShown: true, value})),
  }

  private updater_ = frustrationsUpdater.attachToComponent(this)

  private fastForward = (): void => {
    if ((this.props.profile.frustrations || []).length) {
      this.updater_.handleSubmit()
      return
    }
    const frustrations: string[] = []
    jobSearchFrustrationOptions.concat(personalFrustrationOptions).forEach(
      (frustration): void => {
        if (Math.random() > .5) {
          frustrations.push(frustration.value)
        }
      })
    this.updater_.handleChange('frustrations')(frustrations)
  }

  private customFrustrations = (): string[] => {
    return this.state.maybeShownCustomFrustrations.
      filter(({isShown, value}): boolean => isShown && !!value).map(({value}): string => value)
  }

  private handleChangeCustomFrustration = _memoize((index: number): ((value: string) => void) =>
    (value: string): void => {
      const {maybeShownCustomFrustrations = []} = this.state
      const newMaybeShownCustomFrustrations = index >= maybeShownCustomFrustrations.length ?
        maybeShownCustomFrustrations.concat({isShown: true, value}) :
        maybeShownCustomFrustrations.
          map(({isShown, value: oldValue}, i): MaybeShownFrustration =>
            ({isShown, value: (i === index) ? value : oldValue}))
      this.setState(
        {maybeShownCustomFrustrations: newMaybeShownCustomFrustrations},
        (): void => this.updater_.handleChange('customFrustrations')(this.customFrustrations()))
    })

  private handleRemoveCustomFrustration = _memoize((index: number): (() => void) => (): void => {
    const {maybeShownCustomFrustrations = []} = this.state
    if (index >= maybeShownCustomFrustrations.length) {
      return
    }
    maybeShownCustomFrustrations[index].isShown = false
    this.setState({maybeShownCustomFrustrations}, (): void =>
      this.updater_.handleChange('customFrustrations')(this.customFrustrations()))
  })

  public render(): React.ReactNode {
    const {maybeShownCustomFrustrations = []} = this.state
    const {isShownAsStepsDuringOnboarding, profile, userYou} = this.props
    const {frustrations} = profile
    const genderizedFrustrationOptions = genderizedOptions(
      jobSearchFrustrationOptions.concat(personalFrustrationOptions), profile)
    const explanation = isShownAsStepsDuringOnboarding ? <div>
      Y a-t-il des choses qui {userYou('te', 'vous')} bloquent
      dans {userYou('ta', 'votre')} recherche d'emploi&nbsp;?<br />
    </div> : null
    const maybeShownCustomFrustrationsPlusOne = maybeShownCustomFrustrations.
      some(({isShown, value}): boolean => isShown && !value) ? maybeShownCustomFrustrations :
      maybeShownCustomFrustrations.concat([{isShown: true, value: ''}])
    const label = isShownAsStepsDuringOnboarding ? '' :
      `Éléments bloquants de ${userYou('ta', 'votre')} recherche`
    return <Step
      title={`${userYou('Tes', 'Vos')} éventuelles difficultés`}
      explanation={explanation}
      fastForward={this.fastForward}
      onNextButtonClick={this.updater_.handleSubmit}
      onPreviousButtonClick={this.updater_.getBackHandler()}
      {...this.props}>
      <FieldSet isInline={isShownAsStepsDuringOnboarding} label={label}>
        <CheckboxList
          options={genderizedFrustrationOptions}
          values={frustrations}
          onChange={this.updater_.handleChange('frustrations')} />
      </FieldSet>
      {maybeShownCustomFrustrationsPlusOne.map(({isShown, value}, index): React.ReactNode =>
        isShown ? <CustomFrustration
          key={index} value={value}
          onChange={this.handleChangeCustomFrustration(index)}
          onRemove={this.handleRemoveCustomFrustration(index)} /> : null)}
    </Step>
  }
}


export {FrustrationsStep}
