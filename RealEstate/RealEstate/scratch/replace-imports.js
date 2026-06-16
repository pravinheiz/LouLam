const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walk(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('@prisma/client')) {
        content = content.replace(/from\s+["']@prisma\/client["']/g, 'from "@/types/db"');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated:', fullPath);
      }
    }
  });
}

walk('src');
console.log('✅ Replaced all @prisma/client imports in src/ successfully.');
