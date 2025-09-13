import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { join } from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: join(__dirname, 'assets', 'icon'),
    appBundleId: 'com.tacctile.ghosthunter',
    appCategoryType: 'public.app-category.utilities',
    win32metadata: {
      CompanyName: 'Tacctile',
      FileDescription: 'Ghost Hunter Toolbox Desktop Application',
      OriginalFilename: 'GhostHunterToolbox.exe',
      ProductName: 'Ghost Hunter Toolbox',
      InternalName: 'ghosthunter'
    },
    protocols: [
      {
        name: 'Ghost Hunter Protocol',
        schemes: ['ghost-hunter']
      }
    ],
    extraResource: [
      join(__dirname, 'assets'),
      join(__dirname, 'src', 'assets', 'fonts')
    ]
  },
  rebuildConfig: {
    skip: () => true
  },
  makers: [
    new MakerSquirrel({
      name: 'GhostHunterToolbox',
      authors: 'Tacctile',
      exe: 'GhostHunterToolbox.exe',
      description: 'Professional ghost hunting evidence analysis and investigation management',
      setupIcon: join(__dirname, 'assets', 'icon.ico'),
      noMsi: true
    }),
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
    new MakerRpm({
      options: {
        name: 'ghost-hunter-toolbox',
        productName: 'Ghost Hunter Toolbox',
        genericName: 'Ghost Hunting Software',
        description: 'Professional ghost hunting evidence analysis',
        version: '1.0.0',
        license: 'MIT',
        icon: join(__dirname, 'assets', 'icon.png'),
        categories: ['Utility', 'AudioVideo']
      }
    }),
    new MakerDeb({
      options: {
        name: 'ghost-hunter-toolbox',
        productName: 'Ghost Hunter Toolbox',
        genericName: 'Ghost Hunting Software',
        description: 'Professional ghost hunting evidence analysis',
        version: '1.0.0',
        section: 'utils',
        priority: 'optional',
        icon: join(__dirname, 'assets', 'icon.png'),
        categories: ['Utility', 'AudioVideo'],
        mimeType: ['x-scheme-handler/ghost-hunter']
      }
    })
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
