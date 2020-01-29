import {TFunction} from 'i18next'
import _memoize from 'lodash/memoize'
import React, {useCallback, useState} from 'react'
import PropTypes from 'prop-types'

import {Trans} from 'components/i18n'
import {Checkbox, Input} from 'components/theme'
import {CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {ProfileStepProps, ProfileUpdater, Step} from './step'

// This is a stunt to acknowledge that we do not name what could be a named
// React component (an alternative would be to systimatically disable the
// react/display-name rule).
const unnamedComponent = (c: React.ReactNode): React.ReactNode => c


const jobSearchFrustrationOptions = [
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le <strong>manque d'offres</strong>, correspondant à mes critères
    </Trans>),
    value: 'NO_OFFERS',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le <strong>manque de réponses</strong> des recruteurs, même négatives
    </Trans>),
    value: 'NO_OFFER_ANSWERS',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      La rédaction des <strong>CVs</strong> et <strong>lettres de motivation</strong>
    </Trans>),
    value: 'RESUME',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Les <strong>entretiens</strong> d'embauche
    </Trans>),
    value: 'INTERVIEW',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le système des <strong>formations</strong> professionnelles
    </Trans>),
    value: 'TRAINING',
  },
  {
    name: (gender?: bayes.bob.Gender): React.ReactNode => unnamedComponent(<Trans
      parent="span" tOptions={{context: gender}}>
      La difficulté de <strong>rester motivé·e</strong> dans ma recherche
    </Trans>),
    value: 'MOTIVATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Le manque de <strong>confiance en moi</strong>
    </Trans>),
    value: 'SELF_CONFIDENCE',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      La gestion de mon temps pour être <strong>efficace</strong>
    </Trans>),
    value: 'TIME_MANAGEMENT',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      L'<strong>expérience demandée</strong> pour le poste
    </Trans>),
    value: 'EXPERIENCE',
  },
]

const personalFrustrationOptions = [
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      <strong>Ne pas rentrer dans les cases</strong> des recruteurs
    </Trans>),
    value: 'ATYPIC_PROFILE',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Des discriminations liées à mon <strong>âge</strong>
    </Trans>),
    value: 'AGE_DISCRIMINATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      Des discriminations liées à mon <strong>sexe</strong>
    </Trans>),
    value: 'SEX_DISCRIMINATION',
  },
  {
    name: (): React.ReactNode => unnamedComponent(<Trans parent="span">
      L'interruption de ma carrière pour <strong>élever mes enfants</strong>.
    </Trans>),
    value: 'STAY_AT_HOME_PARENT',
  },
]


const parentSituation: Set<bayes.bob.FamilySituation> =
  new Set(['SINGLE_PARENT_SITUATION', 'FAMILY_WITH_KIDS'])
const isPotentialLongTermMom = ({familySituation, gender}: bayes.bob.UserProfile): boolean =>
  gender === 'FEMININE' && !!familySituation && parentSituation.has(familySituation)



interface SelectOption {
  name: React.ReactNode
  value: string
}


interface GenderizableSelectOption {
  name: (gender?: bayes.bob.Gender) => React.ReactNode
  value: string
}


const genderizedOptions =
  (options: readonly GenderizableSelectOption[], profile: bayes.bob.UserProfile):
  readonly SelectOption[] =>
    options.map(
      ({name, value}: GenderizableSelectOption): SelectOption =>
        ({name: name(profile.gender), value})).
      filter(({value}: SelectOption): boolean =>
        (profile.gender === 'FEMININE' || value !== 'SEX_DISCRIMINATION') &&
        (isPotentialLongTermMom(profile) || value !== 'STAY_AT_HOME_PARENT'))


const frustrationsUpdater = new ProfileUpdater({
  customFrustrations: false,
  frustrations: false,
})


interface CustomFrustrationProps {
  onChange?: (value: string) => void
  onRemove?: () => void
  t: TFunction
  value?: string
}


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


const CustomFrustrationBase = (props: CustomFrustrationProps): React.ReactElement => {
  const {onChange, onRemove, t, value} = props
  const [isSelected, setIsSelected] = useState(!!value)
  const handleEditValue = useCallback((v: string): void => {
    isSelected === !v && setIsSelected(!!v)
  }, [isSelected])

  const removeEmpty = useCallback((): void => {
    if (!isSelected) {
      onRemove && onRemove()
    }
  }, [isSelected, onRemove])

  return <div style={customFrustrationStyle}>
    <Checkbox
      isSelected={isSelected}
      onClick={isSelected ? onRemove : undefined} />
    <Input
      value={value} style={inputStyle}
      placeholder={t('Autre…')} onChangeDelayMillisecs={1000}
      onEdit={handleEditValue}
      onChange={onChange} onBlur={removeEmpty} />
  </div>
}
CustomFrustrationBase.propTypes = {
  onChange: PropTypes.func,
  onRemove: PropTypes.func,
  t: PropTypes.func.isRequired,
  value: PropTypes.string,
}
const CustomFrustration = React.memo(CustomFrustrationBase)


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
    t: PropTypes.func.isRequired,
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
    const {isShownAsStepsDuringOnboarding, profile, t} = this.props
    const {frustrations} = profile
    const genderizedFrustrationOptions = genderizedOptions(
      jobSearchFrustrationOptions.concat(personalFrustrationOptions), profile)
    const explanation = isShownAsStepsDuringOnboarding ? <Trans>
      Y a-t-il des choses qui vous bloquent dans votre recherche d'emploi&nbsp;?<br />
    </Trans> : null
    const maybeShownCustomFrustrationsPlusOne = maybeShownCustomFrustrations.
      some(({isShown, value}): boolean => isShown && !value) ? maybeShownCustomFrustrations :
      maybeShownCustomFrustrations.concat([{isShown: true, value: ''}])
    const label = isShownAsStepsDuringOnboarding ? '' : t('Éléments bloquants de votre recherche')
    return <Step
      title={t('Vos éventuelles difficultés')}
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
          key={index} value={value} t={t}
          onChange={this.handleChangeCustomFrustration(index)}
          onRemove={this.handleRemoveCustomFrustration(index)} /> : null)}
    </Step>
  }
}


export {FrustrationsStep}
