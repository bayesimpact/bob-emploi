import i18next from 'i18next'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {getBestTranslation} from 'store/i18n'
import formatDate from 'store/i18n_date'
import isMobileVersion from 'store/mobile'

import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'

const pageStyle: React.CSSProperties = {
  margin: 'auto',
  maxWidth: 1200,
  overflowX: 'hidden',
}
const separatorStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_GREY,
  border: 'none',
  height: 1,
  width: '100%',
}

const footerSectionHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  alignSelf: 'center',
  display: 'flex',
  fontSize: 50,
  justifyContent: 'center',
  lineHeight: 1,
  minHeight: 200,
  padding: isMobileVersion ? '20px 0' : 'initial',
  textAlign: 'center',
}
const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: isMobileVersion ? 20 : 100,
}

interface Props {
  date?: Date
}

const TermsPage = ({date = new Date('2021-06-10')}: Props) => {
  const {i18n, t} = useTranslation()
  const dateString = formatDate(date, 'PPPP', i18n.language)
  const [isTranslatedProperly, translatedTerms] = useMemo(
    () => getBestTranslation(
      'terms_jobflix', i18n.language, async (lang: string): Promise<string> => {
        const {default: termsContent} = await import(
          /* webpackChunkName: 'i18n-pages-' */ `deployment/translations/${lang}/terms_jobflix.txt`)
        return i18next.services.interpolator.interpolate(termsContent, {
          canonicalUrl: config.canonicalUrl,
          date: dateString,
          emailSuffix: '@jobflix.app',
          productName: config.productName.toUpperCase(),
        }, lang, {escapeValue: false})
      },
    ),
    [i18n.language, dateString])
  return <div>
    <div style={pageStyle}>
      <header style={footerSectionHeaderStyle}>
        <Trans parent="span">
          Conditions générales d'utilisation<br />
          au <strong>{{date: dateString}}</strong>
        </Trans>
      </header>

      <hr style={separatorStyle} />

      <div style={contentStyle}>
        {translatedTerms ? <React.Fragment>
          {isTranslatedProperly ? null : <div>
            {t(
              'Les conditions générales ne sont pas encore disponibles en français, vous ' +
              'trouverez donc ici une version originale non traduite.',
            )}
          </div>}
          <Markdown content={translatedTerms} />
        </React.Fragment> : <div>
          {t('Les conditions générales sont en cours de traduction…')}
        </div>}
      </div>
    </div>
  </div>
}

export default React.memo(TermsPage)
