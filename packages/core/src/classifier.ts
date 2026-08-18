import path from 'path';

export type FileClassification =
  | 'source'
  | 'test'
  | 'documentation'
  | 'generated'
  | 'vendor'
  | 'binary'
  | 'unknown';

export interface ClassificationResult {
  classification: FileClassification;
  reason?: string;
}

export class FileClassifier {
  private static readonly BINARY_EXTENSIONS = new Set([
    // Executables & Native Libraries
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
    '.o', '.obj', '.a', '.lib', '.la', '.lai', '.lo', '.node',
    '.pdb', '.idb', '.ilk', '.exp', '.pch', '.gch',

    // Archives & Compression
    '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.iso', '.bz2', '.xz', '.zst',

    // Media & Assets
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.bmp', '.tiff', '.psd',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.flac', '.ogg', '.mkv', '.webm',
    '.pdf', '.epub', '.docx', '.xlsx', '.pptx',

    // JVM / Bytecode
    '.class', '.jar', '.war', '.ear', '.aar', '.apk', '.jmod', '.hprof',

    // Python Bytecode
    '.pyc', '.pyo', '.pyd',

    // Rust / Erlang / WebAssembly / Others
    '.wasm', '.rlib', '.rmeta', '.beam', '.rdata', '.rds', '.rda'
  ]);

  private static readonly DOCS_EXTENSIONS = new Set([
    '.md', '.mdx', '.rst', '.txt', '.adoc', '.asciidoc'
  ]);

  private static readonly TEST_PATTERNS = [
    /\.test\.[a-z0-9]+$/i,
    /\.spec\.[a-z0-9]+$/i,
    /_test\.[a-z0-9]+$/i,
    /test_[a-z0-9]+\.py$/i,
    /(?:^|\/)tests?\//i,
    /(?:^|\/)__tests__\//i,
    /(?:^|\/)test_fixtures\//i,
    /(?:^|\/)fixtures\//i
  ];

  private static readonly GENERATED_PATH_PATTERNS = [
    // JS / TS / Web Frameworks
    /(?:^|\/)\.next\//i,
    /(?:^|\/)_next\//i,
    /(?:^|\/)\.nuxt\//i,
    /(?:^|\/)dist\//i,
    /(?:^|\/)build\//i,
    /(?:^|\/)out\//i,
    /(?:^|\/)\.turbo\//i,
    /(?:^|\/)\.svelte-kit\//i,
    /(?:^|\/)\.docusaurus\//i,
    /(?:^|\/)storybook-static\//i,
    /(?:^|\/)generated\//i,
    /(?:^|\/)\.generated\//i,
    /\.min\.[a-z0-9]+$/i,
    /\.bundle\.[a-z0-9]+$/i,
    /\.bundle\.min\.[a-z0-9]+$/i,
    /\.map$/i,
    /\.d\.ts\.map$/i,
    /\.chunk\.[a-z0-9]+$/i,
    /\/static\/chunks\//i,

    // Rust / Cargo
    /(?:^|\/)target\//i,

    // Python
    /(?:^|\/)__pycache__\//i,
    /(?:^|\/)\.pytest_cache\//i,
    /(?:^|\/)\.mypy_cache\//i,
    /(?:^|\/)\.ruff_cache\//i,
    /(?:^|\/)\.tox\//i,
    /(?:^|\/)\.nox\//i,
    /(?:^|\/)\.hypothesis\//i,
    /(?:^|\/)htmlcov\//i,
    /\.egg-info\//i,
    /\.dist-info\//i,

    // Java / Kotlin / Scala (Gradle, Maven, SBT)
    /(?:^|\/)\.gradle\//i,
    /(?:^|\/)\.m2\//i,
    /(?:^|\/)\.bsp\//i,
    /(?:^|\/)\.metals\//i,
    /(?:^|\/)\.bloop\//i,
    /(?:^|\/)\.sbt\//i,
    /(?:^|\/)target\/scala-/i,

    // C / C++ / CMake / Bazel
    /(?:^|\/)CMakeFiles\//i,
    /(?:^|\/)cmake-build-/i,
    /(?:^|\/)\.ninja\//i,
    /(?:^|\/)bazel-/i,
    /(?:^|\/)Debug\//i,
    /(?:^|\/)Release\//i,
    /(?:^|\/)x64\//i,
    /(?:^|\/)x86\//i,

    // C# / .NET
    /(?:^|\/)bin\//i,
    /(?:^|\/)obj\//i,
    /(?:^|\/)TestResults\//i,

    // Dart / Flutter
    /(?:^|\/)\.dart_tool\//i,
    /(?:^|\/)\.pub-cache\//i,
    /(?:^|\/)\.flutter-plugins/i,

    // Elixir / Erlang
    /(?:^|\/)_build\//i,
    /(?:^|\/)\.elixir_ls\//i,

    // Swift / iOS / Xcode
    /(?:^|\/)\.swiftpm\//i,
    /(?:^|\/)DerivedData\//i,

    // Zig
    /(?:^|\/)\.zig-cache\//i,
    /(?:^|\/)zig-out\//i,

    // Haskell
    /(?:^|\/)\.stack-work\//i,
    /(?:^|\/)dist-newstyle\//i,

    // General Coverage & Caches
    /(?:^|\/)coverage\//i,
    /(?:^|\/)\.cache\//i
  ];

  private static readonly VENDOR_PATH_PATTERNS = [
    /(?:^|\/)node_modules\//i,
    /(?:^|\/)bower_components\//i,
    /(?:^|\/)vendor\//i,
    /(?:^|\/)third_party\//i,
    /(?:^|\/)\.venv\//i,
    /(?:^|\/)venv\//i,
    /(?:^|\/)env\//i,
    /(?:^|\/)site-packages\//i,
    /(?:^|\/)Pods\//i,
    /(?:^|\/)Carthage\/Build\//i,
    /(?:^|\/)deps\//i,
    /(?:^|\/)\.nuget\//i
  ];

  static isBinaryExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.BINARY_EXTENSIONS.has(ext);
  }

  static isBinaryBuffer(buffer: Buffer): boolean {
    const checkLength = Math.min(buffer.length, 512);
    if (checkLength === 0) return false;

    let nonPrintable = 0;
    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i];
      if (byte === 0) return true; // Null byte is definitive binary marker
      if ((byte < 7 || (byte > 14 && byte < 32)) && byte !== 27) {
        nonPrintable++;
      }
    }
    return nonPrintable / checkLength > 0.3;
  }

  static classify(filePath: string, contentPrefix?: string): ClassificationResult {
    const normalizedPath = filePath.replace(/\\/g, '/');

    // 1. Binary check by extension
    if (this.isBinaryExtension(normalizedPath)) {
      return { classification: 'binary', reason: 'Binary file extension' };
    }

    // 2. Vendor check by path
    for (const pattern of this.VENDOR_PATH_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return { classification: 'vendor', reason: 'Vendor / package directory' };
      }
    }

    // 3. Generated check by path
    for (const pattern of this.GENERATED_PATH_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return { classification: 'generated', reason: 'Generated build output / bundle' };
      }
    }

    // 4. Content-based generated check (multi-language headers)
    if (contentPrefix) {
      const firstLines = contentPrefix.slice(0, 4096);
      if (
        firstLines.includes('// <auto-generated') ||
        firstLines.includes('<!-- <auto-generated') ||
        (firstLines.includes('/* eslint-disable */') && (firstLines.includes('webpack') || firstLines.includes('chunk') || firstLines.includes('minified'))) ||
        firstLines.includes('// Code generated by') ||
        firstLines.includes('/* Code generated by') ||
        firstLines.includes('# Code generated by') ||
        firstLines.includes('/* @generated */') ||
        firstLines.includes('// @generated') ||
        firstLines.includes('/* @graphql-codegen */') ||
        firstLines.includes('// Generated by the protocol buffer compiler') ||
        firstLines.includes('/* Automatically generated by nanopb */') ||
        firstLines.includes('// Automatically generated') ||
        firstLines.includes('# Generated by the gRPC') ||
        firstLines.includes('// Generated from') && firstLines.includes('by ANTLR') ||
        firstLines.includes('/* A Bison parser, made by GNU Bison') ||
        firstLines.includes('/* A lexical scanner generated by flex') ||
        firstLines.includes('/** This file is generated by Prisma Client') ||
        firstLines.includes('// Generated by openapi-generator') ||
        (firstLines.includes('/* istanbul ignore next */') && firstLines.length > 500)
      ) {
        return { classification: 'generated', reason: 'Generated file header' };
      }

      // Check minified single-line code (long lines without whitespace)
      const lines = firstLines.split('\n');
      if (lines.length > 0 && lines[0].length > 1000) {
        return { classification: 'generated', reason: 'Minified source line' };
      }
    }

    // 5. Documentation check
    const ext = path.extname(normalizedPath).toLowerCase();
    if (this.DOCS_EXTENSIONS.has(ext)) {
      return { classification: 'documentation' };
    }

    // 6. Test check
    for (const pattern of this.TEST_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        return { classification: 'test' };
      }
    }

    // 7. Standard source file
    return { classification: 'source' };
  }
}
