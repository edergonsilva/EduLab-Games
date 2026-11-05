/**
 * Remove white background from an image and make it transparent.
 * Uses canvas to process pixels and replace white/near-white colors with transparency.
 */
export function removeWhiteBackground(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      ctx.drawImage(img, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // Threshold for what we consider "white" (0-255 for each RGB channel)
      // Colors with all channels above this threshold are considered white
      const whiteThreshold = 240
      
      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        
        // If pixel is white or very close to white, make it transparent
        if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
          // Set alpha to 0 (transparent)
          data[i + 3] = 0
        }
      }
      
      ctx.putImageData(imageData, 0, 0)
      
      // Convert canvas to blob URL for use as image
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not create blob from canvas'))
          return
        }
        const url = URL.createObjectURL(blob)
        resolve(url)
      }, 'image/png')
    }
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageSrc}`))
    }
    
    img.src = imageSrc
  })
}

/**
 * Pre-processes an image to remove white background and caches the result.
 * Uses a Map to avoid reprocessing the same image multiple times.
 */
const processedImageCache = new Map<string, Promise<string>>()

export function getProcessedImage(imageSrc: string): Promise<string> {
  if (processedImageCache.has(imageSrc)) {
    return processedImageCache.get(imageSrc)!
  }
  
  const promise = removeWhiteBackground(imageSrc)
  processedImageCache.set(imageSrc, promise)
  return promise
}

/**
 * Clear the cache (useful for testing or memory management)
 */
export function clearProcessedImageCache() {
  processedImageCache.forEach((promise) => {
    promise.then((url) => {
      URL.revokeObjectURL(url)
    }).catch(() => {
      // Ignore errors during cleanup
    })
  })
  processedImageCache.clear()
}
