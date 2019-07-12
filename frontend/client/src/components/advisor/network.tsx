import React from 'react'
import PropTypes from 'prop-types'

import {getEmailTemplates} from 'store/french'
import {isEmailTemplatePersonalized, projectMatchAllFilters} from 'store/user'

import {GrowingNumber} from 'components/theme'
import NewPicto from 'images/advices/picto-network-application.svg'

import {CardProps, CardWithContentProps, MethodSuggestionList, EmailTemplate,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


const CONTACT_EXCUSES = [
  {
    example: "J'ai vu que \\[partager une actualité de votre profession\\] cela m'a fait " +
      'penser à vous. \\[ajouter un lien vers un article sur le sujet\\]',
    name: 'Partager une actualité',
  },
  {
    example: 'Je suis tombé(e) sur cet article qui pourra vous intéresser.' +
      " \\[ajouter un lien vers l'article\\]",
    name: 'Partager un article',
  },
  {
    example: '\\[entreprise/organisation\\] organise une conférence sur \\[sujet\\].' +
      " J'ai pensé que cet évènement pourrait vous intéresser. J'espère que nous" +
      ' pourrons nous y croiser.',
    name: 'Partager un événement',
  },
]


interface WithIntro {
  intro?: React.ReactNode
}


type NetworkCardProps = CardWithContentProps<bayes.bob.ContactLeads> & WithIntro


class NetworkAdvicePageBase extends React.PureComponent<NetworkCardProps> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      leads: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
      }).isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    intro: PropTypes.node,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  // TODO(pascal): Move to the methods' UI.
  public render(): React.ReactNode {
    const {adviceData, handleExplore, profile, project, userYou, intro} = this.props
    const leads = adviceData.leads || []
    const selectedEmails = getEmailTemplates(userYou).network.
      filter(({filters}): boolean => projectMatchAllFilters(project, filters))
    // TODO(pascal): Remove the selectedEmails
    const emailCount = leads.length || selectedEmails.length
    const leadsTitle = <React.Fragment>
      <GrowingNumber number={emailCount} isSteady={true} /> exemple{emailCount > 1 ? 's ' : ' '}
      d'email pour contacter son réseau
    </React.Fragment>
    const excusesTitle = <React.Fragment>
      <GrowingNumber number={3} isSteady={true} /> prétextes pour envoyer un message à
      quelqu'un
    </React.Fragment>
    // TODO(cyrille): Put intro inside one of the method sections.
    return <div>
      {intro ? <div style={{marginBottom: 20}}>{intro}</div> : null}
      <MethodSuggestionList title={leadsTitle}>
        {(leads.length) ?
          leads.map((lead, idx): ReactStylableElement => <EmailTemplate
            isMethodSuggestion={true}
            content={lead.emailExample}
            tip={lead.contactTip}
            title={lead.name}
            key={`lead-${idx}`}
            onContentShown={handleExplore('contact lead')}
            userYou={userYou} />)
          : selectedEmails.map((email, idx): ReactStylableElement => <EmailTemplate
            isMethodSuggestion={true}
            content={email.content}
            title={email.title}
            whyForYou={isEmailTemplatePersonalized(email.personalizations, profile, project) ?
              email.reason : null}
            key={`advice-${idx}`}
            onContentShown={handleExplore('email template')}
            userYou={userYou} />)}
      </MethodSuggestionList>
      <MethodSuggestionList style={{marginTop: 20}} title={excusesTitle}>
        {CONTACT_EXCUSES.map((excuse, idx): ReactStylableElement => <EmailTemplate
          isMethodSuggestion={true}
          content={excuse.example}
          title={excuse.name}
          key={`example-${idx}`}
          onContentShown={handleExplore('contact excuses')}
          userYou={userYou} />)}
      </MethodSuggestionList>
    </div>
  }
}
const NetworkAdvicePage =
  connectExpandedCardWithContent<{}, bayes.bob.ContactLeads, CardProps & WithIntro>()(
    NetworkAdvicePageBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({leads}: bayes.bob.ContactLeads): readonly bayes.bob.ContactLead[] => leads, 'modèle')


export {NetworkAdvicePage, NewPicto, TakeAway}
