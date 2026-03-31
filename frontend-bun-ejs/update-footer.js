const fs = require('fs');

const filePath = './views/partials/footer.ejs';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/href="https:\/\/github.com\/midudev"/g,
  'href="https://github.com/furbox"');

fs.writeFileSync(filePath, content);
console.log('Footer GitHub link updated successfully');
