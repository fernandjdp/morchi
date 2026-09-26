'use client'

import { useEffect, useState } from 'react'
import { uploadProductImage } from '@/features/backoffice/actions/products'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ProductImageUploadForm({ productId, productName }: { productId: string; productName: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null
    setFile(null)
    setValidationError('')

    if (!selected) return
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setValidationError('Elegí una imagen JPG, PNG o WebP.')
      event.currentTarget.value = ''
      return
    }
    if (selected.size < 1 || selected.size > MAX_IMAGE_SIZE) {
      setValidationError('La imagen debe pesar más de 0 y hasta 5 MB.')
      event.currentTarget.value = ''
      return
    }

    setFile(selected)
  }

  return (
    <form action={uploadProductImage} className="admin-form" style={{ marginTop: 16 }}>
      <input type="hidden" name="product_id" value={productId} />
      <div className="admin-form-grid">
        <label>
          Archivo
          <input
            className="admin-input"
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={handleFileChange}
            aria-describedby={validationError ? 'product-image-error' : 'product-image-help'}
          />
        </label>
        <label>
          Texto alternativo
          <input className="admin-input" name="alt_text" maxLength={160} placeholder={productName} />
        </label>
      </div>
      <p id={validationError ? 'product-image-error' : 'product-image-help'} className="admin-image-upload-help" aria-live="polite">
        {validationError || 'JPG, PNG o WebP · hasta 5 MB. La imagen se sube al guardar.'}
      </p>
      {previewUrl && file && (
        <div className="admin-image-preview">
          <img src={previewUrl} alt={`Previsualización de ${file.name}`} />
          <span>{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        </div>
      )}
      <button className="admin-button" disabled={!file || Boolean(validationError)}>
        Subir imagen
      </button>
    </form>
  )
}
