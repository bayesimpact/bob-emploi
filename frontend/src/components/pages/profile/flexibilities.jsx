import React from 'react'
import _ from 'underscore'

import {ProfileStepBaseClass, ProfileStep} from 'components/pages/profile/step'
import {Colors, FieldSet, RadioGroup} from 'components/theme'


const flexibilityOptions = [
  {name: 'Oui', value: 'YES'},
  {name: 'Non', value: 'ABSOLUTELY_NOT'},
  {name: 'À la limite', value: 'IF_NEEDED'},
]

const flexibilities = [
  {
    fieldName: 'trainingFlexibility',
    label: 'Vous former (études, permis, langues…) ?',
  },
  {
    fieldName: 'salaryRequirementFlexibility',
    label: 'Accepter un salaire moins élevé ?',
  },
  {
    fieldName: 'contractTypeFlexibility',
    label: "Considérer d'autres contrats (CDD, intérim…) ?",
  },
  {
    fieldName: 'geographicalFlexibility',
    label: 'Déménager là où il y a plus de travail ?',
  },
  {
    fieldName: 'professionalFlexibility',
    label: 'Changer de métier ?',
  },
]
const fieldNames = flexibilities.map(flex => flex.fieldName)


class FlexibilitiesStep extends ProfileStepBaseClass {
  static propTypes = {
    isShownAsStepsDuringOnboarding: React.PropTypes.bool,
  }

  constructor(props) {
    super({
      fieldnames: {
        contractTypeFlexibility: true,
        geographicalFlexibility: true,
        professionalFlexibility: true,
        salaryRequirementFlexibility: true,
        trainingFlexibility: true,
      },
      ...props,
    })
  }

  fastForward = () => {
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }
    const state = {}
    fieldNames.forEach(fieldName => {
      if (!this.state[fieldName]) {
        state[fieldName] = _.sample(flexibilityOptions).value
      }
    })
    this.setState(state)
  }

  render() {
    const {isShownAsStepsDuringOnboarding} = this.props
    const {gender} = this.props.profile
    const {isHoveredIndex, isValidated} = this.state
    const genderE = gender === 'FEMININE' ? 'e' : ''
    const explanation = <div>
      Ces questions vont nous permettre de faire des recommandations qui respectent vos
      préférences. <br />
      Si cela vous était utile pour trouver un emploi, seriez-vous prêt{genderE} à :
    </div>
    const separatorStyle = {
      backgroundColor: Colors.SILVER,
      border: 'none',
      height: 1,
      margin: '0 24px',
    }
    return <ProfileStep
        title={'Vos critères' + (isShownAsStepsDuringOnboarding ?' (presque fini !)' : '')}
        explanation={explanation}
        fastForward={this.fastForward}
        onNextButtonClick={this.handleSubmit}
        onPreviousButtonClick={this.handleBack}
        contentStyle={{alignSelf: 'stretch'}}
        {...this.props}  >
      <div
          style={{display: 'flex', flexDirection: 'column', fontSize: 15, padding: '0 60px'}}
          onMouseOut={() => this.setState({isHoveredIndex: null})}>
        {flexibilities.map((flexibility, i) => {
          const value = this.state[flexibility.fieldName]
          const isSeparatorHidden = (
            i >= flexibilities.length || isHoveredIndex === i || isHoveredIndex === i + 1)
          return <div key={flexibility.fieldName}>
            <FlexibilityRow
                flexibility={flexibility}
                value={value}
                isValidated={isValidated}
                isHovered={isHoveredIndex === i}
                onChange={this.handleChange(flexibility.fieldName)}
                onMouseOver={() => this.setState({isHoveredIndex: i})} />
            <div style={{...separatorStyle, visibility: isSeparatorHidden ? 'hidden': 'visible'}} />
          </div>
        })}
      </div>
    </ProfileStep>
  }
}


class FlexibilityRow extends React.Component {
  static propTypes = {
    flexibility: React.PropTypes.object.isRequired,
    isHovered: React.PropTypes.bool,
    isValidated: React.PropTypes.bool,
    onChange: React.PropTypes.func.isRequired,
    style: React.PropTypes.object,
    value: React.PropTypes.string,
  }

  render() {
    const {flexibility, isHovered, isValidated, style, value, onChange, ...otherProps} = this.props
    const containerStyle = {
      backgroundColor: isHovered ? Colors.BACKGROUND_GREY : 'inherit',
      display: 'flex',
      padding: '20px 24px',
      ...style,
    }
    return <div {...otherProps} style={containerStyle}>
      <FieldSet
          isInline={true}
          label={flexibility.label}
          isValid={!!value} isValidated={isValidated}
          style={{flex: 1}}>
      </FieldSet>
      <RadioGroup
          style={{justifyContent: 'space-between', width: 250}}
          value={value} options={flexibilityOptions}
          onChange={onChange} />
    </div>
  }
}


export {FlexibilitiesStep}
