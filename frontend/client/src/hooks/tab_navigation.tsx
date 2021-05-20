import React, {useContext, useEffect, useState} from 'react'

const commonTabUsers = new Set(['input', 'select', 'textarea'])

const isTabNavigationUsed =
  (): boolean => new Set(document.documentElement.classList).has('keyboard-focus')

const TabNavigationContext = React.createContext(
  new Set(document.documentElement.classList).has('keyboard-focus'))

interface ProviderProps {
  children: React.ReactNode
}

const TabNavigationProvider = (props: ProviderProps): React.ReactElement => {
  const {children} = props
  const [hasUsedTab, setHasUsedTab] = useState<boolean>(isTabNavigationUsed)
  useEffect((): (() => void) => {
    function onKeyboardFocus(e: KeyboardEvent): void {
      if (e.keyCode !== 9 || commonTabUsers.has((e.target as HTMLElement).nodeName.toLowerCase())) {
        return
      }
      setHasUsedTab(true)
      document.documentElement.classList.remove('mouse-focus')
      document.documentElement.classList.add('keyboard-focus')
      document.removeEventListener('keydown', onKeyboardFocus, false)
    }

    document.documentElement.classList.add('mouse-focus')
    document.addEventListener('keydown', onKeyboardFocus, false)

    return (): void => {
      document.removeEventListener('keydown', onKeyboardFocus, false)
      document.documentElement.classList.remove('keyboard-focus')
      document.documentElement.classList.remove('mouse-focus')
    }
  }, [])
  return <TabNavigationContext.Provider value={hasUsedTab}>
    {children}
  </TabNavigationContext.Provider>
}

// Hook to check if the user has used tab navigation.
export function useIsTabNavigationUsed(): boolean {
  return useContext(TabNavigationContext)
}

export default React.memo(TabNavigationProvider)
