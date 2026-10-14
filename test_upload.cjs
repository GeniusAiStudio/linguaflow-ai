const FormData = require('form-data');
const fs = require('fs');

async function test() {
  fs.writeFileSync('dummy.mp4', Buffer.alloc(10 * 1024 * 1024)); // 10MB
  const form = new FormData();
  form.append('video', fs.createReadStream('dummy.mp4'));
  form.append('audio', fs.createReadStream('dummy.mp4'));
  
  const res = await fetch('http://localhost:3000/api/video-editor-render', {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("HEADERS:", res.headers.get('content-type'));
  console.log("BODY:", text.substring(0, 200));
}
test().catch(console.error);
