import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React from 'react'
import {useTranslation} from 'react-i18next'
import {Link} from 'react-router-dom'

import {STATIC_NAMESPACE} from 'store/i18n'
import isMobileVersion from 'store/mobile'

import Button from 'components/button'
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
  return <StaticPage page="vision" title={<strong>Notre mission</strong>} style={style}>
    <div style={leftTitleStyle}>
      Mettre la technologie au service de chacun
    </div>
    <div style={{fontSize: 16, lineHeight: 1.63, maxWidth: 600}}>
      <Markdown content={translate('vision')} />

      <div style={{margin: '50px 0', textAlign: isMobileVersion ? 'center' : 'right'}}>
        <Link to={Routes.CONTRIBUTION_PAGE}>
          <Button style={{fontSize: 17, padding: '10px 12px 8px 39px'}}>
            <span style={{paddingRight: '1em'}}>
              Contribuer
            </span>
            <ChevronRightIcon
              style={{fill: '#fff', height: 24, paddingBottom: 2, verticalAlign: 'middle'}} />
          </Button>
        </Link>
      </div>
    </div>
  </StaticPage>
}


export default React.memo(VisionPage)
