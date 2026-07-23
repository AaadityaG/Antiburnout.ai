import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from '../store'
import { fetchKBDocuments, uploadKBDocument, deleteKBDocument } from '../store/kbSlice'
import ConfirmDialog from './ConfirmDialog'
import { useState } from 'react'

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  txt: '📝',
  md: '📑',
}

interface KnowledgeBaseProps {
  isOpen: boolean
  onClose: () => void
}

function KnowledgeBase({ isOpen, onClose }: KnowledgeBaseProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { token } = useSelector((state: RootState) => state.auth)
  const { documents, isLoading, isUploading } = useSelector((state: RootState) => state.kb)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    docId: string
    filename: string
  }>({ isOpen: false, docId: '', filename: '' })

  useEffect(() => {
    if (isOpen && token) {
      dispatch(fetchKBDocuments(token))
    }
  }, [isOpen, token, dispatch])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'txt', 'md'].includes(ext || '')) {
      alert('Only PDF, TXT, and MD files are supported.')
      return
    }

    dispatch(uploadKBDocument({ token, file }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = (docId: string, filename: string) => {
    setConfirmDialog({ isOpen: true, docId, filename })
  }

  const confirmDelete = () => {
    if (!token) return
    dispatch(deleteKBDocument({ token, docId: confirmDialog.docId }))
    setConfirmDialog({ isOpen: false, docId: '', filename: '' })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute right-0 top-0 bottom-0 w-80 bg-bg-dark/95 glass-blur-heavy border-l border-white/10 z-10 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h3 className="text-sm font-medium text-white/80">Knowledge Base</h3>
              <p className="text-[10px] text-white/30 mt-0.5">
                {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Upload Button */}
          <div className="px-4 py-3 border-b border-white/5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium hover:bg-accent/20 cursor-pointer transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload PDF / TXT / MD
                </>
              )}
            </button>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm text-white/40">No documents yet</p>
                <p className="text-xs text-white/20 mt-1">
                  Upload studies or notes to search them in chat
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {documents.map((doc) => (
                  <div
                    key={doc.doc_id}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-colors"
                  >
                    <span className="text-lg shrink-0">
                      {FILE_ICONS[doc.file_type] || '📄'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/70 truncate">{doc.filename}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">
                        {doc.file_type.toUpperCase()} · {doc.total_chunks} chunk{doc.total_chunks !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.doc_id, doc.filename)}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-red-400/50 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition-all shrink-0"
                      title="Delete document"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-5 py-3 border-t border-white/5">
            <p className="text-[10px] text-white/20 leading-relaxed">
              Uploaded documents are indexed for semantic search. Ask the AI about your documents in chat.
            </p>
          </div>

          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title="Delete Document"
            message={`Are you sure you want to delete "${confirmDialog.filename}"? This cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            confirmVariant="danger"
            onConfirm={confirmDelete}
            onCancel={() => setConfirmDialog({ isOpen: false, docId: '', filename: '' })}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default KnowledgeBase
