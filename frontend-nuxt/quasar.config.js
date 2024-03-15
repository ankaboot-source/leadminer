/* eslint-env node */

/*
 * This file runs in a Node context (it's NOT transpiled by Babel), so use only
 * the ES6 features that are supported by your Node version. https://node.green/
 */

// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

/* eslint func-names: 0 */
/* eslint global-require: 0 */

const { configure } = require('quasar/wrappers');

// This will load from `.env` if it exists, but not override existing `process.env.*` values
require('dotenv').config();
// process.env now contains the terminal variables and the ones from the .env file
// Precedence:
//   1. Environment variables (API_URL=https://api.com quasar build)
//   2. `.env` file

module.exports = configure((/* ctx */) => ({
  eslint: {
    // fix: true,
    // include: [],
    // exclude: [],
    // rawOptions: {},
    warnings: true,
    errors: true,
  },

  // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
  // preFetch: true,

  // app boot file (/src/boot)
  // --> boot files are part of "main.js"
  // https://v2.quasar.dev/quasar-cli-vite/boot-files
  boot: ['axios'],

  // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
  css: ['src/css/app.scss'],

  // https://github.com/quasarframework/quasar/tree/dev/extras
  extras: [
    // "ionicons-v4",
    'mdi-v5',
    'fontawesome-v5',
    // "eva-icons",
    // "themify",
    // "line-awesome",
    // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

    'roboto-font', // optional, you are not bound to it
    'material-icons', // optional, you are not bound to it
  ],

  // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
  build: {
    target: {
      browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      node: 'node16',
    },

    beforeBuild() {
      /**
       * This hook runs before Quasar builds the app for production.
       * It addresses the error "ENOENT: no such file or directory" that breaks the build
       * process due to the initial absence of billing module files. If the module or its containing
       * directory is missing, create an empty version of them.
       */
      const fs = require('fs');
      const path = require('path');

      const billingFiles = [
        // Add more file paths as needed
        path.resolve(__dirname, 'src/billing/pages/CreditsRefillSuccess.vue'),
      ];

      billingFiles.forEach((billingFilePath) => {
        const billingDirectoryPath = path.dirname(billingFilePath);

        if (!fs.existsSync(billingDirectoryPath)) {
          fs.mkdirSync(billingDirectoryPath, { recursive: true });
        }

        if (!fs.existsSync(billingFilePath)) {
          const placeholderModuleContent = `<script>\nthrow new Error("Billing module '${billingFilePath}' is missing.")\n</script>;`;
          fs.writeFileSync(billingFilePath, placeholderModuleContent, 'utf-8');
        }
      });
    },

    vueRouterMode: 'history', // available values: 'hash', 'history'
    // vueRouterBase,
    // vueDevtools,
    // vueOptionsAPI: false,

    // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

    // publicPath: '/',
    // analyze: true,
    env: {
      SERVER_ENDPOINT: process.env.SERVER_ENDPOINT,
      SUPABASE_PROJECT_URL: process.env.SUPABASE_PROJECT_URL,
      SUPABASE_MAX_ROWS: parseInt(process.env.SUPABASE_MAX_ROWS),
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      AVERAGE_EXTRACTION_RATE: parseInt(process.env.AVERAGE_EXTRACTION_RATE),
      BANNER_IMAGE_URL: process.env.BANNER_IMAGE_URL,
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
      POSTHOG_INSTANCE_ADDRESS: process.env.POSTHOG_INSTANCE_ADDRESS,
      ENABLE_CREDIT: process.env.ENABLE_CREDIT,
      EXTERNAL_REFILL_CREDITS_LINK: process.env.EXTERNAL_REFILL_CREDITS_LINK,
    },
    // rawDefine: {}
    // ignorePublicFolder: true,
    // minify: false,
    // polyfillModulePreload: true,
    // distDir

    // extendViteConf (viteConf) {},
    // viteVuePluginOptions: {},

    // vitePlugins: [
    //   [ 'package-name', { ..options.. } ]
    // ]
  },

  // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
  devServer: {
    // https: true
    open: true, // opens browser window automatically
    port: 8082,
  },

  // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
  framework: {
    config: {},

    iconSet: 'mdi-v5', // Quasar icon set
    // lang: 'en-US', // Quasar language pack

    // For special cases outside of where the auto-import strategy can have an impact
    // (like functional components as one of the examples),
    // you can manually specify Quasar components/directives to be available everywhere:
    //
    // components: [],
    // directives: [],

    // Quasar plugins
    plugins: [
      'AppFullscreen',
      'Dialog',
      'Notify',
      'SessionStorage',
      'LocalStorage',
      'Cookies',
    ],
  },

  // animations: 'all', // --- includes all animations
  // https://v2.quasar.dev/options/animations
  animations: ['fadeIn', 'fadeOut'],

  // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
  // sourceFiles: {
  //   rootComponent: 'src/App.vue',
  //   router: 'src/router/index',
  //   store: 'src/store/index',
  //   registerServiceWorker: 'src-pwa/register-service-worker',
  //   serviceWorker: 'src-pwa/custom-service-worker',
  //   pwaManifestFile: 'src-pwa/manifest.json',
  //   electronMain: 'src-electron/electron-main',
  //   electronPreload: 'src-electron/electron-preload'
  // },

  // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
  ssr: {
    // ssrPwaHtmlFilename: 'offline.html', // do NOT use index.html as name!
    // will mess up SSR

    // extendSSRWebserverConf (esbuildConf) {},
    // extendPackageJson (json) {},

    pwa: false,

    // manualStoreHydration: true,
    // manualPostHydrationTrigger: true,

    prodPort: 3000, // The default port that the production server should use
    // (gets superseded if process.env.PORT is specified at runtime)

    middlewares: [
      'render', // keep this as last one
    ],
  },

  // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
  pwa: {
    workboxMode: 'generateSW', // or 'injectManifest'
    injectPwaMetaTags: true,
    swFilename: 'sw.js',
    manifestFilename: 'manifest.json',
    useCredentialsForManifestTag: false,
    // useFilenameHashes: true,
    // extendGenerateSWOptions (cfg) {}
    // extendInjectManifestOptions (cfg) {},
    // extendManifestJson (json) {}
    // extendPWACustomSWConf (esbuildConf) {}
  },

  // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
  cordova: {
    // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
  },

  // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
  capacitor: {
    hideSplashscreen: true,
  },

  // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
  electron: {
    // extendElectronMainConf (esbuildConf)
    // extendElectronPreloadConf (esbuildConf)

    inspectPort: 5858,

    bundler: 'packager', // 'packager' or 'builder'

    packager: {
      // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
      // OS X / Mac App Store
      // appBundleId: '',
      // appCategoryType: '',
      // osxSign: '',
      // protocol: 'myapp://path',
      // Windows only
      // win32metadata: { ... }
    },

    builder: {
      // https://www.electron.build/configuration/configuration

      appId: 'frontend-vite',
    },
  },

  // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
  bex: {
    contentScripts: ['my-content-script'],

    // extendBexScriptsConf (esbuildConf) {}
    // extendBexManifestJson (json) {}
  },
}));
