import sharp from 'sharp';

async function removeBackgroundAndProcess() {
  const inputPath = '/home/z/my-project/upload/IMG_4195.png';
  const outputPath = '/home/z/my-project/public/logo-premium.png';
  
  try {
    console.log('🔄 Processing logo with background removal...\n');
    
    // Get original metadata
    const metadata = await sharp(inputPath).metadata();
    console.log('📐 Original image:', metadata.width, 'x', metadata.height, 'channels:', metadata.channels);
    
    // Step 1: Load image and ensure RGBA
    let image = sharp(inputPath);
    
    // Get raw pixel data
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log('🖼️ Processing pixels for background removal...');
    
    // Step 2: Advanced background removal
    // Remove white and near-white pixels (chroma key style)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate color properties
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      
      // Detect white/light gray background
      const isNearWhite = brightness > 230;
      const isLightGray = (max - min) < 15 && brightness > 200;
      const isVeryLight = brightness > 245;
      
      // Detect pure white
      const isPureWhite = r > 250 && g > 250 && b > 250;
      
      // Remove background pixels
      if (isPureWhite || isVeryLight || isNearWhite || isLightGray) {
        data[i + 3] = 0; // Make fully transparent
      }
      // Edge smoothing - partial transparency for edge pixels
      else if (brightness > 180 && (max - min) < 40) {
        const alpha = Math.floor((brightness - 180) * 2.5);
        data[i + 3] = Math.max(0, 255 - alpha);
      }
    }
    
    console.log('✂️ Background removed, now cropping...\n');
    
    // Step 3: Create image from processed pixels
    let processedImage = await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    }).png();
    
    // Step 4: Find content bounds and trim
    const trimmedBuffer = await processedImage.toBuffer();
    const trimmedImage = sharp(trimmedBuffer);
    
    // Get trimmed metadata to find actual content
    const trimmedMeta = await trimmedImage.metadata();
    
    // Trim transparent pixels and resize
    const finalImage = await sharp(trimmedBuffer)
      .trim({ threshold: 10 }) // Trim transparent edges
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: 'lanczos3' // High quality resize
      })
      .png({ 
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(outputPath);
    
    // Verify output
    const outputMeta = await sharp(outputPath).metadata();
    console.log('✅ Logo processed successfully!');
    console.log('📊 Output:', outputMeta.width, 'x', outputMeta.height);
    console.log('🎨 Has Alpha:', outputMeta.hasAlpha);
    console.log('📁 Saved to:', outputPath);
    
    // Check transparency percentage
    const outputData = await sharp(outputPath)
      .raw()
      .toBuffer();
    
    let transparentPixels = 0;
    let totalPixels = outputData.length / 4;
    for (let i = 3; i < outputData.length; i += 4) {
      if (outputData[i] < 10) transparentPixels++;
    }
    
    const transparencyPercent = ((transparentPixels / totalPixels) * 100).toFixed(1);
    console.log('🔍 Transparency:', transparencyPercent + '% of pixels are transparent');
    
    if (parseFloat(transparencyPercent) < 20) {
      console.log('⚠️  Warning: Low transparency detected. Background may not be fully removed.');
    }
    
  } catch (error) {
    console.error('❌ Error processing image:', error);
    throw error;
  }
}

removeBackgroundAndProcess();
