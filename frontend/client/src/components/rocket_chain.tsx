import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import rocketIcon from 'images/rocket.svg'
import blackRocketIcon from 'images/rocket.svg?fill=#000'

import {getRocketFromStars, MAX_NUMBER_ROCKETS} from 'store/advice'


type ChainProps = {
  areEmptyRocketsShown?: boolean
  rocketHeight?: number
} & (
  {
    numRockets: number
    numStars?: number
  }
  |
  {
    numRockets?: never
    numStars: number
  }
)


interface SeveralRocketsProps {
  altText: string
  rocketIcon: string
  style: React.CSSProperties
  numRockets: number
}


const SeveralRocketsBase: React.FC<SeveralRocketsProps> =
(props: SeveralRocketsProps): React.ReactElement => {
  const {altText, rocketIcon, style, numRockets} = props
  return <React.Fragment>{new Array(Math.floor(numRockets)).fill(undefined).
    map((unused, index): React.ReactNode =>
      <img
        src={rocketIcon}
        style={style}
        key={`rocket-${index}`}
        alt={altText}
      />,
    )
  }</React.Fragment>
}
const SeveralRockets = React.memo(SeveralRocketsBase)


const RocketChainBase: React.FC<ChainProps> = (props: ChainProps): React.ReactElement => {
  const {areEmptyRocketsShown, numStars, numRockets, rocketHeight = 25} = props
  const numFilledRockets = numRockets || getRocketFromStars(numStars || 0)
  const fillStyle = useMemo(() => ({height: rocketHeight}), [rocketHeight])
  const paleStyle = useMemo(() => ({...fillStyle, opacity: 0.2}), [fillStyle])

  return <React.Fragment>
    <SeveralRockets
      altText="*" style={fillStyle} rocketIcon={rocketIcon} numRockets={numFilledRockets} />
    {areEmptyRocketsShown ? <SeveralRockets
      altText="" style={paleStyle} rocketIcon={blackRocketIcon}
      numRockets={MAX_NUMBER_ROCKETS - numFilledRockets} /> : null}
  </React.Fragment>
}
RocketChainBase.propTypes = {
  areEmptyRocketsShown: PropTypes.bool,
  numRockets: PropTypes.number,
  numStars: PropTypes.number,
  rocketHeight: PropTypes.number,
}
const RocketChain = React.memo(RocketChainBase)


export {RocketChain}
