const pluginConfig = {
  customTransComponents: [['components/i18n', 'Trans']],
  defaultContexts: [''],
  discardOldKeys: true,
  keySeparator: null,
  nsSeparator: null,
  outputPath: 'src/translations/{{locale}}/{{ns}}.json',
  tFunctionNames: ['prepareT', 't'],
  useI18nextDefaultValue: ['fr'],
}

module.exports = {
  extends: './.babelrc',
  overrides: [
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'advisor'}]],
      test: ['src/components/advisor/*', 'src/components/advisor.tsx'],
    },
    {
      plugins: [['i18next-extract', {...pluginConfig, defaultNS: 'staticAdvice'}]],
      test: 'src/components/pages/static/static_advice/*',
    },
  ],
  plugins: [['i18next-extract', pluginConfig]],
}
