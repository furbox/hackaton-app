const fs = require('fs');

const filePath = './views/pages/sobre.ejs';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/href="#" class="text-text-secondary hover:text-accent-primary transition-colors"/,
  'href="https://github.com/furbox" class="text-text-secondary hover:text-accent-primary transition-colors"');

fs.writeFileSync(filePath, content);
console.log('GitHub icon link updated successfully');
