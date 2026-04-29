function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function parseWordConfidence(result) {
  const words = result?.data?.words
  if (!Array.isArray(words) || words.length === 0) return 0
  const sum = words.reduce((acc, w) => acc + (Number.isFinite(w?.confidence) ? w.confidence : 0), 0)
  return sum / words.length
}

async function fileToImageBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function preprocessImage(file) {
  const bitmap = await fileToImageBitmap(file)
  const width = bitmap.width || bitmap.naturalWidth || 0
  const height = bitmap.height || bitmap.naturalHeight || 0
  if (!width || !height) throw new Error('Could not read that image.')

  const scale = clamp(1800 / Math.max(width, height), 1, 2)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not process image.')

  ctx.filter = 'grayscale(1) contrast(1.55) brightness(1.08) saturate(0.85)'
  ctx.drawImage(bitmap, 0, 0, w, h)

  // Lightweight adaptive threshold for faded/washed writing.
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += data[i]
  const mean = sum / (data.length / 4)
  const threshold = clamp(mean * 0.93, 95, 190)
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] < threshold ? 0 : 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)

  return canvas.toDataURL('image/png')
}

export function cleanExtractedText(text) {
  if (!text || typeof text !== 'string') return ''
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  s = s.replace(/[ \t\f\v]+/g, ' ')
  s = s.replace(/[|¦]/g, 'I')
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  s = s.replace(/\s+([.,!?;:])/g, '$1')
  s = s.replace(/([a-z])-\n([a-z])/gi, '$1$2')
  s = s.replace(/\n{3,}/g, '\n\n')
  // Remove accidental repeated adjacent words.
  s = s.replace(/\b(\w+)(\s+\1\b)+/gi, '$1')
  return s.trim()
}

export async function extractTextFromImage(file) {
  if (!file) throw new Error('Choose an image first.')
  const src = await preprocessImage(file)
  const { recognize } = await import('tesseract.js')
  const result = await recognize(src, 'eng', {
    logger: () => {},
  })
  const text = cleanExtractedText(result?.data?.text || '')
  const confidence = parseWordConfidence(result)
  return { text, confidence }
}
