import React from 'react'

import {ProfileStep, ProfileStepBaseClass} from 'components/pages/profile/step'
import {CheckboxList, FieldSet, RadioGroup, Select} from 'components/theme'
import {DrivingLicense} from 'api/job'


const degrees = [
  {name: 'Sans diplôme', value: 'NO_DEGREE'},
  {name: 'CAP - BEP', value: 'CAP_BEP'},
  {name: 'Bac - Bac Pro', value: 'BAC_BACPRO'},
  {name: 'BTS - DUT - DEUG', value: 'BTS_DUT_DEUG'},
  {name: 'Licence - Maîtrise', value: 'LICENCE_MAITRISE'},
  {name: 'DEA - DESS - Master - PhD', value: 'DEA_DESS_MASTER_PHD'},
]

const drivingLicensesOptions = [
  {name: 'Auto', value: 'CAR'},
  {name: 'Moto', value: 'MOTORCYCLE'},
  {name: 'Poids Lourd', value: 'TRUCK'},
]

const levelEstimateOptions = [
  {name: 'Faible', value: 1},
  {name: 'Moyen', value: 2},
  {name: 'Fort', value: 3},
]

class GeneralSkillsStep extends ProfileStepBaseClass {
  static propTypes = {
    drivingLicenses: React.PropTypes.arrayOf(React.PropTypes.oneOf(Object.keys(DrivingLicense))),
    englishLevelEstimate: React.PropTypes.number,
    highestDegree: React.PropTypes.string,
    officeSkillsEstimate: React.PropTypes.number,
  }

  constructor(props) {
    super({
      fieldnames: {
        drivingLicenses: false,
        englishLevelEstimate: true,
        highestDegree: true,
        officeSkillsEstimate: true,
      },
      ...props,
    })
  }

  fastForward = () => {
    if (this.isFormValid()) {
      this.handleSubmit()
      return
    }

    const {drivingLicenses, englishLevelEstimate, highestDegree,
           officeSkillsEstimate} = this.state
    const state = {}
    if (!englishLevelEstimate) {
      state.englishLevelEstimate = 1
    }
    if (!officeSkillsEstimate) {
      state.officeSkillsEstimate = 3
    }
    if (!highestDegree) {
      state.highestDegree = 'LICENCE_MAITRISE'
    }
    if (!(drivingLicenses || []).length) {
      state.drivingLicenses = ['CAR']
    }
    this.setState(state)
  }

  render() {
    const {drivingLicenses, englishLevelEstimate, isValidated, highestDegree,
           officeSkillsEstimate} = this.state
    return <ProfileStep
        title="Vos qualifications"
        fastForward={this.fastForward}
        onNextButtonClick={this.handleSubmit}
        onPreviousButtonClick={this.handleBack}
        {...this.props}>
      <FieldSet label="Plus haut niveau de diplôme obtenu"
                isValid={!!highestDegree} isValidated={isValidated}
                style={{width: 360}}>
        <Select onChange={this.handleChange('highestDegree')} value={highestDegree}
                options={degrees} />
      </FieldSet>
      <FieldSet label="Permis de conduire">
        <CheckboxList
            options={drivingLicensesOptions}
            values={drivingLicenses}
            onChange={this.handleChange('drivingLicenses')}
            style={{display: 'flex', justifyContent: 'space-between'}} />
      </FieldSet>
      <FieldSet
          label="Niveau d'anglais" isValid={!!englishLevelEstimate} isValidated={isValidated}>
        <RadioGroup
            style={{justifyContent: 'space-between'}}
            options={levelEstimateOptions}
            value={englishLevelEstimate}
            onChange={this.handleChange('englishLevelEstimate')} />
      </FieldSet>
      <FieldSet
          label="Niveau en suite bureautique (Word, Excel, …)"
          isValid={!!officeSkillsEstimate} isValidated={isValidated}>
        <RadioGroup
            style={{justifyContent: 'space-between'}}
            options={levelEstimateOptions}
            value={officeSkillsEstimate}
            onChange={this.handleChange('officeSkillsEstimate')} />
      </FieldSet>
    </ProfileStep>
  }
}


export {GeneralSkillsStep}
