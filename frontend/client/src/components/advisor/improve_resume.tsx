import React from 'react'

import {YouChooser} from 'store/french'
import Picto from 'images/advices/picto-improve-resume.svg'

import {CardProps, ImproveApplicationTips} from './base'


const SECTIONS = [
  {
    data: 'qualities',
    title: 'Qualités les plus attendues par les recruteurs\u00A0:',
  },
  {
    data: 'improvements',
    title: (userYou: YouChooser): string => `Pour améliorer ${userYou('ta', 'votre')} candidature`,
  },
]


const ExpandedAdviceCardContentBase: React.FC<CardProps> = (props): React.ReactElement =>
  <ImproveApplicationTips {...props} sections={SECTIONS} />
const ExpandedAdviceCardContent = React.memo(ExpandedAdviceCardContentBase)


export default {ExpandedAdviceCardContent, Picto}
