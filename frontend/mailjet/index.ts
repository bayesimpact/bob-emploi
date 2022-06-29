import {promises as fs, existsSync} from 'fs'
import jsBeautify from 'js-beautify'
import stringify from 'json-stable-stringify'
import json2mjml from 'json2mjml'
import type {MJMLJsonObject, MJMLJsonWithChildren} from 'mjml-core'
import mjml from 'mjml'
import type {Email} from 'node-mailjet'
import nodeMailjet from 'node-mailjet'
import {URL, fileURLToPath} from 'url'

const templatesDir = new URL('./templates/', import.meta.url)

function connectToMailjet(): Email.Client {
  const apiKeyPublic = process.env.MAILJET_APIKEY_PUBLIC
  const apiKeyPrivate = process.env.MAILJET_SECRET
  if (!apiKeyPrivate || !apiKeyPublic) {
    throw new Error('Missing MAILJET_APIKEY_PUBLIC or MAILJET_SECRET')
  }
  return nodeMailjet.connect(apiKeyPublic, apiKeyPrivate)
}

function isMJMLJsonWithChildren(mjmlRoot: MJMLJsonObject): mjmlRoot is MJMLJsonWithChildren {
  return !!(mjmlRoot as MJMLJsonWithChildren).children
}

function beautifyHtml(html: string): string {
  return jsBeautify.html(html, {
    /* eslint-disable camelcase */
    indent_size: 2,
    max_preserve_newlines: 1,
    preserve_newlines: true,
    wrap_attributes_indent_size: 2,
    /* eslint-enable camelcase */
  })
}

interface PassportAttributes {
  passport?: {
    conditions?: readonly {
      operator: string
      varName: string
      varValue: string
    }[]
    hidden?: boolean
    id?: string
    oldContentEditor?: string
    oldMjAttributes?: string
    version?: string
  }
}

type MJMLPassportChild = MJMLJsonObject & {
  attributes: MJMLJsonObject['attributes'] & PassportAttributes
}

// Resolve Passport attributes:
//  - Drop out all nodes that are marked as hidden by Passport.
//  - Handle section conditions.
function resolvePassportAttributes(mjmlRoot: MJMLJsonObject): MJMLJsonObject {
  if (!isMJMLJsonWithChildren(mjmlRoot)) {
    return mjmlRoot
  }
  const childrenNode = mjmlRoot.children
  let hasChanges = false
  const resolvePassportAttributesChild = (child: MJMLJsonObject): MJMLJsonObject => {
    const updatedChild = resolvePassportAttributes(child)
    if (updatedChild !== child) {
      hasChanges = true
    }
    return updatedChild
  }
  const updatedChildren = childrenNode.flatMap((child): readonly MJMLJsonObject[] => {
    const {
      attributes: {
        passport: passportAttributes,
        ...otherAttributes
      } = {},
      ...otherChildProps
    } = child as MJMLPassportChild
    if (!passportAttributes) {
      return [resolvePassportAttributesChild(child)]
    }
    const {
      conditions, // taken into account below
      hidden, // taken into account below
      oldContentEditor, // ignore, we use git for history
      oldMjAttributes, // ignore, we use git for history
      id, // ignore, we don't track passport IDs
      version, // ignore, we don't track passport versions
      ...otherPassportAttributes
    } = passportAttributes
    if (hidden) {
      hasChanges = true
      return []
    }
    const hasOtherPassport = !!Object.keys(otherPassportAttributes).length
    const attributes = {
      ...otherAttributes,
      ...hasOtherPassport ? {passport: otherPassportAttributes} : {},
    } as MJMLJsonObject['attributes']
    const cleanChild =
      (conditions || hidden || oldContentEditor || oldMjAttributes || id || version) ? {
        attributes,
        ...otherChildProps,
      } : child
    if (conditions && conditions.length) {
      hasChanges = true
      const conditionsAsVars = conditions.map(
        ({operator, varName, varValue}) => `var:${varName}${operator}${stringify(varValue)}`)
      return [
        {attributes: {}, content: `{%if ${conditionsAsVars.join(' and ')}%}`, tagName: 'mj-raw'},
        resolvePassportAttributesChild(cleanChild),
        {attributes: {}, content: '{%endif%}', tagName: 'mj-raw'},
      ]
    }
    if (child !== cleanChild) {
      hasChanges = true
    }
    return [resolvePassportAttributesChild(cleanChild)]
  })
  if (!hasChanges) {
    return mjmlRoot
  }
  return {
    ...mjmlRoot,
    children: updatedChildren,
  }
}

async function readTemplateFile(template: string, filename: string): Promise<string> {
  return await fs.readFile(new URL(`./${template}/${filename}`, templatesDir), {encoding: 'utf8'})
}

async function writeTemplateFile(
  template: string, filename: string, content: string): Promise<void> {
  await fs.writeFile(new URL(`./${template}/${filename}`, templatesDir), content)
}

async function getMjml(template: string): Promise<string|MJMLJsonObject> {
  const input = await readTemplateFile(template, 'template.mjml')
  if (input.slice(0, 1) === '{') {
    return JSON.parse(input) as MJMLJsonObject
  }
  return input
}

function convertMjmlContentToHtml(content: string|MJMLJsonObject): string {
  const cleanMjml = (typeof content === 'string') ? content : resolvePassportAttributes(content)
  const hasNoNbsp = typeof content === 'string' && !content.includes('&nbsp;')
  const {html} = mjml(cleanMjml)
  return hasNoNbsp ? html.replace(/&nbsp;/g, '\u00A0').replace(/&#8202;/g, '\u200A') : html
}

type MJMLJsonObjectWithLocalInfo = MJMLJsonObject & {
  absoluteFilePath?: string
  children?: readonly MJMLJsonObject[]
  file?: string
  includedIn?: readonly unknown[]
  line?: number
}

function dropMjmlFileInfo(content: MJMLJsonObject): MJMLJsonObject {
  const {
    absoluteFilePath: omittedAbsoluteFilePath,
    children = undefined,
    file: omittedFile,
    includedIn: omittedIncludedIn,
    line: omittedLine,
    ...otherProps
  } = content as MJMLJsonObjectWithLocalInfo
  if (children) {
    return {...otherProps, children: children.map(dropMjmlFileInfo)}
  }
  return otherProps
}

function convertMjmlToJson(content: string|MJMLJsonObject): MJMLJsonObject {
  if (typeof content !== 'string') {
    return content
  }
  return dropMjmlFileInfo(mjml(content).json)
}

// Pattern to match mustache vars: e.g. "title={{var:foo}}" => "foo".
const mustacheVarsPattern = /(?<=[ ({]var:)\w+/g

async function updateVars(template: string, html: string): Promise<void> {
  const varsExample = JSON.parse(await readTemplateFile(template, 'vars-example.json'))
  const headers = JSON.parse(await readTemplateFile(template, 'headers.json'))
  const usedVars = new Set([
    ...html.matchAll(mustacheVarsPattern),
    ...headers.Subject.matchAll(mustacheVarsPattern),
  ].map(match => match[0]))
  usedVars.delete('senderName')
  const allVars = {
    ...Object.fromEntries([...usedVars].map(key => [key, null])),
    ...varsExample,
  }
  await writeTemplateFile(template, 'vars-example.json', stringify(allVars, {space: 2}) + '\n')
}

async function send(template: string): Promise<string> {
  const recipient = process.env.RECIPIENT
  if (!recipient) {
    throw new Error('No recipient defined.')
  }
  const headers = JSON.parse(await readTemplateFile(template, 'headers.json'))
  const mailjet = connectToMailjet()
  const html = convertMjmlContentToHtml(await getMjml(template))
  updateVars(template, html)
  if (!headers.SenderEmail) {
    throw new Error('No SenderEmail defined in headers.json')
  }
  const request = mailjet.post('send', {version: 'v3.1'}).request({Messages: [{
    From: {
      Email: headers.SenderEmail,
      Name: headers.SenderName,
    },
    HTMLPart: html,
    Subject: headers.Subject,
    TemplateErrorReporting: {Email: recipient},
    TemplateLanguage: true,
    To: [{Email: recipient}],
    TrackClicks: 'disabled',
    TrackOpens: 'disabled',
    Variables: {
      ...JSON.parse(await readTemplateFile(template, 'vars-example.json')),
      senderName: headers.SenderName,
    },
  }]})
  const result = await request
  return JSON.stringify(result.body)
}

interface TemplateDef {
  readonly mailjetTemplate: number
  readonly name: string
  readonly i18n?: {readonly [lang: string]: number}
}

async function getMailjetTemplates(): Promise<readonly TemplateDef[]> {
  const content = await fs.readFile(
    new URL('./templates/mailjet.json', import.meta.url), {encoding: 'utf8'})
  return JSON.parse(content)
}

interface TemplateDetailContent {
  Headers: Record<string, unknown>
  'Html-part': string
  MJMLContent: MJMLJsonObject
  'Text-part': string
}

async function download(template: string): Promise<void> {
  const mailjet = connectToMailjet()
  const mailjetTemplates = await getMailjetTemplates()
  const templateProps = mailjetTemplates.find(({name}) => name === template)
  if (!templateProps || !templateProps.mailjetTemplate) {
    throw new Error(`Unknown template (no data in mailjet.json): ${template}`)
  }
  const templateDir = new URL(`./${template}`, templatesDir)
  if (!existsSync(templateDir)) {
    await fs.mkdir(templateDir)
  }
  const request = mailjet.get('template', {version: 'v3'}).
    id(templateProps.mailjetTemplate + '').
    action('detailcontent').
    request()
  const response = await request
  const result = response.body
  if (result.Count !== 1) {
    throw new Error(stringify(result, {space: 2}))
  }
  const detailContent = result.Data[0] as TemplateDetailContent
  const html = detailContent['Html-part']
  updateVars(template, html)
  await writeTemplateFile(
    template, 'headers.json', stringify(detailContent.Headers, {space: 2}) + '\n')
  const mjmlXmlContent = json2mjml.default(detailContent.MJMLContent, 2)
  await writeTemplateFile(template, 'template.mjml', mjmlXmlContent + '\n')
  await writeTemplateFile(template, 'template.html', beautifyHtml(html))
}

async function updateTemplateContent(template: string, templateId: number): Promise<string> {
  const mailjet = connectToMailjet()
  const mjmlRaw = await getMjml(template)
  const html = convertMjmlContentToHtml(mjmlRaw)
  const mjmlContent = convertMjmlToJson(mjmlRaw)
  updateVars(template, html)
  const request = mailjet.post('template', {version: 'v3'}).
    id(templateId + '').
    action('detailcontent').
    request({
      'Headers': JSON.parse(await readTemplateFile(template, 'headers.json')),
      'Html-part': html,
      'MJMLContent': mjmlContent,
    })
  const result = await request
  return JSON.stringify(result.body)
}

async function upload(template: string): Promise<string> {
  const mailjetTemplates = await getMailjetTemplates()
  const templateProps = mailjetTemplates.find(({name}) => name === template)
  if (!templateProps || !templateProps.mailjetTemplate) {
    throw new Error(`Unknown template (no data in mailjet.json): ${template}`)
  }
  return updateTemplateContent(template, templateProps.mailjetTemplate)
}

async function mjmlToHtml(template: string): Promise<string> {
  const mjmlContent = await getMjml(template)
  const html = convertMjmlContentToHtml(mjmlContent)
  await writeTemplateFile(template, 'template.html', beautifyHtml(html) + '\n')
  updateVars(template, html)
  return html
}

async function checkHtml(template: string): Promise<string> {
  const mjmlContent = await getMjml(template)
  const cleanHtml = beautifyHtml(convertMjmlContentToHtml(mjmlContent)) + '\n'
  const existingHtml = await readTemplateFile(template, 'template.html')
  if (cleanHtml !== existingHtml) {
    throw new Error(`${template} HTML needs to be regenerated from MJML`)
  }
  return cleanHtml
}

async function cleanup(template: string): Promise<string> {
  const html = await readTemplateFile(template, 'template.html')
  await writeTemplateFile(template, 'template.html', beautifyHtml(html))

  const mjml = await getMjml(template)
  if (typeof mjml !== 'string') {
    const mjmlAsXml = beautifyHtml(json2mjml.default(mjml))
    await writeTemplateFile(
      template, 'template.mjml',
      mjmlAsXml + '\n',
    )
  }
  return html
}

interface TemplateCreateResponse {
  readonly Count: number
  readonly Data: readonly {
    readonly ID: number
  }[]
}

async function create(template: string): Promise<string> {
  const mailjetTemplates = await getMailjetTemplates()
  const templateProps = mailjetTemplates.find(({name}) => name === template)
  if (templateProps && templateProps.mailjetTemplate) {
    throw new Error(`Template already exists in mailjet.json: ${template}`)
  }

  const mailjet = connectToMailjet()
  const request = mailjet.post('template', {version: 'v3'}).
    request({
      EditMode: 1,
      Locale: 'fr_FR',
      Name: `DO NOT EDIT ${template}`,
    })
  const response = await request
  const result = response.body as TemplateCreateResponse
  if (result.Count !== 1) {
    throw new Error(stringify(result, {space: 2}))
  }
  const templateId = result.Data[0].ID

  await fs.writeFile(
    new URL('./templates/mailjet.json', import.meta.url),
    stringify([
      ...mailjetTemplates,
      {mailjetTemplate: templateId, name: template},
    ], {space: 2}) + '\n')

  return updateTemplateContent(template, templateId)
}

const actionHandlers = {
  checkHtml,
  cleanup,
  create,
  download,
  html: mjmlToHtml,
  send,
  upload,
} as const

// Actions that require API access and will be run sequentially instead of in parallel.
const mailjetApiActions = new Set(['create', 'download', 'send', 'upload'])
type FutureErrorArray = Promise<readonly (Error|null)[]>

async function main(action?: string, ...templates: readonly string[]): Promise<unknown> {
  if (action === 'list-actions') {
    console.log(` ${Object.keys(actionHandlers).join(' ')} `)
    return
  }
  const handler = action && actionHandlers[action as keyof typeof actionHandlers]
  if (!handler) {
    throw new Error(`Action must be one of ${Object.keys(actionHandlers)}, got "${action}"`)
  }
  if (!templates.length || !templates[0]) {
    throw new Error('Requires a template name')
  }
  if (templates.length === 1 && templates[0] === '*') {
    const allTemplates = await getMailjetTemplates()
    return main(action, ...allTemplates.map(({name}) => name))
  }
  const tryHandler = async (template: string): Promise<Error|null> => {
    try {
      await handler(template)
    } catch (error) {
      return error as Error
    }
    return null
  }
  const results = mailjetApiActions.has(action) ?
    // Run handler sequentially on templates and wait 2 to 5 seconds between each.
    await templates.reduce(async (prev: FutureErrorArray, template: string): FutureErrorArray => {
      const previousResults = await prev
      console.log(`${action} ${template}`)
      const result = await tryHandler(template)
      if (result) {
        console.log(result)
      }
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
      return [...previousResults, result]
    }, Promise.resolve([])) :
    // Run handler on templates in parallel.
    await Promise.all(templates.map(tryHandler))
  const errors = results.filter((error: Error|null): error is Error => !!error)
  if (errors.length === 1) {
    throw errors[0]
  } else if (errors.length) {
    throw new Error(`${errors.length} errors:\n` + errors.map(error => `${error}`).join('\n'))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(...process.argv.slice(2))
  } catch (error) {
    console.log(`Usage: index.ts <action> <template-name> [<template2-name> ...]\n${error}`)
  }
}
