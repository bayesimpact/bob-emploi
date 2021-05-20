
type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T
export type HTTPResponse = Awaited<ReturnType<typeof fetch>>

export type HTTPRequest = Exclude<Parameters<typeof fetch>[1], undefined>

async function cleanHtmlError(response: HTTPResponse): Promise<string> {
  const errorMessage = await response.text()
  const page = document.createElement('html')
  page.innerHTML = errorMessage
  const content = page.getElementsByTagName('P') as HTMLCollectionOf<HTMLElement>
  return content.length && content[0].textContent || page.textContent || errorMessage
}

function hasErrorStatus(response: HTTPResponse): boolean {
  return response.status >= 400 || response.status < 200
}

export {cleanHtmlError, hasErrorStatus}
