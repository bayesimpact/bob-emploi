import React from 'react'

import useFastForward from 'hooks/fast_forward'

import aliLogo from '../../images/logo-ali.svg'

import Button from '../button'
import GenericPage from '../page'
import {Routes} from '../../store'


const separatorStyle: React.CSSProperties = {
  borderRadius: 10,
  borderTop: `10px solid ${colors.MAGENTA}`,
  margin: '30px 0',
  maxWidth: 30,
}
const paragraphStyle: React.CSSProperties = {
  margin: 0,
}
const contentStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: 1,
  justifyContent: 'center',
  margin: '90px 0px 50px',
  maxWidth: 800,
}
const textPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}
const tagLineStyle: React.CSSProperties = {
  color: colors.PEA,
  fontFamily: 'Fredoka One',
  fontSize: 24,
}
const summaryStyle: React.CSSProperties = {
  marginBottom: 18,
}
const logoStyle: React.CSSProperties = {
  flexShrink: 0,
  marginRight: 60,
}


const UserLandingPage = (): React.ReactElement => {
  useFastForward(undefined, [], Routes.HUB_PAGE)
  return <GenericPage
    hasLargeDecoration={true} bottomButton={<Button to={Routes.HUB_PAGE}>Suivant</Button>}>
    <div style={contentStyle}>
      <img src={aliLogo} alt="logo ali" style={logoStyle} />
      <div style={textPanelStyle}>
        <div style={tagLineStyle}>
          Faites le point avec votre conseiller sur votre situation et vos priorités
        </div>
        <div style={separatorStyle} />
        <div style={summaryStyle}><strong>
          A-Li a été conçu pour faciliter votre auto-diagnostic sur votre
          situation et les sujets que vous souhaitez aborder en priorité avec la Mission Locale.
        </strong></div>
        <div>
          <p style={paragraphStyle}>
            Vous découvrirez ou redécouvrirez ainsi tous les domaines que vous pouvez aborder à
            la Mission Locale, immédiatement ou un peu plus tard.
          </p>
          <p style={paragraphStyle}>Il n'y a pas de bonne ou de mauvaise réponse.</p>
          <p style={paragraphStyle}>
            Pour conserver le bilan de vos réponses, vous pourrez l'enregistrer en ligne à partir
            de votre adresse mail sur un outil national en ligne appelé "{config.productName}".
            Vous pourrez à tout moment le consulter et le partager pour en échanger avec un
            professionnel.
          </p>
        </div>
      </div>
    </div>
  </GenericPage>
}


export default React.memo(UserLandingPage)
