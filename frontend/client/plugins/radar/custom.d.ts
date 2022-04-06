
declare namespace configuration {
  interface Config {
    // The number of months before another photo should be taken.
    reminderDelayMonths: number
    // The base URL for the Radar form. It mays take additional query parameters.
    typeformUrl: string
  }
}
