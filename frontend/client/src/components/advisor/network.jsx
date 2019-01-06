import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'
import {isEmailTemplatePersonalized, projectMatchAllFilters} from 'store/user'

import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-network.png'

import {EmailTemplate, connectExpandedCardWithContent} from './base'


class NetworkAdvicePageBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      leads: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
      }).isRequired),
    }).isRequired,
    intro: PropTypes.node,
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {adviceData, onExplore, profile, project, userYou, intro} = this.props
    const leads = adviceData.leads || []
    const selectedEmails = getEmailTemplates(userYou).network.
      filter(({filters}) => projectMatchAllFilters(project, filters))
    // TODO(pascal): Remove the selectedEmails
    const emailCount = leads.length || selectedEmails.length
    return <div>
      {intro ? <div style={{marginBottom: 20}}>{intro}</div> : null}
      <div>
        Nous avons trouvé <strong><GrowingNumber
          number={emailCount} isSteady={true} /> exemple{emailCount > 1 ? 's ' : ' '}
        d'email</strong> pour contacter son réseau
      </div>
      <AppearingList style={{marginTop: 15}}>
        {(leads.length) ?
          leads.map((lead, idx) => <EmailTemplate
            content={lead.emailExample}
            tip={lead.contactTip}
            title={lead.name}
            key={`lead-${idx}`}
            onContentShown={() => onExplore('contact lead')}
            userYou={userYou} />)
          : selectedEmails.map((email, idx) => <EmailTemplate
            content={email.content}
            title={email.title}
            whyForYou={isEmailTemplatePersonalized(email.personalizations, profile, project) ?
              email.reason : null}
            key={`advice-${idx}`}
            style={{marginTop: -1}}
            onContentShown={() => onExplore('email template')}
            userYou={userYou} />)}
      </AppearingList>
    </div>
  }
}
const NetworkAdvicePage = connectExpandedCardWithContent()(NetworkAdvicePageBase)


export {NetworkAdvicePage, Picto}
