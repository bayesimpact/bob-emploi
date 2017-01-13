import React from 'react'

import {ProfileStepBaseClass, ProfileStep} from 'components/pages/profile/step'
import {CheckboxList, FieldSet} from 'components/theme'


const maybeE = gender => gender === 'FEMININE' ? 'e' : ''


// TODO: Highlight some of the terms according to mocks.
const jobSearchFrustrationOptions = [
  {name: () => "Le manque d'offres correspondant à mes critères", value: 'NO_OFFERS'},
  {name: () => 'Le manque de réponses des recruteurs, même négatives', value: 'NO_OFFER_ANSWERS'},
  {name: () => 'La rédaction des CVs et lettres de motivation', value: 'RESUME'},
  {name: () => "Les entretiens d'embauche", value: 'INTERVIEW'},
  {name: () => 'Le système des formations professionnelles', value: 'TRAINING'},
  {
    name: gender => `La difficulté de rester motivé${maybeE(gender)} dans ma recherche`,
    value: 'MOTIVATION',
  },
  {name: () => 'La gestion de mon temps pour être efficace', value: 'TIME_MANAGEMENT'},
]

const personalFrustrationOptions = [
  {name: () => 'Une situation familiale compliquée', value: 'SINGLE_PARENT'},
  {name: () => 'Le marché du travail non adapté à mon handicap', value: 'HANDICAPED'},
  {name: () => 'Ne pas rentrer dans les cases des recruteurs', value: 'ATYPIC_PROFILE'},
  {name: () => 'Des discriminations liées à mon âge', value: 'AGE_DISCRIMINATION'},
  {name: () => 'Des discriminations liées à mon sexe', value: 'SEX_DISCRIMINATION'},
]


const genderizedOptions = (options, gender) => options.map(
  ({name, value}) => ({name: name(gender), value})).filter(
    ({value}) => (gender === 'FEMININE' || value !== 'SEX_DISCRIMINATION'))


class FrustrationsStep extends ProfileStepBaseClass {
  constructor(props) {
    super({
      fieldnames: {
        frustrations: false,
      },
      ...props,
    })
  }

  render() {
    const {frustrations} = this.state
    const {gender} = this.props.profile
    const genderizedFrustrationOptions = genderizedOptions(
      jobSearchFrustrationOptions.concat(personalFrustrationOptions), gender)
    const explanation = <div>
      Y a-t-il des choses qui vous frustrent dans votre recherche d'emploi ?<br />
      Nous sommes là pour vous écouter et voir si nous pouvons aider.
    </div>
    return <ProfileStep
        title="Vos frustrations"
        explanation={explanation}
        fastForward={this.handleSubmit}
        onNextButtonClick={this.handleSubmit}
        onPreviousButtonClick={this.handleBack}
        {...this.props}>
      <FieldSet>
        <CheckboxList
            options={genderizedFrustrationOptions}
            values={frustrations}
            onChange={this.handleChange('frustrations')} />
      </FieldSet>
    </ProfileStep>
  }
}


export {FrustrationsStep}
