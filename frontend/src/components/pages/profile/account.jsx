import React from 'react'

import {ProfileStep, ProfileStepBaseClass} from 'components/pages/profile/step'
import {Colors, FieldSet, Input} from 'components/theme'


class AccountStep extends ProfileStepBaseClass {
  constructor(props) {
    super({
      fieldnames: {
        email: true,
        lastName: true,
        name: true,
      },
      ...props,
    })
  }

  fastForward = () => {
    this.handleSubmit()
  }

  render() {
    const {email, isValidated, lastName, name} = this.state
    return <ProfileStep
        title="Vos informations"
        fastForward={this.fastForward}
        onNextButtonClick={this.handleSubmit}
        {...this.props}>
      <FieldSet label="Prénom" style={{width: 360}}
          isValid={!!name} isValidated={isValidated}>
        <Input
          type="text" placeholder="Prénom"
          onChange={this.handleChange('name')} value={name} />
      </FieldSet>
      <FieldSet
          label="Nom" style={{width: 360}}
          isValid={!!lastName} isValidated={isValidated}>
        <Input
            type="text" placeholder="Nom"
            onChange={this.handleChange('lastName')} value={lastName} />
      </FieldSet>
      <FieldSet
          label="Email (non éditable pour l'instant)" style={{width: 360}}
          isValid={!!email} isValidated={isValidated}>
        <Input
            type="text" style={{color: Colors.COOL_GREY}}
            value={email} readOnly={true} />
      </FieldSet>
    </ProfileStep>
  }
}


export {AccountStep}
