import fs from 'fs-extra';
import path from 'path';

const LANGUAGES = [
  { name: 'typescript', ext: 'ts', importStmt: 'import { utils } from "./core/utils";' },
  { name: 'javascript', ext: 'js', importStmt: 'import { utils } from "./core/utils.js";' },
  { name: 'python', ext: 'py', importStmt: 'from .core import utils' },
  { name: 'go', ext: 'go', importStmt: 'import "./core"' },
  { name: 'rust', ext: 'rs', importStmt: 'mod core { pub mod utils; }' },
  { name: 'java', ext: 'java', importStmt: 'import core.utils;' },
  { name: 'ruby', ext: 'rb', importStmt: 'require_relative "core/utils"' },
  { name: 'php', ext: 'php', importStmt: 'use core\\utils;' },
  { name: 'c', ext: 'c', importStmt: '#include "core/utils.h"' },
  { name: 'cpp', ext: 'cpp', importStmt: '#include "core/utils.h"' },
  { name: 'csharp', ext: 'cs', importStmt: 'using core.utils;' },
  { name: 'kotlin', ext: 'kt', importStmt: 'import core.utils' },
  { name: 'scala', ext: 'scala', importStmt: 'import core.utils' },
  { name: 'swift', ext: 'swift', importStmt: 'import core_utils' },
  { name: 'lua', ext: 'lua', importStmt: 'require("core.utils")' },
  { name: 'zig', ext: 'zig', importStmt: 'const utils = @import("core/utils.zig");' },
  { name: 'powershell', ext: 'ps1', importStmt: '. ./core/utils.ps1' },
  { name: 'elixir', ext: 'ex', importStmt: 'alias Core.Utils' },
  { name: 'objective-c', ext: 'm', importStmt: '#import "core/utils.h"' },
  { name: 'julia', ext: 'jl', importStmt: 'include("core/utils.jl")' },
  { name: 'verilog', ext: 'v', importStmt: '`include "core/utils.v"' },
  { name: 'systemverilog', ext: 'sv', importStmt: '`include "core/utils.sv"' },
  { name: 'vue', ext: 'vue', importStmt: '<script setup>import utils from "./core/utils.js"</script>' },
  { name: 'svelte', ext: 'svelte', importStmt: '<script>import utils from "./core/utils.js"</script>' },
  { name: 'dart', ext: 'dart', importStmt: 'import "core/utils.dart";' },
];

async function generate() {
  const baseDir = path.join(process.cwd(), 'test-fixtures');
  
  for (const lang of LANGUAGES) {
    const langDir = path.join(baseDir, lang.name, 'canary');
    const coreDir = path.join(langDir, 'core');
    
    await fs.ensureDir(coreDir);
    
    const ext = (lang.name === 'c' || lang.name === 'cpp' || lang.name === 'objective-c') ? 'h' : lang.ext;
    const utilsFile = path.join(coreDir, `utils.${ext}`);
    const d1File = path.join(langDir, `d1.${lang.ext}`);
    const expectedFile = path.join(langDir, 'expected.json');
    
    // Header for some languages
    let content = '// Utility file\n';
    if (lang.name === 'php') content = '<?php\nnamespace core;\nclass utils {}';
    if (lang.name === 'go') content = 'package core\nfunc Utils() {}';
    if (lang.name === 'python') {
      await fs.writeFile(path.join(coreDir, '__init__.py'), '');
    }
    
    await fs.writeFile(utilsFile, content);
    
    let d1Content = lang.importStmt + '\n// Consumer';
    if (lang.name === 'php') d1Content = '<?php\n' + lang.importStmt;
    if (lang.name === 'go') d1Content = 'package main\n' + lang.importStmt;
    if (lang.name === 'rust') d1Content = 'mod core { pub mod utils { pub fn test() {} } }\nuse crate::core::utils;';

    await fs.writeFile(d1File, d1Content);
    
    const expected = {
      trigger_file: path.relative(process.cwd(), utilsFile).replace(/\\/g, '/'),
      expected_blast_radius: [path.relative(process.cwd(), d1File).replace(/\\/g, '/')],
      expected_NOT_in_blast_radius: [],
      notes: `Canary test for ${lang.name}`
    };
    
    await fs.writeJson(expectedFile, expected, { spaces: 2 });
  }
  
  console.log('✅ Generated canary fixtures for all languages.');
}

generate().catch(console.error);
