import React from 'react'
import PropTypes from 'prop-types'

import {USER_PROFILE_SHAPE} from 'store/user'

import {Step, ProfileUpdater} from 'components/pages/profile/step'
import {Checkbox, CheckboxList, FieldSet, Input} from 'components/theme'


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
]


const genderizedOptions = (options, gender) => options.map(
  ({name, value}) => ({name: name(gender), value})).filter(
  ({value}) => (gender === 'FEMININE' || value !== 'SEX_DISCRIMINATION'))


class FrustrationsStep extends React.Component {
  static propTypes = {
    isShownAsStepsDuringOnboarding: PropTypes.bool,
    profile: USER_PROFILE_SHAPE,
  }

  componentWillMount()  {
    this.updater_ = new ProfileUpdater({
      customFrustrations: false,
      frustrations: false,
    }, this, this.props)
  }

  fastForward = () => {
    if ((this.state.frustrations || []).length) {
      this.updater_.handleSubmit()
      return
    }
    const frustrations = []
    jobSearchFrustrationOptions.concat(personalFrustrationOptions).forEach(frustration => {
      if (Math.random() > .5) {
        frustrations.push(frustration.value)
      }
    })
    this.setState({frustrations})
  }

  handleChangeCustomFrustration = (value, index) => {
    const {customFrustrations} = this.state
    if (index >= (customFrustrations || []).length) {
      this.setState({
        customFrustrations: (customFrustrations || []).concat(value),
      })
      return
    }
    this.setState({
      customFrustrations: customFrustrations.map(
        (oldValue, i) => (i === index) ? value : oldValue),
    })
  }

  removeCustomFrustration = index => {
    const {customFrustrations} = this.state
    if (index >= (customFrustrations || []).length) {
      return
    }
    this.setState({
      customFrustrations: customFrustrations.slice(0, index).
        concat(customFrustrations.slice(index + 1)),
    })
  }

  render() {
    const {isShownAsStepsDuringOnboarding, profile} = this.props
    const {customFrustrations, frustrations} = this.state
    const {gender} = profile
    const genderizedFrustrationOptions = genderizedOptions(
      jobSearchFrustrationOptions.concat(personalFrustrationOptions), gender)
    const explanation = <div>
      Nous sommes là pour vous écouter et pour vous aider en fonction de vos
      besoins.
    </div>
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
    const customFrustrationsPlusOne = (customFrustrations || []).some(f => !f) ?
      customFrustrations : (customFrustrations || []).concat([''])
    return <Step
      title={isShownAsStepsDuringOnboarding ?
        "Qu'est ce qui vous bloque dans votre recherche ?" :
        'Ce qui vous bloque dans votre recherche'}
      explanation={explanation}
      fastForward={this.fastForward}
      onNextButtonClick={this.updater_.handleSubmit}
      onPreviousButtonClick={this.updater_.handleBack}
      {...this.props}>
      <FieldSet isInline={true}>
        <CheckboxList
          options={genderizedFrustrationOptions}
          values={frustrations}
          onChange={this.updater_.handleChange('frustrations')} />
      </FieldSet>
      {customFrustrationsPlusOne.map((frustration, index) => <div
        key={`custom-frustration-${index}`} style={customFrustrationStyle}>
        <Checkbox
          isSelected={!!frustration}
          onClick={() => frustration && this.removeCustomFrustration(index)} />
        <Input
          value={frustration} style={inputStyle} placeholder="Autre…"
          onChange={value => this.handleChangeCustomFrustration(value, index)}
          onBlur={() => frustration || this.removeCustomFrustration(index)} />
      </div>)}
    </Step>
  }
}


export {FrustrationsStep}
