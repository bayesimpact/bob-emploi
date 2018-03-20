import React from 'react'
import PropTypes from 'prop-types'

import {lowerFirstLetter, getEmailTemplates} from 'store/french'
import {isEmailTemplatePersonalized, projectMatchAllFilters} from 'store/user'

import {AppearingList, GrowingNumber, Markdown, PaddedOnMobile,
  StringJoiner} from 'components/theme'
import Picto from 'images/advices/picto-network.png'

import {EmailTemplate, connectExpandedCardWithContent} from './base'


class NetworkAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      cardText: PropTypes.string,
    }).isRequired,
    fontSize: PropTypes.number.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {advice, fontSize, project, profile, userYou} = this.props
    const {cardText} = advice
    if (cardText) {
      return <div style={{fontSize: fontSize}}>
        <Markdown content={cardText} />
      </div>
    }

    const explanationStyle = {
      fontSize: fontSize,
    }

    const selectedEmails = (getEmailTemplates(userYou).network.
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


class NetworkAdvicePageBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      leads: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
      }).isRequired),
    }).isRequired,
    intro: PropTypes.node,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {adviceData, profile, project, userYou, intro} = this.props
    const leads = adviceData.leads || []
    const selectedEmails = getEmailTemplates(userYou).network.
      filter(({filters}) => projectMatchAllFilters(project, filters))
    // TODO(pascal): Remove the selectedEmails
    const emailCount = leads.length || selectedEmails.length
    return <div>
      {intro ? <div style={{marginBottom: 20}}>{intro}</div> : null}
      <PaddedOnMobile>
        Nous avons trouvé <strong><GrowingNumber
          number={emailCount} isSteady={true} /> exemple{emailCount > 1 ? 's ' : ' '}
        d'email</strong> pour contacter son réseau
      </PaddedOnMobile>
      <AppearingList style={{marginTop: 15}}>
        {(leads.length) ?
          leads.map((lead, idx) => <EmailTemplate
            content={lead.emailExample}
            tip={lead.contactTip}
            title={lead.name}
            key={`lead-${idx}`}
            userYou={userYou} />)
          : selectedEmails.map((email, idx) => <EmailTemplate
            content={email.content}
            title={email.title}
            whyForYou={isEmailTemplatePersonalized(email.personalizations, profile, project) ?
              email.reason : null}
            key={`advice-${idx}`}
            style={{marginTop: -1}}
            userYou={userYou} />)}
      </AppearingList>
    </div>
  }
}
const NetworkAdvicePage = connectExpandedCardWithContent()(NetworkAdvicePageBase)


export {NetworkAdviceCard, NetworkAdvicePage, Picto}
