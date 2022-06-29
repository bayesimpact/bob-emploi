import React, {useContext, useEffect, useState} from 'react'

const commonTabUsers = new Set(['input', 'select', 'textarea'])

const isTabNavigationUsed = (): boolean|undefined => {
  const documentClasses = new Set(document.documentElement.classList)
  if (documentClasses.has('keyboard-focus')) {
    return true
  }
  if (documentClasses.has('mouse-focus')) {
    return false
  }
  return undefined
}

const TabNavigationContext = React.createContext(isTabNavigationUsed())

interface ProviderProps {
  children: React.ReactNode
}

const TabNavigationProvider = (props: ProviderProps): React.ReactElement => {
  const {children} = props
  const [hasUsedTab, setHasUsedTab] = useState<boolean|undefined>(isTabNavigationUsed)
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

    setHasUsedTab(hadUsedTab => hadUsedTab || false)
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
export function useIsTabNavigationUsed(defaultIfNoProvider = false): boolean {
  const contextValue = useContext(TabNavigationContext)
  if (contextValue === undefined) {
    return defaultIfNoProvider
  }
  return contextValue
}

export default React.memo(TabNavigationProvider)
