type PluginColors = {[name in keyof typeof import('/tmp/bob_emploi/ali_colors.json')]: ConfigColor}
interface Colors extends CoreColors, PluginColors {}
