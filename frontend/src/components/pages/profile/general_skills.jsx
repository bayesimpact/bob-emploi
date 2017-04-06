import React from 'react'

import {ProfileUpdater, Step} from 'components/pages/profile/step'
import {CheckboxList, FieldSet, RadioGroup, Select} from 'components/theme'


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

class GeneralSkillsStep extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  componentWillMount() {
    this.updater_ = new ProfileUpdater(
      {
        drivingLicenses: false,
        englishLevelEstimate: true,
        highestDegree: true,
        officeSkillsEstimate: true,
      },
      this,
      this.props,
    )
  }

  fastForward = () => {
    if (this.updater_.isFormValid()) {
      this.updater_.handleSubmit()
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
    const {isMobileVersion} = this.context
    const checkboxListStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'space-between',
    }
    const radioGroupStyle = {
      flexDirection: isMobileVersion ? 'column' : 'row',
      justifyContent: 'space-between',
    }
    return <Step
        title="Vos qualifications"
        fastForward={this.fastForward}
        onNextButtonClick={this.updater_.handleSubmit}
        onPreviousButtonClick={this.updater_.handleBack}
        {...this.props}>
      <FieldSet label="Plus haut niveau de diplôme obtenu"
                isValid={!!highestDegree} isValidated={isValidated}>
        <Select onChange={this.updater_.handleChange('highestDegree')} value={highestDegree}
                options={degrees} />
      </FieldSet>
      <FieldSet label="Permis de conduire">
        <CheckboxList
            options={drivingLicensesOptions}
            values={drivingLicenses}
            onChange={this.updater_.handleChange('drivingLicenses')}
            style={checkboxListStyle} />
      </FieldSet>
      <FieldSet
          label="Niveau d'anglais" isValid={!!englishLevelEstimate} isValidated={isValidated}>
        <RadioGroup
            style={radioGroupStyle}
            options={levelEstimateOptions}
            value={englishLevelEstimate}
            onChange={this.updater_.handleChange('englishLevelEstimate')} />
      </FieldSet>
      <FieldSet
          label="Niveau en suite bureautique (Word, Excel, …)"
          isValid={!!officeSkillsEstimate} isValidated={isValidated}>
        <RadioGroup
            style={radioGroupStyle}
            options={levelEstimateOptions}
            value={officeSkillsEstimate}
            onChange={this.updater_.handleChange('officeSkillsEstimate')} />
      </FieldSet>
    </Step>
  }
}


export {GeneralSkillsStep}
