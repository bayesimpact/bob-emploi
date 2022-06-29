import React from 'react'

import dwpLogo from './dwp_logo.svg'

const SecondaryLogo = ({style}: {style?: React.CSSProperties}): React.ReactElement => <img
  style={{display: 'block', ...style}} src={dwpLogo} alt="Department for Work &amp; Pensions" />

export default SecondaryLogo
