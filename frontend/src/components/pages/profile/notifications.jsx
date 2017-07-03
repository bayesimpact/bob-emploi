import React from 'react'

import config from 'config'
import {ProfileUpdater, Step} from 'components/pages/profile/step'
import {CheckboxList, Colors, FieldSet, LabeledToggle} from 'components/theme'
import {USER_PROFILE_SHAPE} from 'store/user'


const DAY_OPTIONS = [
  {name: 'lundi', value: 'MONDAY'},
  {name: 'mardi', value: 'TUESDAY'},
  {name: 'mercredi', value: 'WEDNESDAY'},
  {name: 'jeudi', value: 'THURSDAY'},
  {name: 'vendredi', value: 'FRIDAY'},
  {name: 'samedi', value: 'SATURDAY'},
  {name: 'dimanche', value: 'SUNDAY'},
]


class NotificationsStep extends React.Component {
  static propTypes = {
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  componentWillMount() {
    this.updater_ = new ProfileUpdater(
      {
        emailDays: false,
        isNewsletterEnabled: false,
        isWeeklySummaryEnabled: false,
      },
      this,
      this.props,
    )
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
        onChange={this.updater_.handleChange('emailDays')} />
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
        onClick={() => this.updater_.handleChange('isNewsletterEnabled')(!isNewsletterEnabled)} />
    </FieldSet>
  }

  render() {
    const detailsStyle = {
      color: Colors.COOL_GREY,
      fontSize: 14,
      fontStyle: 'italic',
      marginBottom: 20,
      maxWidth: 440,
    }
    return <Step
      title="Vos notifications"
      explanation={<div style={{maxWidth: 440, padding: '0 50px'}}>
        {config.productName} fonctionne en vous accompagnant au quotidien. Pour
        vous faciliter la tâche, nous vous enverrons des emails contenant nos
        conseils du jour <strong>en fonction de vos préférences</strong>.
      </div>}
      fastForward={this.updater_.handleSubmit}
      onNextButtonClick={this.updater_.handleSubmit}
      {...this.props}>
      {this.renderEmailDaysFieldset(detailsStyle)}
      {this.renderHorizontalRule()}
      {this.renderNewsletterFieldset(detailsStyle)}
    </Step>
  }
}


export {NotificationsStep}
