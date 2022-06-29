import React from 'react'

import defaultPicto from 'images/default-picto.svg'
import handshake from 'images/advices/picto-association-help.svg'
import magnifyingGlass from 'images/advices/picto-better-job-in-group.svg'
import okHand from 'images/advices/picto-body-language.svg'
import raisedHand from 'images/advices/picto-civic-service.svg'
import suitcase from 'images/advices/picto-commute.svg'
import whiteBuilding from 'images/advices/picto-create-your-company.svg'
import drivingLicense from 'images/advices/picto-driving-license.svg'
import calendar from 'images/advices/picto-events.svg'
import binocularsBlue from 'images/advices/picto-explore-other-jobs.svg'
import binocularsYellow from 'images/advices/picto-find-a-jobboard.svg'
import notepad from 'images/advices/picto-follow-up.svg'
import rocket from 'images/advices/picto-immersion.svg'
import megaphone from 'images/advices/picto-improve-interview.svg'
import documentStamped from 'images/advices/picto-improve-resume.svg'
import letter from 'images/advices/picto-less-applications.svg'
import hourglass from 'images/advices/picto-life-balance.svg'
import womanWithManyArms from 'images/advices/picto-long-term-mom.svg'
import computer from 'images/advices/picto-motivation-email.svg'
import ruler from 'images/advices/picto-needs.svg'
import discussion from 'images/advices/picto-network-application.svg'
import headsetMic from 'images/advices/picto-online-salons.svg'
import signPost from 'images/advices/picto-other-work-env.svg'
import clipboard from 'images/advices/picto-personality-test.svg'
import house from 'images/advices/picto-relocate.svg'
import target from 'images/advices/picto-reorient-jobbing.svg'
import jigsaw from 'images/advices/picto-reorient-to-close-job.svg'
import cloud from 'images/advices/picto-seasonal-relocate.svg'
import thumbsUpGreen from 'images/advices/picto-senior.svg'
import knightChess from 'images/advices/picto-skill-for-future.svg'
import gear from 'images/advices/picto-specific-to-job.svg'
import openLetter from 'images/advices/picto-spontaneous-application.svg'
import clipboardWithPen from 'images/advices/picto-vae.svg'
import hearts from 'images/advices/picto-volunteer.svg'


const pictosDict = {
  binocularsBlue,
  binocularsYellow,
  calendar,
  clipboard,
  clipboardWithPen,
  cloud,
  computer,
  discussion,
  documentStamped,
  drivingLicense,
  gear,
  handshake,
  headsetMic,
  hearts,
  hourglass,
  house,
  jigsaw,
  knightChess,
  letter,
  magnifyingGlass,
  megaphone,
  notepad,
  okHand,
  openLetter,
  raisedHand,
  rocket,
  ruler,
  signPost,
  suitcase,
  target,
  thumbsUpGreen,
  whiteBuilding,
  womanWithManyArms,
} as const

export type PictoID = keyof typeof pictosDict


type Props = {
  name: PictoID
  style?: React.CSSProperties
}


const Picto = (props: Props): React.ReactElement => {
  const {name, style} = props
  const image = pictosDict[name as PictoID] || defaultPicto
  return <img style={style} alt="" src={image} />
}


export default React.memo(Picto)
