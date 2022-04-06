import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React from 'react'
import {useTranslation} from 'react-i18next'

import {STATIC_NAMESPACE} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import LinkButton from 'components/link_button'
import Markdown from 'components/markdown'
import {StaticPage} from 'components/static'
import {Routes} from 'components/url'


const leftTitleStyle: React.CSSProperties = {
  color: colors.SLATE,
  fontSize: 35,
  fontWeight: 'bold',
  lineHeight: 1.34,
  marginRight: isMobileVersion ? 'initial' : 80,
  width: 320,
}
const buttonStyle: React.CSSProperties = {
  fontSize: 17,
  padding: '10px 12px 8px 39px',
}
const style: React.CSSProperties = {
  display: 'flex',
  margin: '72px 100px 100px',
  padding: 0,
}
if (isMobileVersion) {
  Object.assign(style, {
    flexDirection: 'column',
    margin: '22px 20px 40px',
  })
}


const VisionPage: React.FC = (): React.ReactElement => {
  const [translate] = useTranslation(STATIC_NAMESPACE)
  const {t} = useTranslation()
  return <StaticPage page="vision" title={t('Notre mission')} style={style}>
    <div style={leftTitleStyle}>
      {t('Mettre la technologie au service de chacun')}
    </div>
    <div style={{fontSize: 16, lineHeight: 1.63, maxWidth: 600}}>
      <Markdown content={translate('vision', {
        contactEmailAddress: 'contact@bob-emploi.fr',
        orgName: 'Bayes Impact France',
        productName: config.productName,
      })} />

      <div style={{margin: '50px 0', textAlign: isMobileVersion ? 'center' : 'right'}}>
        <LinkButton to={Routes.CONTRIBUTION_PAGE} style={buttonStyle}>
          <span style={{paddingRight: '1em'}}>
            {t('Contribuer')}
          </span>
          <ChevronRightIcon
            style={{fill: '#fff', height: 24, paddingBottom: 2, verticalAlign: 'middle'}} />
        </LinkButton>
      </div>
    </div>
  </StaticPage>
}


export default React.memo(VisionPage)
