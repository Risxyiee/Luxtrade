import sharp from 'sharp';
import path from 'path';

async function processLogo() {
  const inputPath = '/home/z/my-project/upload/IMG_4195.png';
  const outputPath = '/home/z/my-project/public/logo-luxtrade-premium.png';
  
  try {
    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    console.log('Original image:', metadata.width, 'x', metadata.height, 'channels:', metadata.channels);
    
    // Process the image - resize and try to remove background
    // First resize with contain to keep aspect ratio
    const resized = await sharp(inputPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    // Get raw pixel data for background removal
    const { data, info } = await sharp(resized)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Simple background removal - make near-black or near-white pixels transparent
    // This is a simple threshold-based approach
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Calculate brightness
      const brightness = (r + g + b) / 3;
      
      // If pixel is very dark (near black background) or very light (near white background), make it transparent
      if (brightness < 20 || brightness > 250) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }
    
    // Convert back to PNG
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .png()
    .toFile(outputPath);
    
    console.log('Logo processed and saved to:', outputPath);
    
    // Verify output
    const outputMeta = await sharp(outputPath).metadata();
    console.log('Output image:', outputMeta.width, 'x', outputMeta.height, 'hasAlpha:', outputMeta.hasAlpha);
    
  } catch (error) {
    console.error('Error processing image:', error);
  }
}

processLogo();
