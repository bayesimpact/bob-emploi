import React from 'react'
import PropTypes from 'prop-types'

import {Checkbox, Input} from 'components/theme'
import {CheckboxList, FieldSet} from 'components/pages/connected/form_utils'

import {Step, ProfileUpdater} from './step'

const maybeE = gender => gender === 'FEMININE' ? 'e' : ''
// This is a stunt to acknowledge that we do not name what could be a named
// React component (an alternative would be to systimatically disable the
// react/display-name rule).
const unnamedComponent = c => c


const jobSearchFrustrationOptions = [
  {
    name: () => unnamedComponent(<span>
      Le <strong>manque d'offres</strong>, correspondant à mes critères
    </span>),
    value: 'NO_OFFERS',
  },
  {
    name: () => unnamedComponent(<span>
      Le <strong>manque de réponses</strong> des recruteurs, même négatives
    </span>),
    value: 'NO_OFFER_ANSWERS',
  },
  {
    name: () => unnamedComponent(<span>
      La rédaction des <strong>CVs</strong> et <strong>lettres de motivation</strong>
    </span>),
    value: 'RESUME',
  },
  {
    name: () => unnamedComponent(<span>Les <strong>entretiens</strong> d'embauche</span>),
    value: 'INTERVIEW',
  },
  {
    name: () => unnamedComponent(<span>
      Le système des <strong>formations</strong> professionnelles
    </span>),
    value: 'TRAINING',
  },
  {
    name: gender => unnamedComponent(<span>
      La difficulté de <strong>rester motivé{maybeE(gender)}</strong> dans ma recherche
    </span>),
    value: 'MOTIVATION',
  },
  {
    name: () => unnamedComponent(<span>
      Le manque de <strong>confiance en moi</strong>
    </span>),
    value: 'SELF_CONFIDENCE',
  },
  {
    name: () => unnamedComponent(<span>
      La gestion de mon temps pour être <strong>efficace</strong>
    </span>),
    value: 'TIME_MANAGEMENT',
  },
  {
    name: () => unnamedComponent(<span>
      L'<strong>expérience demandée</strong> pour le poste
    </span>),
    value: 'EXPERIENCE',
  },
]

const personalFrustrationOptions = [
  {
    name: () => unnamedComponent(<span>
      <strong>Ne pas rentrer dans les cases</strong> des recruteurs
    </span>),
    value: 'ATYPIC_PROFILE',
  },
  {
    name: () => unnamedComponent(<span>
      Des discriminations liées à mon <strong>âge</strong>
    </span>),
    value: 'AGE_DISCRIMINATION',
  },
  {
    name: () => unnamedComponent(<span>
      Des discriminations liées à mon <strong>sexe</strong>
    </span>),
    value: 'SEX_DISCRIMINATION',
  },
  {
    name: () => unnamedComponent(<span>
      L'interruption de ma carrière pour <strong>élever mes enfants</strong>.
    </span>),
    value: 'STAY_AT_HOME_PARENT',
  },
]


const isPotentialLongTermMom = ({familySituation, gender}) => gender === 'FEMININE' &&
  new Set(['SINGLE_PARENT_SITUATION', 'FAMILY_WITH_KIDS']).has(familySituation)


const genderizedOptions = (options, profile) => options.map(
  ({name, value}) => ({name: name(profile.gender), value})).filter(
  ({value}) => (profile.gender === 'FEMININE' || value !== 'SEX_DISCRIMINATION') && (
    isPotentialLongTermMom(profile) || value !== 'STAY_AT_HOME_PARENT'))


const frustrationsUpdater = new ProfileUpdater({
  customFrustrations: false,
  frustrations: false,
})


class CustomFrustration extends React.Component {
  static propTypes = {
    onChange: PropTypes.func,
    onRemove: PropTypes.func,
    value: PropTypes.string,
  }

  state = {
    isSelected: !!this.props.value,
  }

  removeEmpty = () => {
    const {onRemove} = this.props
    if (!this.state.isSelected) {
      onRemove && onRemove()
    }
  }

  render() {
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
        onClick={isSelected ? onRemove : null} />
      <Input
        value={value} style={inputStyle} placeholder="Autre…" onChangeDelayMillisecs={1000}
        onEdit={v => isSelected === !v && this.setState({isSelected: !!v})}
        onChange={onChange} onBlur={this.removeEmpty} />
    </div>
  }
}


class FrustrationsStep extends React.Component {
  static propTypes = {
    isShownAsStepsDuringOnboarding: PropTypes.bool,
    profile: PropTypes.shape({
      customFrustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
      frustrations: PropTypes.arrayOf(PropTypes.string.isRequired),
      gender: PropTypes.string,
    }),
    userYou: PropTypes.func.isRequired,
  }

  state = {
    maybeShownCustomFrustrations: (this.props.profile.customFrustrations || []).
      map(value => ({isShown: true, value})),
  }

  updater_ = frustrationsUpdater.attachToComponent(this)

  fastForward = () => {
    if ((this.props.profile.frustrations || []).length) {
      this.updater_.handleSubmit()
      return
    }
    const frustrations = []
    jobSearchFrustrationOptions.concat(personalFrustrationOptions).forEach(frustration => {
      if (Math.random() > .5) {
        frustrations.push(frustration.value)
      }
    })
    this.updater_.handleChange('frustrations')(frustrations)
  }

  customFrustrations = () => {
    return this.state.maybeShownCustomFrustrations.
      filter(({isShown, value}) => isShown && value).map(({value}) => value)
  }

  handleChangeCustomFrustration = index => value => {
    const {maybeShownCustomFrustrations = []} = this.state
    const newMaybeShownCustomFrustrations = index >= maybeShownCustomFrustrations.length ?
      maybeShownCustomFrustrations.concat({isShown: true, value}) :
      maybeShownCustomFrustrations.
        map(({isShown, value: oldValue}, i) => ({isShown, value: (i === index) ? value : oldValue}))
    this.setState(
      {maybeShownCustomFrustrations: newMaybeShownCustomFrustrations},
      () => this.updater_.handleChange('customFrustrations')(this.customFrustrations()))
  }

  handleRemoveCustomFrustration = index => () => {
    const {maybeShownCustomFrustrations = []} = this.state
    if (index >= maybeShownCustomFrustrations.length) {
      return
    }
    maybeShownCustomFrustrations[index].isShown = false
    this.setState({maybeShownCustomFrustrations}, () =>
      this.updater_.handleChange('customFrustrations')(this.customFrustrations()))
  }

  render() {
    const {maybeShownCustomFrustrations = []} = this.state
    const {isShownAsStepsDuringOnboarding, profile, userYou} = this.props
    const {frustrations} = profile
    const genderizedFrustrationOptions = genderizedOptions(
      jobSearchFrustrationOptions.concat(personalFrustrationOptions), profile)
    const explanation = <div>
      Nous sommes là pour {userYou("t'", 'vous ')}écouter et pour {userYou("t'", 'vous ')}aider en
      fonction de {userYou('tes', 'vos')} besoins.
    </div>
    const maybeShownCustomFrustrationsPlusOne = maybeShownCustomFrustrations.
      some(({isShown, value}) => isShown && !value) ? maybeShownCustomFrustrations :
      maybeShownCustomFrustrations.concat([{isShown: true, value: ''}])
    return <Step
      title={isShownAsStepsDuringOnboarding ?
        `${userYou('Tes', 'Vos')} éventuelles difficultés` :
        `Ce qui ${userYou('te', 'vous')} bloque dans ${userYou('ta', 'votre')} recherche`}
      explanation={explanation}
      fastForward={this.fastForward}
      onNextButtonClick={this.updater_.handleSubmit}
      onPreviousButtonClick={this.updater_.getBackHandler()}
      {...this.props}>
      <FieldSet isInline={true}>
        <CheckboxList
          options={genderizedFrustrationOptions}
          values={frustrations}
          onChange={this.updater_.handleChange('frustrations')} />
      </FieldSet>
      {maybeShownCustomFrustrationsPlusOne.map(({isShown, value}, index) =>
        isShown ? <CustomFrustration
          key={index} value={value}
          onChange={this.handleChangeCustomFrustration(index)}
          onRemove={this.handleRemoveCustomFrustration(index)} /> : null)}
    </Step>
  }
}


export {FrustrationsStep}
