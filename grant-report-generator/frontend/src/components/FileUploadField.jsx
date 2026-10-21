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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Show current file if exists */}
      {value && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-green-50
                        border border-green-200 rounded-lg">
          <span className="text-xs text-green-700 flex-1 truncate">
            ✓ File uploaded
          </span>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex-shrink-0"
          >
            View
          </a>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-400 hover:text-red-600 flex-shrink-0"
          >
            Remove
          </button>
        </div>
      )}

      {/* Upload button */}
      <div className="flex gap-2 items-center">
        <label className={`flex-1 flex items-center justify-center gap-2
                          border-2 border-dashed rounded-lg px-4 py-3
                          cursor-pointer transition text-sm
                          ${uploading
                            ? 'border-gray-200 bg-gray-50 text-gray-400'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-500'
                          }`}>
          <input
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
            accept={ACCEPT}
          />
          {uploading ? (
            <span className="text-gray-400">Uploading...</span>
          ) : (
            <span>
              📎 {value ? 'Replace file' : 'Upload file'}
              <span className="text-xs text-gray-400 ml-1">
                (image, PDF, Word, Excel — max 10MB)
              </span>
            </span>
          )}
        </label>
      </div>

      {uploadError && (
        <p role="alert" className="text-xs text-red-500 mt-1">{uploadError}</p>
      )}
    </div>
  )
}

export default FileUploadField
