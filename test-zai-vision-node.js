import fs from 'fs'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'

console.log('Testing Z.ai Vision from Node.js...')

try {
  const zai = await ZAI.create()
  console.log('✅ Z.ai SDK created successfully')

  // Read image
  const imagePath = path.join(process.cwd(), 'upload/IMG_6202.png')
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')

  console.log('📷 Image loaded:', imageBuffer.length, 'bytes')

  const result = await zai.chat.completions.createVision({
    model: 'glm-4.6v',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Apa yang ada di gambar ini? Jawab singkat dalam 1 kalimat.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`
            }
          }
        ]
      }
    ]
  })

  console.log('✅ Vision API call successful!')
  console.log('Response:', result.choices[0]?.message?.content?.substring(0, 100) + '...')

} catch (error) {
  console.error('❌ Error:', error.message)
  console.error('Stack:', error.stack)
}