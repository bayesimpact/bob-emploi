type JobflixColors = {
  [name in keyof typeof import('/tmp/bob_emploi/jobflix_colors.json')]: ConfigColor
}
interface Colors extends CoreColors, JobflixColors {}
