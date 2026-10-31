// Browser-side image shrinking so uploads fit the server's size limit (e.g. posters ≤ 2 MB).
// Files already small enough and in an accepted type are returned untouched.

const ACCEPTED = /^image\/(jpeg|png|webp)$/

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/**
 * Re-encodes `file` as JPEG under `maxBytes`, scaling the longest side down to `maxSide`
 * first and then lowering quality / size step by step. Throws if the browser can't read it.
 */
export async function compressImage(file: File, { maxBytes, maxSide = 2000 }: { maxBytes: number; maxSide?: number }): Promise<File> {
  if (file.size <= maxBytes && ACCEPTED.test(file.type)) return file
  const bitmap = await createImageBitmap(file)
  try {
    let side = Math.min(maxSide, Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = side / Math.max(bitmap.width, bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff' // transparent PNG areas would turn black in JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.76, 0.66]) {
        const blob = await toBlob(canvas, quality)
        if (blob && blob.size <= maxBytes) {
          const name = file.name.replace(/\.[^.]+$/, '') || 'image'
          return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
        }
      }
      side = Math.round(side * 0.8)
    }
  } finally {
    bitmap.close()
  }
  throw new Error('ย่อรูปให้เล็กพอไม่ได้ ลองใช้รูปอื่น')
}
