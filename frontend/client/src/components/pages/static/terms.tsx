import i18next from 'i18next'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {getBestTranslation} from 'store/i18n'
import formatDate from 'store/i18n_date'

import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {StaticPage, StrongTitle} from 'components/static'

import termsDate from 'deployment/terms'

const style = {
  padding: '20px 100px 100px',
}

const TermsAndConditionsPage = (): React.ReactElement => {
  const {i18n, t} = useTranslation()
  const dateString = formatDate(new Date(termsDate), 'PPPP', i18n.language)
  const [isTranslatedProperly, translatedTerms] = useMemo(
    () => getBestTranslation('terms', i18n.language, async (lang: string): Promise<string> => {
      const {default: termsContent} = await import(
        /* webpackChunkName: 'i18n-pages-' */ `deployment/translations/${lang}/terms.txt`)
      return i18next.services.interpolator.interpolate(termsContent, {
        canonicalUrl: config.canonicalUrl,
        contactEmailAddress: 'contact@bob-emploi.fr',
        dataPrivacyEmailAddress: 'donnees@bob-emploi.fr',
        notifyEmailAddress: 'attention@bob-emploi.fr',
        orgName: config.orgName.toUpperCase(),
        productName: config.productName.toUpperCase(),
        publishedDate: dateString,
        unsubscribeEmailAddress: 'desinscription@bob-emploi.fr',
      }, lang, {escapeValue: false})
    }),
    [i18n.language, dateString])
  const title = <Trans parent="span" t={t}>
    Conditions générales d'utilisation<br />
    au <StrongTitle>{{date: dateString}}</StrongTitle>
  </Trans>
  return <StaticPage
    page="terms" title={title} style={style}>
    {translatedTerms ? <React.Fragment>
      {isTranslatedProperly ? null : <div>
        {t(
          'Les conditions générales ne sont pas encore disponibles en français, vous trouverez ' +
          'donc ici une version originale non traduite.',
        )}
      </div>}
      <Markdown content={translatedTerms} />
    </React.Fragment> : <div>
      {t('Les conditions générales sont en cours de traduction…')}
    </div>}
  </StaticPage>
}


export default React.memo(TermsAndConditionsPage)
