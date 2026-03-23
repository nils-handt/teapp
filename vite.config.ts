/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Plugin, ResolvedConfig } from 'vite'
import ts from 'typescript'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const normalizedRootDir = rootDir.replace(/\\/g, '/')
const sqliteWasmName = 'sql-wasm.wasm'
const sqliteWasmSource = path.resolve(rootDir, `node_modules/sql.js/dist/${sqliteWasmName}`)
const tsConfigPath = path.resolve(rootDir, 'tsconfig.json')

const loadTypeScriptCompilerOptions = (): ts.CompilerOptions => {
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile)
  if (configFile.error) {
    throw new Error(ts.formatDiagnostic(configFile.error, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => ts.sys.newLine,
    }))
  }

  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir, undefined, tsConfigPath)
  if (parsedConfig.errors.length > 0) {
    throw new Error(ts.formatDiagnostics(parsedConfig.errors, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => ts.sys.newLine,
    }))
  }

  return {
    ...parsedConfig.options,
    noEmit: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    sourceMap: true,
  }
}

const testCompilerOptions = loadTypeScriptCompilerOptions()

const sandboxTypeScriptTransform = (): Plugin => ({
  name: 'sandbox-typescript-transform',
  enforce: 'pre',
  transform(code, id) {
    const [filePath] = id.split('?')
    const normalizedFilePath = filePath.replace(/\\/g, '/')
    if (!normalizedFilePath.startsWith(normalizedRootDir) || normalizedFilePath.includes('node_modules')) {
      return null
    }

    if (!/\.[cm]?tsx?$/.test(normalizedFilePath)) {
      return null
    }

    const result = ts.transpileModule(code, {
      compilerOptions: testCompilerOptions,
      fileName: normalizedFilePath,
      reportDiagnostics: false,
    })

    return {
      code: result.outputText,
      map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
    }
  },
})

const copySqliteAssets = (): Plugin => {
  let resolvedConfig: ResolvedConfig | undefined

  const copySqliteWasm = (destDir: string) => {
    if (!fs.existsSync(sqliteWasmSource)) {
      console.warn(`Could not find ${sqliteWasmName} at ${sqliteWasmSource}`)
      return
    }

    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(sqliteWasmSource, path.join(destDir, sqliteWasmName))
  }

  return {
    name: 'copy-sqlite-assets',
    configResolved(config) {
      resolvedConfig = config
    },
    configureServer() {
      copySqliteWasm(path.resolve(rootDir, 'public/assets'))
    },
    buildStart() {
      if (resolvedConfig?.command === 'build' && fs.existsSync(sqliteWasmSource)) {
        this.emitFile({
          type: 'asset',
          fileName: `assets/${sqliteWasmName}`,
          source: fs.readFileSync(sqliteWasmSource),
        })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isTestMode = mode === 'test'

  return {
    plugins: isTestMode ? [sandboxTypeScriptTransform(), copySqliteAssets()] : [react(), copySqliteAssets()],
    esbuild: isTestMode ? false : undefined,
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
      preserveSymlinks: isTestMode,
    },
    server: {
      port: 5173,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      }
    },
    base: './',
    build: {
      sourcemap: true,
    },
    optimizeDeps: {
      include: ['@ionic/react', '@ionic/react-router', 'ionicons'],
      exclude: ['@capacitor-community/sqlite', 'jeep-sqlite']
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/setupMocks.ts', './src/setupTests.ts'],
      server: {
        deps: {
          inline: ['@ionic/react', '@ionic/react-router', 'ionicons', '@stencil/core', 'tslib'],
        },
      },
    }
  }
})
