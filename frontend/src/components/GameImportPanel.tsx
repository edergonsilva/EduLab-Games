import { ChangeEvent, FormEvent, useState } from 'react'
import JSZip from 'jszip'
import { importGame } from '../api/games'
import { userErrorMessage } from '../api/errors'
import { Button, Card, Field } from './ui'

interface Props {
  onImportSuccess: () => void
}

export function GameImportPanel({ onImportSuccess }: Props) {
  const [edugameFile, setEdugameFile] = useState<File | null>(null)
  const [additionalImages, setAdditionalImages] = useState<File[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleEdugameSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      setEdugameFile(file)
      setError(null)
      setSuccess(null)
    }
  }

  const handleImagesSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files ? Array.from(e.currentTarget.files) : []
    const pngFiles = files.filter(file => file.type === 'image/png' || file.name.toLowerCase().endsWith('.png'))
    
    if (files.length !== pngFiles.length) {
      setError(`Apenas arquivos PNG são aceitos. ${files.length - pngFiles.length} arquivo(s) ignorado(s).`)
    }
    
    setAdditionalImages(pngFiles)
    setError(null)
  }

  const removeImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!edugameFile) {
      setError('Selecione um arquivo .edugame para importar.')
      return
    }

    setImporting(true)
    setError(null)
    setSuccess(null)

    try {
      let fileToImport = edugameFile

      // If there are additional images, add them to the .edugame
      if (additionalImages.length > 0) {
        const zip = new JSZip()
        const zipContent = await edugameFile.arrayBuffer()
        const loadedZip = await zip.loadAsync(zipContent)

        // Add additional PNG files to the root of the ZIP
        additionalImages.forEach(imgFile => {
          loadedZip.file(imgFile.name, imgFile)
        })

        // Generate new .edugame file
        const newZipBlob = await loadedZip.generateAsync({ type: 'blob' })
        fileToImport = new File([newZipBlob], edugameFile.name, { type: 'application/zip' })
      }

      // Import the game
      const result = await importGame(fileToImport)
      
      setSuccess(`Jogo "${result.game.title}" importado com sucesso! Versão ${result.game.version}.`)
      setEdugameFile(null)
      setAdditionalImages([])
      
      // Reset file inputs
      const edugameInput = document.getElementById('edugame-input') as HTMLInputElement
      const imagesInput = document.getElementById('images-input') as HTMLInputElement
      if (edugameInput) edugameInput.value = ''
      if (imagesInput) imagesInput.value = ''

      // Notify parent to reload games
      onImportSuccess()
    } catch (err) {
      setError(userErrorMessage(err, 'Erro ao importar jogo.'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="mb-2 font-display text-lg font-semibold text-ink">Importar jogo</h3>
      <p className="mb-4 text-sm text-muted">Selecione um arquivo <code>.edugame</code> e, opcionalmente, imagens PNG adicionais para incluir no jogo.</p>

      {error && (
        <div role="alert" className="mb-4 rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="mb-4 rounded-md border-l-4 border-green-400 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <Field label="Arquivo .edugame">
          <input
            id="edugame-input"
            type="file"
            accept=".edugame,application/zip"
            onChange={handleEdugameSelect}
            required
            disabled={importing}
            className="block w-full text-sm text-muted file:mr-4 file:rounded file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-canvas disabled:opacity-50"
          />
          {edugameFile && (
            <p className="mt-2 text-sm text-ink">
              Selecionado: <strong>{edugameFile.name}</strong>
            </p>
          )}
        </Field>

        <Field label="Imagens PNG adicionais (opcional)">
          <input
            id="images-input"
            type="file"
            accept=".png,image/png"
            multiple
            onChange={handleImagesSelect}
            disabled={importing}
            className="block w-full text-sm text-muted file:mr-4 file:rounded file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-canvas disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-muted">
            Use apenas imagens PNG. Elas serão adicionadas à raiz do pacote .edugame e o sistema removerá automaticamente fundos brancos.
          </p>
        </Field>

        {additionalImages.length > 0 && (
          <div className="grid gap-2">
            <label className="text-sm font-medium text-ink">
              Imagens selecionadas ({additionalImages.length}):
            </label>
            <div className="grid gap-2">
              {additionalImages.map((img, index) => (
                <div key={index} className="flex items-center justify-between rounded-md border border-line bg-white p-2">
                  <span className="text-sm text-ink">{img.name}</span>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    disabled={importing}
                    className="text-xs font-medium text-danger hover:text-danger-dark disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button type="submit" disabled={!edugameFile || importing}>
          {importing ? 'Importando…' : 'Importar jogo'}
        </Button>
      </form>
    </Card>
  )
}
