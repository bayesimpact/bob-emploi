import React from 'react'

import config from 'config'
import {ProfileStepBaseClass, ProfileStep} from 'components/pages/profile/step'
import {CheckboxList, Colors, FieldSet, LabeledToggle} from 'components/theme'


const DAY_OPTIONS = [
  {name: 'lundi', value: 'MONDAY'},
  {name: 'mardi', value: 'TUESDAY'},
  {name: 'mercredi', value: 'WEDNESDAY'},
  {name: 'jeudi', value: 'THURSDAY'},
  {name: 'vendredi', value: 'FRIDAY'},
  {name: 'samedi', value: 'SATURDAY'},
  {name: 'dimanche', value: 'SUNDAY'},
]


class NotificationsStep extends ProfileStepBaseClass {
  constructor(props) {
    super({
      fieldnames: {
        emailDays: false,
        isNewsletterEnabled: false,
        isWeeklySummaryEnabled: false,
      },
      ...props,
    })
  }

  componentWillMount() {
    const {profile} = this.props
    this.setState({alreadyHasEmailNotifications: !!(profile.emailDays || []).length})
  }

  renderEmailDaysFieldset(detailsStyle) {
    const {emailDays, isWeeklySummaryEnabled} = this.state
    return <FieldSet label={<span style={{fontWeight: 500}}>
      Recevoir les emails contenant vos actions du jour le&nbsp;:
    </span>}>
      <div style={detailsStyle}>
        Vous pourrez toujours accéder aux nouvelles actions du jour en allant
        sur le site de {config.productName}.
      </div>
      <CheckboxList
          options={DAY_OPTIONS}
          values={emailDays}
          onChange={this.handleChange('emailDays')} />
      <LabeledToggle
          label="Recevoir un récapitulatif de mon activité chaque semaine"
          style={{marginTop: 30}} type="checkbox" isSelected={isWeeklySummaryEnabled}
          onClick={() => this.setState({isWeeklySummaryEnabled: !isWeeklySummaryEnabled})} />
    </FieldSet>
  }

  renderHorizontalRule() {
    return <hr style={{
      borderTop: 'solid 1px ' + Colors.SILVER,
      marginBottom: 35,
      width: '100%',
    }} />
  }

  renderNewsletterFieldset(detailsStyle) {
    const {gender} = this.props.profile
    const {isNewsletterEnabled} = this.state
    const genderE = gender === 'FEMININE' ? 'e' : ''
    return <FieldSet label={<span style={{fontWeight: 500}}>
      Emails concernant {config.productName}
    </span>}>
      <div style={detailsStyle}>
        Ces emails nous serviront à vous tenir informé{genderE} des évolutions
        de {config.productName}&nbsp;: nouvelles fonctionnalités, astuces, …
      </div>
      <LabeledToggle
          type="checkbox"
          label={`Suivre l'actualité de ${config.productName}`}
          isSelected={isNewsletterEnabled}
          onClick={() => this.handleChange('isNewsletterEnabled')(!isNewsletterEnabled)} />
    </FieldSet>
  }

  render() {
    const {alreadyHasEmailNotifications} = this.state
    const detailsStyle = {
      color: Colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 20,
      maxWidth: 440,
    }
    return <ProfileStep
      title="Vos notifications"
      explanation={alreadyHasEmailNotifications ? <div style={{maxWidth: 440, padding: '0 50px'}}>
        {config.productName} fonctionne en vous accompagnant au quotidien. Pour
        vous faciliter la tâche, nous vous enverrons des emails contenant nos
        conseils du jour <strong>en fonction de vos préférences</strong>.
      </div> : null}
      fastForward={this.handleSubmit}
      onNextButtonClick={this.handleSubmit}
      {...this.props}>
      {alreadyHasEmailNotifications ? this.renderEmailDaysFieldset(detailsStyle) : null}
      {alreadyHasEmailNotifications ? this.renderHorizontalRule() : null}
      {this.renderNewsletterFieldset(detailsStyle)}
    </ProfileStep>
  }
}


export {NotificationsStep}
