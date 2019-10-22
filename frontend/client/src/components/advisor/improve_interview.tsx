import React from 'react'

import {YouChooser} from 'store/french'
import Picto from 'images/advices/picto-improve-interview.svg'

import {CardProps, ImproveApplicationTips} from './base'


const SECTIONS = [
  {
    data: 'qualities',
    title: 'Qualités les plus attendues par les recruteurs\u00A0:',
  },
  {
    data: 'preparations',
    title: (userYou: YouChooser): string =>
      userYou('Pour préparer ton entretien', 'Pour préparer votre entretien'),
  },
] as const

const ExpandedAdviceCardContentBase: React.FC<CardProps> = (props): React.ReactElement =>
  <ImproveApplicationTips {...props} sections={SECTIONS} />
const ExpandedAdviceCardContent = React.memo(ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
