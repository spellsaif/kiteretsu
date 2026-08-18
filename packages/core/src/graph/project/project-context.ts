import path from 'path';
import fs from 'fs-extra';

export interface TsConfigPaths {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

export class ProjectContext {
  public rootDir: string;
  public fileSystemCache: Set<string> = new Set();
  public packageMap: Map<string, string> = new Map();
  public crateMap: Map<string, string> = new Map();
  public goModuleName?: string;
  public tsConfig?: TsConfigPaths;
  public pythonSrcDirs: string[] = [];

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir).replace(/\\/g, '/');
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.loadTsConfig(),
      this.loadPackageJson(),
      this.loadCargoToml(),
      this.loadGoMod(),
      this.loadPythonProject()
    ]);
  }

  private async loadTsConfig(): Promise<void> {
    const tsConfigPath = path.join(this.rootDir, 'tsconfig.json');
    if (await fs.pathExists(tsConfigPath)) {
      try {
        const content = await fs.readFile(tsConfigPath, 'utf8');
        // Strip comments for JSON parsing
        const cleaned = content.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');
        const json = JSON.parse(cleaned);
        if (json.compilerOptions) {
          this.tsConfig = {
            baseUrl: json.compilerOptions.baseUrl,
            paths: json.compilerOptions.paths
          };
        }
      } catch { }
    }
  }

  private async loadPackageJson(): Promise<void> {
    const rootPkgPath = path.join(this.rootDir, 'package.json');
    if (await fs.pathExists(rootPkgPath)) {
      try {
        const pkg = await fs.readJson(rootPkgPath);
        if (pkg.name) {
          this.packageMap.set(pkg.name, this.rootDir);
        }
      } catch { }
    }

    // Monorepo package scanning (packages/*, apps/*)
    for (const workspaceDir of ['packages', 'apps', 'libs']) {
      const parentDir = path.join(this.rootDir, workspaceDir);
      if (await fs.pathExists(parentDir)) {
        try {
          const entries = await fs.readdir(parentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const subPkgPath = path.join(parentDir, entry.name, 'package.json');
              if (await fs.pathExists(subPkgPath)) {
                try {
                  const subPkg = await fs.readJson(subPkgPath);
                  if (subPkg.name) {
                    const normalizedPkgDir = path.join(parentDir, entry.name).replace(/\\/g, '/');
                    this.packageMap.set(subPkg.name, normalizedPkgDir);
                  }
                } catch { }
              }
            }
          }
        } catch { }
      }
    }
  }

  private async loadCargoToml(): Promise<void> {
    const cargoPath = path.join(this.rootDir, 'Cargo.toml');
    if (await fs.pathExists(cargoPath)) {
      try {
        const content = await fs.readFile(cargoPath, 'utf8');
        const nameMatch = content.match(/\[package\][\s\S]*?name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) {
          this.crateMap.set(nameMatch[1], this.rootDir);
        }

        // Check workspace members
        const memberMatches = content.matchAll(/members\s*=\s*\[([\s\S]*?)\]/g);
        for (const match of memberMatches) {
          const rawMembers = match[1];
          const members = rawMembers.split(',').map(m => m.trim().replace(/["']/g, '')).filter(Boolean);
          for (const member of members) {
            const memberDir = path.join(this.rootDir, member);
            const memberCargo = path.join(memberDir, 'Cargo.toml');
            if (await fs.pathExists(memberCargo)) {
              const memberContent = await fs.readFile(memberCargo, 'utf8');
              const memberNameMatch = memberContent.match(/\[package\][\s\S]*?name\s*=\s*["']([^"']+)["']/);
              if (memberNameMatch) {
                this.crateMap.set(memberNameMatch[1], memberDir.replace(/\\/g, '/'));
              }
            }
          }
        }
      } catch { }
    }
  }

  private async loadGoMod(): Promise<void> {
    const goModPath = path.join(this.rootDir, 'go.mod');
    if (await fs.pathExists(goModPath)) {
      try {
        const content = await fs.readFile(goModPath, 'utf8');
        const match = content.match(/^module\s+([^\s]+)/m);
        if (match) {
          this.goModuleName = match[1];
        }
      } catch { }
    }
  }

  private async loadPythonProject(): Promise<void> {
    for (const srcDir of ['src', 'lib', '.']) {
      const checkPath = path.join(this.rootDir, srcDir);
      if (await fs.pathExists(checkPath)) {
        this.pythonSrcDirs.push(checkPath.replace(/\\/g, '/'));
      }
    }
  }

  resolveTsPath(importPath: string): string[] {
    if (!this.tsConfig?.paths) return [];

    const results: string[] = [];
    const baseUrl = this.tsConfig.baseUrl
      ? path.resolve(this.rootDir, this.tsConfig.baseUrl).replace(/\\/g, '/')
      : this.rootDir;

    for (const [pattern, targets] of Object.entries(this.tsConfig.paths)) {
      const cleanPattern = pattern.replace(/\/\*$/, '');
      if (importPath === cleanPattern || importPath.startsWith(cleanPattern + '/')) {
        const subPath = importPath.slice(cleanPattern.length).replace(/^\//, '');
        for (const target of targets) {
          const cleanTarget = target.replace(/\/\*$/, '');
          const candidate = path.resolve(baseUrl, cleanTarget, subPath).replace(/\\/g, '/');
          results.push(candidate);
        }
      }
    }
    return results;
  }
}
