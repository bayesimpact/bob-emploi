import React from 'react'
import PropTypes from 'prop-types'

import {isEmailTemplatePersonalized, projectMatchAllFilters} from 'store/user'
import {lowerFirstLetter} from 'store/french'

import {AppearingList, GrowingNumber, PaddedOnMobile, StringJoiner} from 'components/theme'

import {EmailTemplate} from './base'
import MESSAGE_EXAMPLES from './data/email_templates.json'


class NetworkAdviceCard extends React.Component {
  static propTypes = {
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {project, profile} = this.props
    const explanationStyle = {
      fontSize: 30,
    }

    const selectedEmails = (MESSAGE_EXAMPLES.network.
      filter(email => projectMatchAllFilters(project, email.filters)).
      filter(email => isEmailTemplatePersonalized(email.personalizations, profile, project)) ||
        ["amis d'amis"])

    return <section style={explanationStyle}>
      Contactez en priorité vos <StringJoiner lastSeparator=" et vos ">
        {selectedEmails.slice(0, 2).map(({title}) => <strong key={title}>
          {lowerFirstLetter(title)}
        </strong>)}
      </StringJoiner>.
    </section>
  }
}


class NetworkAdvicePage extends React.Component {
  static propTypes = {
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {profile, project} = this.props
    const selectedEmails = MESSAGE_EXAMPLES.network.
      filter(({filters}) => projectMatchAllFilters(project, filters))
    return <div>
      <PaddedOnMobile>
        Nous avons trouvé <strong><GrowingNumber
          number={selectedEmails.length} isSteady={true} /> exemples
        d'email</strong> pour contacter son réseau
      </PaddedOnMobile>
      <AppearingList style={{marginTop: 15}}>
        {selectedEmails.
          map((email, idx) => <EmailTemplate
            content={email.content}
            title={email.title}
            whyForYou={isEmailTemplatePersonalized(email.personalizations, profile, project) ?
              email.reason : null}
            key={`advice-${idx}`}
            style={{marginTop: -1}} />)}
      </AppearingList>
    </div>
  }
}


export {NetworkAdviceCard, NetworkAdvicePage}
