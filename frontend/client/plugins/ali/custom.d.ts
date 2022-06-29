declare namespace color {
  type PluginColors =
    Record<keyof typeof import('/tmp/bob_emploi/ali_colors.json'), import('config').ConfigColor>
  // The interface is actually extended with CoreColors in frontend/client/custom.d.ts.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Colors extends PluginColors {}
}
