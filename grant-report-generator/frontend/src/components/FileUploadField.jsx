import { useState } from 'react'
import { uploadFile } from '../supabase'

function FileUploadField({ name, label, value, onChange, folder = 'general' }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Max 10MB.')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const url = await uploadFile(file, folder)
      // Simulate onChange event so form state updates
      onChange({ target: { name, value: url } })
    } catch (err) {
      setUploadError('Upload failed. Try again.')
      console.error(err)
    } finally {
      setUploading(false)
    }
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
            onClick={() => onChange({ target: { name, value: '' } })}
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
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          {uploading ? (
            <span className="text-gray-400">Uploading...</span>
          ) : (
            <span>
              📎 {value ? 'Replace file' : 'Upload file'}
              <span className="text-xs text-gray-400 ml-1">
                (image, PDF, doc — max 10MB)
              </span>
            </span>
          )}
        </label>
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 mt-1">{uploadError}</p>
      )}
    </div>
  )
}

export default FileUploadField