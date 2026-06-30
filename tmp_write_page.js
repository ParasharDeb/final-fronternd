const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'app', 'page.tsx');
const content = `import ChaseRunner from "@/components/ChaseRunner";

export default function Page() {
  return <ChaseRunner />;
}
`;
fs.writeFileSync(filePath, content, 'utf8');
console.log('wrote', filePath);
