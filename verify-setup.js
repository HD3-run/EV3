#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying application setup...\n');

const checks = [
  {
    name: 'Environment files',
    check: () => {
      const prodEnv = fs.existsSync('envfiles/prod.env');
      const devEnv = fs.existsSync('envfiles/dev.env');
      return prodEnv && devEnv;
    },
    fix: 'Ensure envfiles/prod.env and envfiles/dev.env exist'
  },
  {
    name: 'Built frontend',
    check: () => fs.existsSync('dist/frontend/index.html'),
    fix: 'Run: npm run build:frontend'
  },
  {
    name: 'Built backend',
    check: () => fs.existsSync('dist/backend/index.js'),
    fix: 'Run: npm run build:backend'
  },
  {
    name: 'TypeScript configs',
    check: () => {
      const main = fs.existsSync('tsconfig.json');
      const backend = fs.existsSync('tsconfig.backend.json');
      return main && backend;
    },
    fix: 'Ensure tsconfig.json and tsconfig.backend.json exist'
  },
  {
    name: 'Vite config',
    check: () => fs.existsSync('vite.config.ts'),
    fix: 'Ensure vite.config.ts exists'
  }
];

let allPassed = true;

checks.forEach(({ name, check, fix }) => {
  const passed = check();
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  
  if (!passed) {
    console.log(`   Fix: ${fix}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 Setup verification passed! Ready to run:');
  console.log('   Development: npm run dev');
  console.log('   Production:  npm run start');
} else {
  console.log('❌ Setup verification failed. Please fix the issues above.');
  process.exit(1);
}