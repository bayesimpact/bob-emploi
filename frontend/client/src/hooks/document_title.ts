import {useEffect} from 'react'

const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    // Update the title.
    for (const titleElement of document.getElementsByTagName('title')) {
      titleElement.textContent = title
    }
  }, [title])
}

export default useDocumentTitle
