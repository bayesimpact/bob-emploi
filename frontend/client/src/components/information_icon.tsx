import _uniqueId from 'lodash/uniqueId'
import HelpCircleIcon from 'mdi-react/HelpCircleIcon'
import React, {useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import useTooltip from 'hooks/tooltip'
import {SmoothTransitions} from 'components/theme'


interface Props {
  'aria-describedby'?: string
  children: React.ReactNode
  style?: React.CSSProperties
  tooltipWidth: number
}


const InformationIcon = (props: Props): React.ReactElement => {
  const {'aria-describedby': ariaDescribedby, children, style, tooltipWidth} = props
  const {t} = useTranslation('components')
  const [delta, setDelta] = useState(0)
  const {isShown, containerProps, tooltipProps, triggerProps} = useTooltip({
    'aria-describedby': ariaDescribedby,
    'isTriggeredByClick': true,
  })
  const finalStyle = useMemo((): React.CSSProperties => ({
    height: 16,
    verticalAlign: 'middle',
    ...style,
  }), [style])
  const toolTipStyle: React.CSSProperties = {
    alignItems: 'center',
    bottom: '100%',
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
    margin: 0,
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
  const contentId = useMemo(_uniqueId, [])

  return <div {...containerProps} style={{display: 'inline', padding: 5, position: 'relative'}}>
    <button aria-label={t("Plus d'information")} {...triggerProps} style={finalStyle}>
      <HelpCircleIcon aria-hidden={true} focusable={false} size={16} />
    </button>
    <div style={toolTipStyle} ref={tooltipRef} {...tooltipProps}>
      <p style={childrenStyle} id={contentId}>{children}</p>
      <div style={tooltipTailStyle} />
    </div>
  </div>
}


export default React.memo(InformationIcon)
