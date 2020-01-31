import React from 'react'

import Picto from 'images/advices/picto-improve-interview.svg'

import {prepareT} from 'store/i18n'

import {CardProps, ImproveApplicationTips} from './base'


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

const ImproveInterview: React.FC<CardProps> = (props): React.ReactElement =>
  <ImproveApplicationTips {...props} sections={SECTIONS} />
const ExpandedAdviceCardContent = React.memo(ImproveInterview)


export default {ExpandedAdviceCardContent, Picto}
