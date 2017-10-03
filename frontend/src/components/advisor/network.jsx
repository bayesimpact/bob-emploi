import React from 'react'
import {connect} from 'react-redux'
import PropTypes from 'prop-types'

import {GET_EXPANDED_CARD_CONTENT, getExpandedCardContent} from 'store/actions'
import {lowerFirstLetter} from 'store/french'
import {isEmailTemplatePersonalized, projectMatchAllFilters} from 'store/user'

import {AppearingList, GrowingNumber, Markdown, PaddedOnMobile,
  StringJoiner} from 'components/theme'

import {EmailTemplate} from './base'
import MESSAGE_EXAMPLES from './data/email_templates.json'


class NetworkAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      cardText: PropTypes.string,
    }).isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {advice, project, profile} = this.props
    const {cardText} = advice
    if (cardText) {
      return <div style={{fontSize: 30}}>
        <Markdown content={cardText} />
      </div>
    }

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


class NetworkAdvicePageBase extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      adviceId: PropTypes.string.isRequired,
    }).isRequired,
    dispatch: PropTypes.func.isRequired,
    featuresEnabled: PropTypes.shape({
      alpha: PropTypes.bool,
    }).isRequired,
    leads: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    const {advice, dispatch, featuresEnabled, leads, project} = this.props
    // TODO(pascal): Enable for all users when ready.
    if (!leads.length && featuresEnabled.alpha) {
      dispatch(getExpandedCardContent(project, GET_EXPANDED_CARD_CONTENT, advice.adviceId))
    }
  }

  render() {
    const {featuresEnabled, leads, profile, project} = this.props
    const selectedEmails = MESSAGE_EXAMPLES.network.
      filter(({filters}) => projectMatchAllFilters(project, filters))
    const emailCount = featuresEnabled.alpha && leads.length || selectedEmails.length
    return <div>
      <PaddedOnMobile>
        Nous avons trouvé <strong><GrowingNumber
          number={emailCount} isSteady={true} /> exemple{emailCount > 1 ? 's ' : ' '}
        d'email</strong> pour contacter son réseau
      </PaddedOnMobile>
      <AppearingList style={{marginTop: 15}}>
        {(featuresEnabled.alpha && leads.length) ?
          // TODO(pascal): Add tip.
          leads.map((lead, idx) => <EmailTemplate
            content={lead.emailExample}
            title={lead.name}
            key={`lead-${idx}`} />)
          : selectedEmails.map((email, idx) => <EmailTemplate
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
const NetworkAdvicePage = connect(({app, user}, {advice, project}) => {
  const {leads} = (app.adviceData[project.projectId] || {})[advice.adviceId] || {}
  return {
    featuresEnabled: user.featuresEnabled || {},
    leads: leads || [],
  }
})(NetworkAdvicePageBase)


export {NetworkAdviceCard, NetworkAdvicePage}
