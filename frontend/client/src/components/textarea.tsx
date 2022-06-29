import React, {useCallback, useImperativeHandle, useRef} from 'react'

import type {Inputable} from 'components/input'


type HTMLTextAreaProps = React.HTMLProps<HTMLTextAreaElement>
interface Props extends Omit<HTMLTextAreaProps, 'onChange' | 'ref'> {
  onChange?: (inputValue: string) => void
}


const Textarea = (props: Props, ref: React.Ref<Inputable>): React.ReactElement => {
  const {onChange, ...otherProps} = props

  const dom = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, (): Inputable => ({
    blur: (): void => dom.current?.blur(),
    focus: (): void => dom.current?.focus(),
    select: (): void => dom.current?.select(),
  }))

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation()
    onChange?.(event.target.value || '')
  }, [onChange])

  return <textarea {...otherProps} onChange={onChange && handleChange} ref={dom} />
}


export default React.memo(React.forwardRef(Textarea))
