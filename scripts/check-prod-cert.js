const fs = require('fs');
const files = fs.readdirSync('supabase/migrations');
for (const f of files) {
  const c = fs.readFileSync('supabase/migrations/' + f, 'utf8');
  if (c.includes('product_certifications')) {
    console.log('File ' + f + ':');
    for (const l of c.split('\n')) {
      if (l.includes('product_certifications')) console.log('  ' + l);
    }
  }
}

