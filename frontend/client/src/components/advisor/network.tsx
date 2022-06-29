import React from 'react'

import type {LocalizableString} from 'store/i18n'
import {combineTOptions, prepareT} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'


import type {CardProps} from './base'
import {MethodSuggestionList, EmailTemplate, useAdviceData} from './base'


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


const NetworkAdvicePageBase = (props: NetworkCardProps): React.ReactElement => {
  const {handleExplore, profile: {gender}, t, t: translate, intro} = props
  const {data: {leads = emptyArray}, loading} = useAdviceData<bayes.bob.ContactLeads>(props)
  const emailCount = leads.length
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
    {leads.length ? <MethodSuggestionList title={leadsTitle}>
      {leads.map((lead, idx): ReactStylableElement|null => lead.emailExample ? <EmailTemplate
        content={lead.emailExample}
        tip={lead.contactTip}
        title={lead.name}
        key={`lead-${idx}`}
        onContentShown={handleExplore('contact lead')} /> : null)}
    </MethodSuggestionList> : null}
    <MethodSuggestionList style={{marginTop: 20}} title={excusesTitle}>
      {CONTACT_EXCUSES.map((excuse, idx): ReactStylableElement => <EmailTemplate
        content={translate(...combineTOptions(excuse.example, {context: gender}))}
        title={translate(...excuse.name)}
        key={`example-${idx}`}
        onContentShown={handleExplore('contact excuses')} />)}
    </MethodSuggestionList>
  </div>
}
const NetworkAdvicePage = React.memo(NetworkAdvicePageBase)


const pictoName = 'discussion' as const
export {NetworkAdvicePage, pictoName}
