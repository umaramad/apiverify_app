const fs = require('fs')
const path = require('path')

function getResourcesDir(context) {
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`
    return path.join(context.appOutDir, appName, 'Contents', 'Resources')
  }
  return path.join(context.appOutDir, 'resources')
}

function getFrameworkLibrariesDir(context) {
  if (context.electronPlatformName !== 'darwin') return null
  const appName = `${context.packager.appInfo.productFilename}.app`
  return path.join(
    context.appOutDir,
    appName,
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'A',
    'Libraries'
  )
}

function rmIfExists(target, label) {
  if (!fs.existsSync(target)) return
  fs.rmSync(target, { recursive: true, force: true })
  console.log('  • pruned', label || path.basename(target))
}

/**
 * Strip optional Electron/runtime bulk that portable builds do not need.
 * Keeps the app runnable while targeting a portable zip budget of ~95MB.
 */
module.exports = async function afterPack(context) {
  const resourcesDir = getResourcesDir(context)
  const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked')

  // --- better-sqlite3 build leftovers ---
  if (fs.existsSync(unpackedDir)) {
    const sqliteRoot = path.join(unpackedDir, 'node_modules/better-sqlite3')
    const prunePaths = [
      path.join(sqliteRoot, 'build/Release/obj'),
      path.join(sqliteRoot, 'build/Release/test_extension.node'),
      path.join(sqliteRoot, 'build/deps'),
      path.join(sqliteRoot, 'deps'),
      path.join(sqliteRoot, 'src'),
      path.join(sqliteRoot, 'prebuilds'),
    ]
    for (const target of prunePaths) {
      rmIfExists(target, path.relative(unpackedDir, target))
    }

    // cpu-features ships large .inl sources unused at runtime
    rmIfExists(
      path.join(unpackedDir, 'node_modules/cpu-features/deps'),
      'node_modules/cpu-features/deps'
    )
  }

  // --- Replace oversized generated icons with lean build assets when available ---
  const leanIcns = path.join(context.packager.projectDir, 'build/icon.icns')
  const packagedIcns = path.join(resourcesDir, 'icon.icns')
  if (fs.existsSync(leanIcns) && fs.existsSync(packagedIcns)) {
    const before = fs.statSync(packagedIcns).size
    const lean = fs.statSync(leanIcns).size
    if (lean < before) {
      fs.copyFileSync(leanIcns, packagedIcns)
      console.log(
        `  • replaced icon.icns (${(before / 1024 / 1024).toFixed(2)}MB → ${(lean / 1024 / 1024).toFixed(2)}MB)`
      )
    }
  }

  const leanPng = path.join(context.packager.projectDir, 'build/icon.png')
  const packagedPng = path.join(resourcesDir, 'app.asar.unpacked/resources/icon.png')
  if (fs.existsSync(leanPng) && fs.existsSync(packagedPng)) {
    const before = fs.statSync(packagedPng).size
    const lean = fs.statSync(leanPng).size
    if (lean < before) {
      fs.copyFileSync(leanPng, packagedPng)
      console.log(
        `  • replaced unpacked icon.png (${(before / 1024).toFixed(0)}KB → ${(lean / 1024).toFixed(0)}KB)`
      )
    }
  }

  // --- Optional Electron libraries (Vulkan software renderer is large and unused by this app) ---
  const libsDir = getFrameworkLibrariesDir(context)
  if (libsDir) {
    rmIfExists(path.join(libsDir, 'libvk_swiftshader.dylib'), 'libvk_swiftshader.dylib')
    rmIfExists(path.join(libsDir, 'vk_swiftshader_icd.json'), 'vk_swiftshader_icd.json')
  } else if (context.electronPlatformName === 'win32') {
    rmIfExists(path.join(context.appOutDir, 'vk_swiftshader.dll'), 'vk_swiftshader.dll')
    rmIfExists(path.join(context.appOutDir, 'vk_swiftshader_icd.json'), 'vk_swiftshader_icd.json')
  } else if (context.electronPlatformName === 'linux') {
    rmIfExists(path.join(context.appOutDir, 'libvk_swiftshader.so'), 'libvk_swiftshader.so')
    rmIfExists(path.join(context.appOutDir, 'vk_swiftshader_icd.json'), 'vk_swiftshader_icd.json')
  }

  // --- Electron runtime slimming (macOS only) -------------------------------
  // Verified-safe removals only. The ANGLE GL stack (libGLESv2/libEGL) is
  // lazily dlopened and not hard-linked into the Electron Framework binary;
  // the crashpad handler is a standalone tool spawned only by an initialized
  // crash reporter (this app never starts one). NOTE: the GPU/Plugin helper
  // .app bundles and libffmpeg.dylib MUST stay — Chromium requires the GPU
  // helper in bundle mode (removing it traps at launch) and the framework
  // hard-links libffmpeg and Squirrel.framework (dyld aborts if missing).
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`
    const frameworksDir = path.join(context.appOutDir, appName, 'Contents', 'Frameworks')
    const frameworkRoot = path.join(
      frameworksDir,
      'Electron Framework.framework',
      'Versions',
      'A'
    )

    // ANGLE GL stack — lazily dlopened, unused when the GPU process falls back
    // to SwiftShader software rendering.
    const libsDir = getFrameworkLibrariesDir(context)
    if (libsDir) {
      rmIfExists(path.join(libsDir, 'libGLESv2.dylib'), 'libGLESv2.dylib')
      rmIfExists(path.join(libsDir, 'libEGL.dylib'), 'libEGL.dylib')
      // libffmpeg.dylib is intentionally kept: the framework hard-links it.
    }

    // Crash reporter is never started (processErrors uses process.on only).
    rmIfExists(
      path.join(frameworkRoot, 'Helpers', 'chrome_crashpad_handler'),
      'chrome_crashpad_handler'
    )
  }

  // License text blobs (not required to run)
  const licenseCandidates = [
    path.join(context.appOutDir, 'LICENSES.chromium.html'),
    path.join(context.appOutDir, 'LICENSE.electron.txt'),
    path.join(resourcesDir, 'LICENSES.chromium.html'),
    path.join(resourcesDir, 'LICENSE.electron.txt'),
  ]
  if (context.electronPlatformName === 'darwin') {
    const appName = `${context.packager.appInfo.productFilename}.app`
    licenseCandidates.push(
      path.join(context.appOutDir, appName, 'Contents', 'Resources', 'LICENSES.chromium.html')
    )
  }
  for (const target of licenseCandidates) {
    rmIfExists(target)
  }
}
