import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '41kk82h2',
    dataset: 'production'
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: false,
    appId: 'fliahfm6f27v58m8k1d9hl43',
  }
})
