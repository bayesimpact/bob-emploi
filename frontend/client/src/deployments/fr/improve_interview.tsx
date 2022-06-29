import React from 'react'

import {prepareT} from 'store/i18n'

import {ImproveApplicationTips} from 'components/advisor/base'
import type {CardProps} from 'components/advisor/base'


const SECTIONS = [
  {
    data: 'qualities',
    title: prepareT('Qualités les plus attendues par les recruteurs\u00A0:'),
  },
  {
    data: 'preparations',
    title: prepareT('Pour préparer votre entretien'),
  },
] as const

const ImproveInterviewContent: React.FC<CardProps> = (props): React.ReactElement =>
  <ImproveApplicationTips {...props} sections={SECTIONS} />

export default React.memo(ImproveInterviewContent)
