import HelpCircleIcon from 'mdi-react/HelpCircleIcon'
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import useTooltip from 'hooks/tooltip'
import {SmoothTransitions} from 'components/theme'


interface Props {
  children: React.ReactNode
  style?: React.CSSProperties
  tooltipWidth: number
}


const InformationIcon = (props: Props): React.ReactElement => {
  const {children, style, tooltipWidth} = props
  const {t} = useTranslation()
  const [delta, setDelta] = useState(0)
  const {isShown, containerProps, tooltipProps, triggerProps} = useTooltip()
  const finalStyle = useMemo((): React.CSSProperties => ({
    height: 16,
    verticalAlign: 'middle',
    ...style,
  }), [style])
  const toolTipStyle: React.CSSProperties = {
    alignItems: 'center',
    bottom: 'calc(100% + 5px)',
    display: 'flex',
    flexDirection: 'column',
    left: '50%',
    opacity: isShown ? 1 : 0,
    pointerEvents: isShown ? 'initial' : 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
    ...SmoothTransitions,
  }
  const childrenStyle: React.CSSProperties = {
    backgroundColor: colors.DARK_TWO,
    borderRadius: 2,
    color: '#fff',
    fontStyle: 'italic',
    padding: '8px 16px 8px 14px',
    textAlign: 'center',
    transform: `translate(${delta}px)`,
    width: tooltipWidth,
    ...SmoothTransitions,
  }
  const tooltipTailStyle: React.CSSProperties = {
    borderLeft: '10px solid transparent',
    borderRight: '10px solid transparent',
    borderTop: `5px solid ${colors.DARK_TWO}`,
    height: 0,
    width: 0,
  }

  // Move the tooltip if it's too close to the left border.
  const tooltipRef = useRef<HTMLDivElement>(null)
  useEffect((): void => {
    if (!tooltipRef.current) {
      return
    }
    const left = tooltipRef.current?.getBoundingClientRect()?.left
    if (left && left < 20) {
      setDelta(-left + 20)
    }
  }, [isShown])

  return <span {...containerProps} style={{position: 'relative'}}>
    <HelpCircleIcon
      style={finalStyle} aria-label={t("Plus d'information")} {...triggerProps} />
    <div style={toolTipStyle} ref={tooltipRef} {...tooltipProps}>
      <div style={childrenStyle}>{children}</div>
      <div style={tooltipTailStyle} />
    </div>
  </span>
}


export default React.memo(InformationIcon)
