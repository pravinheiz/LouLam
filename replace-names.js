const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/app/robots.ts',
  'src/app/sitemap.ts',
  'src/app/api/upload/route.ts',
  'src/app/api/upload/signature/route.ts',
  'src/app/boundary-designer/page.tsx',
  'src/app/chat/page.tsx',
  'src/lib/mail.ts',
  'src/lib/otp.ts',
  '.env'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/heisnamestate/g, 'loulam-1fec9');
    content = content.replace(/Heisnam Estate/g, 'LouLam');
    content = content.replace(/HEISNAM ESTATE/g, 'LOULAM');
    content = content.replace(/heisnam_estate/g, 'loulam');
    content = content.replace(/heisnam-estate/g, 'loulam');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', file);
  } else {
    console.log('File not found:', file);
  }
});
