import PropTypes from 'prop-types'
import React from 'react'

import {LocalizableString, getEmailTemplates, combineTOptions, prepareT} from 'store/i18n'
import {isEmailTemplatePersonalized, projectMatchAllFilters} from 'store/user'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Picto from 'images/advices/picto-network-application.svg'

import {CardProps, MethodSuggestionList, EmailTemplate, useAdviceData} from './base'


const CONTACT_EXCUSES: readonly {example: LocalizableString; name: LocalizableString}[] = [
  {
    example: prepareT(
      "J'ai vu que \\[partager une actualité de votre profession\\] cela m'a fait " +
      'penser à vous. \\[ajouter un lien vers un article sur le sujet\\]',
    ),
    name: prepareT('Partager une actualité'),
  },
  {
    example: prepareT(
      'Je suis tombé·e sur cet article qui pourra vous intéresser.' +
      " \\[ajouter un lien vers l'article\\]",
    ),
    name: prepareT('Partager un article'),
  },
  {
    example: prepareT(
      '\\[entreprise/organisation\\] organise une conférence sur \\[sujet\\].' +
      " J'ai pensé que cet évènement pourrait vous intéresser. J'espère que nous" +
      ' pourrons nous y croiser.',
    ),
    name: prepareT('Partager un événement'),
  },
] as const


interface NetworkCardProps extends CardProps {
  intro?: React.ReactNode
}


const emptyArray = [] as const


// TODO(pascal): Move to the methods' UI.
const NetworkAdvicePageBase = (props: NetworkCardProps): React.ReactElement => {
  const {handleExplore, profile, profile: {gender}, project, t, t: translate, intro} = props
  const {data: {leads = emptyArray}, loading} = useAdviceData<bayes.bob.ContactLeads>(props)
  const selectedEmails = getEmailTemplates(t).network.
    filter(({filters}): boolean => projectMatchAllFilters(project, filters))
  // TODO(pascal): Remove the selectedEmails
  const emailCount = leads.length || selectedEmails.length
  const leadsTitle = <Trans parent={null} count={emailCount} t={t}>
    <GrowingNumber number={emailCount} isSteady={true} /> exemple d'email pour contacter son réseau
  </Trans>
  const excusesTitle = <Trans parent={null} t={t}>
    <GrowingNumber number={3} isSteady={true} /> prétextes pour envoyer un message à
    quelqu'un
  </Trans>
  if (loading) {
    return loading
  }
  // TODO(cyrille): Put intro inside one of the method sections.
  return <div>
    {intro ? <div style={{marginBottom: 20}}>{intro}</div> : null}
    <MethodSuggestionList title={leadsTitle}>
      {(leads.length) ?
        leads.map((lead, idx): ReactStylableElement|null => lead.emailExample ? <EmailTemplate
          content={lead.emailExample}
          tip={lead.contactTip}
          title={lead.name}
          key={`lead-${idx}`}
          onContentShown={handleExplore('contact lead')} /> : null)
        : selectedEmails.map((email, idx): ReactStylableElement => <EmailTemplate
          content={email.content}
          title={email.title}
          whyForYou={
            isEmailTemplatePersonalized(email.personalizations || emptyArray, profile, project) ?
              email.reason : undefined}
          key={`advice-${idx}`}
          onContentShown={handleExplore('email template')} />)}
    </MethodSuggestionList>
    <MethodSuggestionList style={{marginTop: 20}} title={excusesTitle}>
      {CONTACT_EXCUSES.map((excuse, idx): ReactStylableElement => <EmailTemplate
        content={translate(...combineTOptions(excuse.example, {context: gender}))}
        title={translate(...excuse.name)}
        key={`example-${idx}`}
        onContentShown={handleExplore('contact excuses')} />)}
    </MethodSuggestionList>
  </div>
}
NetworkAdvicePageBase.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  intro: PropTypes.node,
  profile: PropTypes.object.isRequired,
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const NetworkAdvicePage = React.memo(NetworkAdvicePageBase)


export {NetworkAdvicePage, Picto}
