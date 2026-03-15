const fs = require('fs');

async function testImport() {
  // Read the test image
  const imagePath = '/home/z/my-project/upload/IMG_4444.png';
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  
  console.log('📸 Sending screenshot to API...');
  console.log('Image size:', (base64.length / 1024).toFixed(2), 'KB');
  
  try {
    const response = await fetch('http://localhost:3000/api/import/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 })
    });
    
    const data = await response.json();
    console.log('\n📤 Response status:', response.status);
    console.log('📤 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImport();
