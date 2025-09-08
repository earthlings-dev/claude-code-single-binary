#!/usr/bin/env bun

/**
 * Prepare the CLI for bundling using Bun's native embedding features
 * This modifies the source to use embedded files directly
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Read the original CLI file
const cliPath = './cli.js';
let cliContent = readFileSync(cliPath, 'utf-8');

console.log('Preparing CLI for native Bun embedding...');

// 1. Build list of embedded imports based on what files actually exist
const embeddedImports = [];
const embeddedFilesMapping = [];

// Define all possible ripgrep files
const ripgrepFiles = [
  { path: './vendor/ripgrep/arm64-darwin/rg', var: '__embeddedRgDarwinArm64' },
  { path: './vendor/ripgrep/arm64-darwin/ripgrep.node', var: '__embeddedRgNodeDarwinArm64' },
  { path: './vendor/ripgrep/arm64-linux/rg', var: '__embeddedRgLinuxArm64' },
  { path: './vendor/ripgrep/arm64-linux/ripgrep.node', var: '__embeddedRgNodeLinuxArm64' },
  { path: './vendor/ripgrep/x64-darwin/rg', var: '__embeddedRgDarwinX64' },
  { path: './vendor/ripgrep/x64-darwin/ripgrep.node', var: '__embeddedRgNodeDarwinX64' },
  { path: './vendor/ripgrep/x64-linux/rg', var: '__embeddedRgLinuxX64' },
  { path: './vendor/ripgrep/x64-linux/ripgrep.node', var: '__embeddedRgNodeLinuxX64' },
  { path: './vendor/ripgrep/x64-win32/rg.exe', var: '__embeddedRgWin32' },
  { path: './vendor/ripgrep/x64-win32/ripgrep.node', var: '__embeddedRgNodeWin32' },
];

// Always include yoga.wasm
if (existsSync('./yoga.wasm')) {
  embeddedImports.push('import __embeddedYogaWasm from "./yoga.wasm" with { type: "file" };');
  embeddedFilesMapping.push("  'yoga.wasm': __embeddedYogaWasm,");
} else {
  console.error('Warning: yoga.wasm not found');
}

// Only import ripgrep files that exist
for (const file of ripgrepFiles) {
  if (existsSync(file.path)) {
    embeddedImports.push(`import ${file.var} from "${file.path}" with { type: "file" };`);
    const key = file.path.replace('./', '');
    embeddedFilesMapping.push(`  '${key}': ${file.var},`);
  }
}

const embeddedCode = `
// Embedded files using Bun's native embedding
${embeddedImports.join('\n')}

const __embeddedFiles = {
${embeddedFilesMapping.join('\n')}
};

// Safe platform detection helper
function __getSafePlatform() {
  try {
    const p = typeof process !== 'undefined' ? process : {};
    const arch = (p.arch || 'x64').toString();
    const platform = (p.platform || 'win32').toString();
    return { arch, platform };
  } catch (e) {
    return { arch: 'x64', platform: 'win32' };
  }
}

`;

// Add imports after the shebang
const shebangMatch = cliContent.match(/^#!.*\n/);
if (shebangMatch) {
  cliContent = shebangMatch[0] + embeddedCode + cliContent.substring(shebangMatch[0].length);
} else {
  cliContent = embeddedCode + cliContent;
}

// 2. Handle common yoga.wasm loading patterns in minified code
// 2a. new URL('./yoga.wasm', import.meta.url) -> embedded file URL
const yogaUrlPattern = /new\s+URL\(\s*(["'])\.\/yoga\.wasm\1\s*,\s*import\.meta\.url\s*\)/g;
if (yogaUrlPattern.test(cliContent)) {
  cliContent = cliContent.replace(
    yogaUrlPattern,
    "(typeof Bun!=='undefined' && Bun.pathToFileURL ? Bun.pathToFileURL(__embeddedFiles?.['yoga.wasm']) : new URL('./yoga.wasm', import.meta.url))"
  );
  console.log('✓ Patched new URL(yoga.wasm, import.meta.url) to embedded file URL');
}

// 2b. Any <something>.resolve('./yoga.wasm') -> embedded file path (keep import specifier strings intact)
const yogaResolvePattern = /\b[\w$]+\s*\.\s*resolve\s*\(\s*(["'])\.\/yoga\.wasm\1\s*\)/g;
if (yogaResolvePattern.test(cliContent)) {
  cliContent = cliContent.replace(
    yogaResolvePattern,
    "(__embeddedFiles && __embeddedFiles['yoga.wasm'] || './yoga.wasm')"
  );
  console.log('✓ Patched resolver for yoga.wasm to embedded file path');
}

// 3. Replace ripgrep path resolution
// Add check for embedded files in the ripgrep resolver
const ripgrepPattern = /let B=Db\.resolve\(et9,"vendor","ripgrep"\);/;
const ripgrepReplacement = `
if(process.env.CLAUDE_CODE_BUNDLED || typeof __embeddedFiles !== 'undefined'){
  try {
    const safePlatform = __getSafePlatform();
    const platform = safePlatform.platform === "win32" ? "x64-win32" : (safePlatform.arch + "-" + safePlatform.platform);
    const rgKey = "vendor/ripgrep/" + platform + "/rg" + (safePlatform.platform === "win32" ? ".exe" : "");
    if(typeof __embeddedFiles !== 'undefined' && __embeddedFiles && __embeddedFiles[rgKey]) {
      return __embeddedFiles[rgKey];
    }
  } catch(e) {
    if(typeof console !== 'undefined' && console.error) {
      console.error("Error loading embedded ripgrep:", e);
    }
  }
}
let B=Db.resolve(et9,"vendor","ripgrep");`;

if (ripgrepPattern.test(cliContent)) {
  cliContent = cliContent.replace(ripgrepPattern, ripgrepReplacement);
  console.log('✓ Added embedded file handling for ripgrep');
}

// 4. Replace ripgrep.node loading - handle the entire if-else structure
// Look for the complete if-else pattern where B is assigned
const ripgrepNodePattern = /if\(typeof Bun!=="undefined"&&Bun\.embeddedFiles\?\.length>0\)B="\.\/ripgrep\.node";else/;
const ripgrepNodeReplacement = `if(typeof Bun!=="undefined"&&Bun.embeddedFiles?.length>0)B=(()=>{
  const platform = process.platform === "win32" ? "x64-win32" : \`\${process.arch}-\${process.platform}\`;
  const nodeKey = \`vendor/ripgrep/\${platform}/ripgrep.node\`;
  return __embeddedFiles[nodeKey] || "./ripgrep.node";
})();else`;

if (ripgrepNodePattern.test(cliContent)) {
  cliContent = cliContent.replace(ripgrepNodePattern, ripgrepNodeReplacement);
  console.log('✓ Added embedded file handling for ripgrep.node');
} else {
  // Fallback to simpler pattern if the exact pattern doesn't match
  const simplePattern = /B="\.\/ripgrep\.node"/;
  if (simplePattern.test(cliContent)) {
    cliContent = cliContent.replace(simplePattern, `B=(()=>{
      const platform = process.platform === "win32" ? "x64-win32" : \`\${process.arch}-\${process.platform}\`;
      const nodeKey = \`vendor/ripgrep/\${platform}/ripgrep.node\`;
      return __embeddedFiles[nodeKey] || "./ripgrep.node";
    })()`);
    console.log('✓ Added embedded file handling for ripgrep.node (fallback pattern)');
  }
}

// Set bundled mode indicator
cliContent = cliContent.replace(
  /process\.env\.CLAUDE_CODE_ENTRYPOINT="cli"/,
  'process.env.CLAUDE_CODE_ENTRYPOINT="cli";process.env.CLAUDE_CODE_BUNDLED="1"'
);

// 5. Bypass POSIX shell requirement check
// Original: Throws error if no suitable shell found
// Replace the shell validation to always succeed
const shellCheckPattern = /let J=W\.find\(\(F\)=>F&&cw0\(F\)\);if\(!J\)\{let F="No suitable shell found\. Claude CLI requires a Posix shell environment\. Please ensure you have a valid shell installed and the SHELL environment variable set\.";throw h1\(new Error\(F\)\),new Error\(F\)\}/;

// Simple replacement that always provides a shell
const shellCheckReplacement = `let J=W.find((F)=>F&&cw0(F));if(!J){J=process.platform==="win32"?"cmd.exe":"/bin/sh"}`;

if (shellCheckPattern.test(cliContent)) {
  cliContent = cliContent.replace(shellCheckPattern, shellCheckReplacement);
  console.log('✓ Bypassed POSIX shell requirement check');
} else {
  console.warn('Warning: Could not find POSIX shell check pattern - trying alternative approach');
  
  // Alternative: Replace just the error throwing part
  const altPattern = /if\(!J\)\{let F="No suitable shell found\. Claude CLI requires a Posix shell environment\. Please ensure you have a valid shell installed and the SHELL environment variable set\.";throw h1\(new Error\(F\)\),new Error\(F\)\}/;
  const altReplacement = 'if(!J){J=process.platform==="win32"?"cmd.exe":"/bin/sh"}';
  
  if (altPattern.test(cliContent)) {
    cliContent = cliContent.replace(altPattern, altReplacement);
    console.log('✓ Bypassed POSIX shell requirement check (alternative method)');
  }
}

// Write the modified content
const outputPath = './cli-native-bundled.js';
writeFileSync(outputPath, cliContent);

console.log(`\n✅ Created ${outputPath} ready for bundling with native embedding`);
console.log('\nNow you can run:');
console.log(`  bun build --compile --minify ./cli-native-bundled.js --outfile dist/claude-code`); 
