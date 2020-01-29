// ATTENTION: Keep in sync with frontend/release/nginx.conf.
module.exports = {
  'app': {
    entry: './src/entry',
    htmlFilename: 'index.html',
    usesHotLoader: true,
  },
  'bootstrap': {
    entry: './src/bootstrap_entry',
    htmlFilename: 'bootstrap.html',
    rewrite: /^\/conseiller\/(nouveau-profil-et-projet|ressources)/,
    usesHotLoader: true,
  },
  'eval': {
    entry: './src/eval_entry',
    htmlFilename: 'eval.html',
    rewrite: /^\/eval($|\/)/,
    usesHotLoader: true,
  },
  'import-from-imilo': {
    entry: './src/import-from-imilo/entry',
  },
  'mini-onboarding': {
    entry: './src/mini_onboarding_entry',
    htmlFilename: 'mini-onboarding.html',
    rewrite: /^\/(mini|unml\/a-li)/,
    usesHotLoader: true,
  },
  'nps': {
    entry: './src/components/pages/nps',
    htmlFilename: 'nps.html',
    rewrite: /^\/retours$/,
  },
  'statusUpdate': {
    entry: './src/components/pages/status_update',
    htmlFilename: 'statut.html',
    rewrite: /^\/statut($|\/)/,
  },
  'unsubscribe': {
    entry: './src/components/pages/unsubscribe',
    htmlFilename: 'unsubscribe.html',
    rewrite: /^\/unsubscribe/,
  },
}
