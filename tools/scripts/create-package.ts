/**
 * tools/scripts/create-package.ts
 * Wrapper around 'nx generate @nx/js:lib' that enforces the repository standard:
 * - Root index.ts entry point.
 * - Strict TSConfig with baseUrl: ".".
 * - Consistent project.json configuration.
 *
 * Usage: npx tsx tools/scripts/create-package.ts <package-name> [--dry-run]
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function main() {
    const args = process.argv.slice(2);
    const pkgName = args[0];
    const dryRun = args.includes('--dry-run');

    if (!pkgName || pkgName.startsWith('--')) {
        console.error('Usage: npx tsx tools/scripts/create-package.ts <package-name> [--dry-run]');
        process.exit(1);
    }

    const pkgPath = `packages/${pkgName}`;

    if (existsSync(pkgPath)) {
        console.error(`Error: Package path ${pkgPath} already exists.`);
        process.exit(1);
    }

    console.log(`\n📦 Creating package @golden/${pkgName}...`);

    // 1. Run Nx Generator
    // We use --importPath to ensure consistent @golden/ naming
    const cmd = `pnpm nx generate @nx/js:lib ${pkgName} --directory=packages/${pkgName} --importPath=@golden/${pkgName} --projectNameAndRootFormat=as-provided --unitTestRunner=vitest --bundler=none --minimal --skipPackageJson`;

    console.log(`> ${cmd}`);
    if (!dryRun) {
        execSync(cmd, { stdio: 'inherit' });
    } else {
        console.log('(Dry run: skipping execution)');
        return;
    }

    // 2. Move src/index.ts -> index.ts
    const srcIndex = join(pkgPath, 'src/index.ts');
    const rootIndex = join(pkgPath, 'index.ts');

    if (existsSync(srcIndex)) {
        console.log('🔧 Moving src/index.ts to index.ts...');
        renameSync(srcIndex, rootIndex);

        // Update content to reflect move (optional, but good for comments)
        let content = readFileSync(rootIndex, 'utf-8');
        content = `/**\n * packages/${pkgName}/index.ts\n * Entry point for ${pkgName}.\n */\n` + content;
        writeFileSync(rootIndex, content);
    } else {
        console.warn('⚠️  src/index.ts not found. Check generator settings.');
        // Create one if missing
        writeFileSync(rootIndex, `/**\n * packages/${pkgName}/index.ts\n */\nexport * from './src/lib/${pkgName}';\n`);
    }

    // 3. Update project.json
    const projectJsonPath = join(pkgPath, 'project.json');
    if (existsSync(projectJsonPath)) {
        console.log('🔧 Updating project.json main entry...');
        const projectJson = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));

        if (projectJson.targets?.build?.options) {
            projectJson.targets.build.options.main = '{projectRoot}/index.ts';
        }

        writeFileSync(projectJsonPath, JSON.stringify(projectJson, null, 2));
    }

    // 4. Update tsconfig.json
    const tsconfigPath = join(pkgPath, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
        console.log('🔧 Updating tsconfig.json...');
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

        // Ensure compilerOptions exists
        if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};

        // Enforce standards
        tsconfig.compilerOptions.baseUrl = '.';
        tsconfig.compilerOptions.rootDir = '.';
        tsconfig.compilerOptions.outDir = './dist';

        // Update include
        tsconfig.include = ['index.ts', 'src/**/*.ts'];

        writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    }

    console.log(`\n✅ Package @golden/${pkgName} created successfully with standard structure.`);
}

main();
