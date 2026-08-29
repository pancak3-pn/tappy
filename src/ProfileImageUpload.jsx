import { useEffect, useRef, useState } from 'react'
import { Check, Crop, ImageSquare, Trash, X } from '@phosphor-icons/react'

const MAX_SOURCE_BYTES = 12_582_912
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(file)
  })
}

function clamp(value, minimum, maximum) { return Math.min(Math.max(value, minimum), maximum) }

export default function ProfileImageUpload({ value, name = 'Profile photo', disabled = false, hint = 'JPG, PNG, or WebP. You can crop it before upload.', onUpload, onRemove, deferred = false, onPendingChange }) {
  const inputRef = useRef(null)
  const cropRef = useRef(null)
  const dragRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState('')
  const [imageSize, setImageSize] = useState({ width:0, height:0 })
  const [crop, setCrop] = useState({ zoom:1, x:0, y:0 })
  const [pending, setPending] = useState(null)

  // When the stored value changes externally (e.g. after the parent saves),
  // clear any deferred pending change so the UI reflects the committed state.
  useEffect(() => { setPending(null) }, [value])

  useEffect(() => {
    if (!source) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) closeCrop() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [source, busy])

  function clearPending() {
    setPending(null)
    onPendingChange?.(null)
  }

  function closeCrop() {
    setSource('')
    setImageSize({ width:0, height:0 })
    setCrop({ zoom:1, x:0, y:0 })
    dragRef.current = null
  }

  function cropBounds(zoom = crop.zoom) {
    const viewport = cropRef.current?.clientWidth || 280
    if (!imageSize.width || !imageSize.height) return { x:0, y:0, scale:1, viewport }
    const scale = Math.max(viewport / imageSize.width, viewport / imageSize.height) * zoom
    return { x:Math.max(0, (imageSize.width * scale - viewport) / 2), y:Math.max(0, (imageSize.height * scale - viewport) / 2), scale, viewport }
  }

  async function chooseImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return setError('Choose a JPG, PNG, or WebP image.')
    if (file.size > MAX_SOURCE_BYTES) return setError('Choose an image smaller than 12 MB.')
    setError('')
    try { setSource(await readImage(file)) }
    catch (readError) { setError(readError.message) }
  }

  function updateZoom(nextZoom) {
    const zoom = clamp(Number(nextZoom), 1, 3)
    const bounds = cropBounds(zoom)
    setCrop((current) => ({ zoom, x:clamp(current.x, -bounds.x, bounds.x), y:clamp(current.y, -bounds.y, bounds.y) }))
  }

  function startDrag(event) {
    if (!imageSize.width || busy) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId:event.pointerId, x:event.clientX, y:event.clientY, cropX:crop.x, cropY:crop.y }
  }

  function moveDrag(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const bounds = cropBounds()
    setCrop((current) => ({ ...current, x:clamp(drag.cropX + event.clientX - drag.x, -bounds.x, bounds.x), y:clamp(drag.cropY + event.clientY - drag.y, -bounds.y, bounds.y) }))
  }

  function stopDrag(event) { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null }

  async function applyCrop() {
    setBusy(true)
    setError('')
    try {
      const image = new Image()
      image.src = source
      await image.decode()
      const { scale, viewport } = cropBounds()
      const sourceSize = viewport / scale
      const sourceX = clamp((image.naturalWidth - sourceSize) / 2 - crop.x / scale, 0, image.naturalWidth - sourceSize)
      const sourceY = clamp((image.naturalHeight - sourceSize) / 2 - crop.y / scale, 0, image.naturalHeight - sourceSize)
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const context = canvas.getContext('2d', { alpha:false })
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, 800, 800)
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 800, 800)
      const croppedImage = canvas.toDataURL('image/webp', .86)
      if (deferred) {
        setPending({ imageData: croppedImage })
        onPendingChange?.({ imageData: croppedImage })
        closeCrop()
      } else {
        await onUpload(croppedImage)
        closeCrop()
      }
    } catch (uploadError) {
      setError(uploadError.message || 'The image could not be prepared.')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage() {
    if (deferred) {
      setPending('remove')
      onPendingChange?.('remove')
      return
    }
    setBusy(true)
    setError('')
    try { await onRemove() }
    catch (removeError) { setError(removeError.message || 'The image could not be removed.') }
    finally { setBusy(false) }
  }

  const previewScale = imageSize.width ? cropBounds().scale : 1
  const previewSrc = pending === 'remove' ? '' : (pending?.imageData || value || '')

  return <div className="profile-image-upload">
    <span className="profile-image-label">{name}</span>
    <div className="profile-image-control">
      <div className="profile-image-thumb">{previewSrc ? <img src={previewSrc} alt="Current profile"/> : <ImageSquare size={24}/>}</div>
      <div className="profile-image-copy"><strong>{previewSrc ? 'Profile photo added' : 'Add a profile photo'}</strong><small>{disabled ? 'Create the page before adding its photo.' : hint}</small></div>
      <div className="profile-image-actions">
        <button type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()}><Crop size={16}/>{previewSrc ? 'Replace' : 'Choose photo'}</button>
        {previewSrc && <button type="button" className="profile-image-remove" disabled={disabled || busy} onClick={removeImage} aria-label="Remove profile photo" title="Remove profile photo"><Trash size={17}/></button>}
      </div>
    </div>
    {pending && <div className="profile-image-pending"><span>{pending === 'remove' ? 'Photo will be removed when you save.' : 'Photo ready to save.'}</span><button type="button" onClick={clearPending} disabled={disabled}>Undo</button></div>}
    <input ref={inputRef} className="profile-image-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage}/>
    {error && !source && <small className="profile-image-error" role="alert">{error}</small>}
    {source && <div className="profile-crop-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) closeCrop() }}>
      <section className="profile-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-crop-title">
        <header><div><span>Profile photo</span><h2 id="profile-crop-title">Crop your image</h2></div><button type="button" onClick={closeCrop} disabled={busy} aria-label="Close image cropper"><X size={20}/></button></header>
        <div ref={cropRef} className="profile-crop-viewport" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
          <img src={source} alt="Crop preview" draggable="false" onLoad={(event) => setImageSize({ width:event.currentTarget.naturalWidth, height:event.currentTarget.naturalHeight })} style={imageSize.width ? { width:`${imageSize.width * previewScale}px`, height:`${imageSize.height * previewScale}px`, left:`calc(50% + ${crop.x}px)`, top:`calc(50% + ${crop.y}px)` } : undefined}/>
          <div className="profile-crop-guide" aria-hidden="true"/>
        </div>
        <label className="profile-crop-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(event) => updateZoom(event.target.value)}/></label>
        <p>Drag the image to choose what appears inside the square profile photo.</p>
        {error && <small className="profile-crop-error" role="alert">{error}</small>}
        <footer><button type="button" onClick={closeCrop} disabled={busy}>Cancel</button><button type="button" className="profile-crop-apply" onClick={applyCrop} disabled={busy || !imageSize.width}><Check size={17}/>{busy ? 'Preparing…' : 'Use photo'}</button></footer>
      </section>
    </div>}
  </div>
}
