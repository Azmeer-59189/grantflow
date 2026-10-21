import { useState } from 'react'
import { uploadFile, UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../supabase'

const ACCEPT = Object.keys(UPLOAD_TYPES).join(',')

function FileUploadField({ name, label, value, onChange, folder = 'general', uploads }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files[0]
    e.target.value = ''  // allow choosing the same file again after an error
    if (!file) return

    if (!UPLOAD_TYPES[file.type]) {
      setUploadError('Upload an image, PDF, Word or Excel file.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('File too large. Max 10MB.')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const { url, path } = await uploadFile(file, folder)
      uploads?.track(url, path)
      if (value) uploads?.discard(value)  // only deletes files uploaded on this page
      // Simulate onChange event so form state updates
      onChange({ target: { name, value: url } })
    } catch (err) {
      setUploadError(err.message?.includes('mime') ? 'This file type is not allowed.' : 'Upload failed. Try again.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    uploads?.discard(value)
    onChange({ target: { name, value: '' } })
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {/* Show current file if exists */}
      {value && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
          <span className="flex-1 truncate text-xs font-medium text-emerald-700">
            ✓ File uploaded
          </span>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
          >
            View
          </a>
          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 text-xs font-medium text-rose-500 hover:text-rose-700"
          >
            Remove
          </button>
        </div>
      )}

      {/* Upload button */}
      <div className="flex gap-2 items-center">
        <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition
                          ${uploading
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700'
                          }`}>
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
            accept={ACCEPT}
          />
          {uploading ? (
            <span className="text-slate-400">Uploading…</span>
          ) : (
            <span>
              📎 {value ? 'Replace file' : 'Upload file'}
              <span className="ml-1 text-xs text-slate-400">
                (image, PDF, Word, Excel — max 10MB)
              </span>
            </span>
          )}
        </label>
      </div>

      {uploadError && (
        <p role="alert" className="mt-1 text-xs text-rose-600">{uploadError}</p>
      )}
    </div>
  )
}

export default FileUploadField
