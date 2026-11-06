import { ChangeEvent, FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import JSZip from 'jszip'
import { importGame, type ImportResult } from '../api/games'
import { userErrorMessage } from '../api/errors'
import { Button, Card, Field, Input, PageContainer, PageHeader, Select, Textarea } from '../components/ui'

type ExtraQuestion = { id: number; question: string; answer: string }
type UploadKey = 'manifest' | 'script' | 'html' | 'style' | 'banner'
type Uploads = Record<UploadKey, File | null>

const initialUploads: Uploads = { manifest: null, script: null, html: null, style: null, banner: null }

/**
 * Crops an image to match the target aspect ratio (16:7)
 * maintaining the larger dimension and cropping from center
 */
async function cropImageToRatio(file: File, targetRatio: number = 16 / 7): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto do canvas'))
          return
        }

        const imgRatio = img.width / img.height
        let cropWidth = img.width
        let cropHeight = img.height
        let cropX = 0
        let cropY = 0

        // Calculate crop dimensions to match target ratio
        if (imgRatio > targetRatio) {
          // Image is wider than target - crop width
          cropWidth = img.height * targetRatio
          cropX = (img.width - cropWidth) / 2
        } else {
          // Image is taller than target - crop height
          cropHeight = img.width / targetRatio
          cropY = (img.height - cropHeight) / 2
        }

        // Set canvas to target dimensions (at least 1280x560)
        const minWidth = 1280
        const minHeight = 560
        const scale = Math.max(minWidth / cropWidth, minHeight / cropHeight)
        canvas.width = Math.round(cropWidth * scale)
        canvas.height = Math.round(cropHeight * scale)

        // Draw cropped and scaled image
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          canvas.width,
          canvas.height
        )

        // Convert canvas to blob and create new File
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Não foi possível converter imagem'))
              return
            }
            const croppedFile = new File([blob], file.name, { type: 'image/png' })
            resolve(croppedFile)
          },
          'image/png'
        )
      }
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

function makePrompt(answers: Record<string, string>, extras: ExtraQuestion[]) {
  const fence = String.fromCharCode(96).repeat(3)
  const manifestExample = JSON.stringify({
    slug: 'jogo-educacional',
    title: answers.title || 'Título do jogo',
    version: '1.0.0',
    description: answers.objective || 'Resumo do jogo',
    author: 'Nome do professor',
    grade: answers.grade || 'Ano da turma',
    subject: answers.subject || 'Disciplina',
    entry_point: 'index.html',
    api_version: '1.0.0',
  }, null, 2)
  const customAnswers = extras
    .filter((item) => item.question.trim() || item.answer.trim())
    .map((item, index) => `${index + 1}. Pergunta: ${item.question.trim()}\n   Resposta: ${item.answer.trim()}`)
    .join('\n')

  const openBrace = '{'
  const closeBrace = '}'
  const progressExample = 'window.EduLabSDK.progress(' + openBrace + ' current: etapaAtual, total: totalDeEtapas ' + closeBrace + ')'
  const completedExample = 'window.EduLabSDK.completed(' + openBrace + ' score: pontuacaoFinal, metadata: ' + openBrace + closeBrace + ' ' + closeBrace + ')'
  const postMessageEvent = 'window.parent.postMessage(' + openBrace + ' type: \'edulab.activity.event\', event_type: \'progress\', score: valorAtualDoPlacar ' + closeBrace + ', \'*\')'
  const postMessageResult = 'window.parent.postMessage(' + openBrace + ' type: \'edulab.activity.result\', score: pontuacaoFinal ' + closeBrace + ', \'*\')'
  const errorExample = 'window.EduLabSDK.error(' + openBrace + ' message ' + closeBrace + ')'

  return `Você é uma pessoa desenvolvedora experiente de jogos educacionais acessíveis para navegador e também deve criar a imagem de capa do jogo. Crie um jogo completo seguindo as especificações abaixo. Retorne quatro arquivos de código, cada um em seu próprio bloco identificado pelo nome do arquivo, e gere também um arquivo de imagem separado chamado banner.png. Não omita código nem use pseudocódigo.

## Projeto pedagógico
- Título provisório: ${answers.title}
- Ano/turma: ${answers.grade}
- Disciplina: ${answers.subject}
- Objetivo de aprendizagem: ${answers.objective}
- Conteúdo ou habilidades trabalhadas: ${answers.content}
- Faixa etária e contexto da turma: ${answers.audience}

## Mecânica e experiência
- Mecânica principal: ${answers.mechanics}
- O que o jogador vê e faz em cada turno: ${answers.turn}
- Controles e interações: ${answers.controls}
- Regras e como as respostas são avaliadas: ${answers.rules}
- Feedback para acertos, erros e progresso: ${answers.feedback}
- Condição de conclusão, vitória ou resultado: ${answers.ending}
- Duração e quantidade de fases/questões: ${answers.duration}
- Tema, personagens e direção visual: ${answers.visual}
- Acessibilidade e adaptações necessárias: ${answers.accessibility}
${customAnswers ? `\n## Requisitos adicionais do professor\n${customAnswers}` : ''}

## Imagem de capa obrigatória
- Gere uma imagem PNG real, separada dos blocos de código, com nome exato banner.png e dimensões 1280 x 560 pixels (proporção 16:7), adequada aos cards da biblioteca.
- Crie a arte com base no título, objetivo de aprendizagem, disciplina, faixa etária e direção visual do jogo. A imagem deve representar a ideia específica deste jogo, não ser uma capa genérica.
- Use uma composição horizontal clara, com o assunto principal centralizado e margem visual segura para recortes; evite texto, letras, logotipos, molduras e detalhes importantes nas bordas.
- Não entregue SVG, HTML, CSS, base64 ou código como substituto da imagem. Se esta interface não puder gerar/anexar uma imagem, forneça ao final um prompt curto e específico para um gerador de imagens criar esse PNG. O professor usará o PNG gerado no campo de capa.

## Requisitos técnicos obrigatórios
1. Retorne exatamente quatro blocos de código: manifest.json, index.html, script.js e styles.css, um por arquivo. Gere o banner.png como imagem anexada separadamente; não coloque a imagem dentro de um bloco de código.
2. O manifesto deve ser JSON válido, sem comentários. Use exatamente os campos e valores deste exemplo, substituindo-os pelos dados reais do jogo. É obrigatório preencher grade e subject com o ano e a disciplina informados acima; não omita nem deixe esses campos vazios:
${fence}json
${manifestExample}
${fence}
O slug deve conter somente letras minúsculas sem acentos, números e hífens. Mantenha entry_point como index.html e api_version como 1.0.0.
3. Faça o HTML carregar styles.css e script.js por caminhos relativos. Inclua <script src="/edulab-sdk.js"></script> antes de script.js. O jogo deve funcionar dentro de um iframe, adaptar-se a celular e desktop e não depender de servidor próprio, build ou arquivos extras.
4. Implemente toda a lógica em JavaScript puro no script.js, sem módulos externos obrigatórios. Inicialize o jogo após o DOM estar pronto e trate reiniciar/terminar sem recarregar a página.
5. Se usar ícones, use apenas ícones de uma fonte gratuita de ícones, por exemplo Bootstrap Icons como fonte web via CDN. Não desenhe, gere ou inclua SVGs. O jogo deve continuar utilizável se os ícones externos não carregarem.
6. **Imagens adicionais no jogo**: Você pode gerar quantas imagens PNG adicionais forem necessárias para o jogo (personagens, fundos, ícones, etc). Todas as imagens adicionais devem ser incluídas como arquivos PNG na raiz do pacote .edugame. No script.js, referencie essas imagens usando apenas o nome e extensão, sem caminhos de pastas: new Image().src = 'personagem.png' ou <img src="mascote.png">. A plataforma carregará automaticamente essas imagens da raiz do pacote. **Importante**: Se a IA gerar imagens com dimensões maiores que necessário, o sistema as recortará automaticamente ao melhor tamanho mantendo as proporções.
7. Não inclua arquivos locais adicionais além dos quatro arquivos de código, banner.png e as imagens adicionais em PNG. Não use recursos externos com licença restritiva.
8. Mostre instruções breves dentro do próprio jogo, feedback claro, progresso e resultado final coerentes com a mecânica. Evite expor a resposta antes da interação.
9. Garanta que nomes, perguntas e instruções estejam em português do Brasil, com linguagem apropriada à turma.
10. A integração de pontuação com a plataforma é obrigatória: identifique no seu próprio script a variável numérica que realmente guarda o placar (não invente uma variável desconectada da lógica do jogo). Sempre que essa pontuação mudar, chame window.EduLabSDK.score(valorAtualDoPlacar); durante as etapas, envie ${progressExample}; e, ao concluir, chame exatamente uma vez ${completedExample}. Envie a pontuação final somente depois de calcular o resultado real do jogo. A plataforma não consegue inferir placar lendo variáveis, texto da tela ou DOM: sem esses eventos, a pontuação não será registrada.
11. O SDK normalmente será carregado pelo <script src="/edulab-sdk.js"></script> incluído no index.html. Proteja as chamadas com verificações de existência para o jogo continuar funcionando quando aberto fora da plataforma. Se window.EduLabSDK não existir e o jogo estiver embutido, use como fallback compatível ${postMessageEvent} para atualizações e ${postMessageResult} uma única vez ao concluir. Nunca invente pontos, não envie nomes ou dados pessoais e, após concluir, ignore qualquer ação de replay em contexto de sala.
12. Informe falhas recuperáveis com ${errorExample}. A integração é opcional apenas para execução independente; em uma sala EduLab, os eventos de pontuação, progresso e conclusão são obrigatórios para o ranking registrar esses dados.
13. **Versioning e Atualizações**: Se este jogo for uma versão melhorada ou alterada de um jogo anterior, **incremente a versão semântica no manifest.json**. Por exemplo, se era 1.0.0, mude para 1.0.1 (correção) ou 1.1.0 (nova feature). O professor poderá re-enviar o jogo com versão incrementada para atualizar a versão anterior no sistema. Quando o mesmo professor re-enviar um jogo com slug idêntico, o sistema substituirá apenas se a versão for maior. Se a versão for igual ou menor, a importação será rejeitada.

## Instruções de Salvamento e Download
Após receber os quatro blocos de código e a imagem, siga um destes procedimentos:

### Opção 1: Se o seu assistente/chat suporta download direto
Forneça os arquivos como downloads diretos (um botão por arquivo). O professor baixará:
- manifest.json
- index.html
- script.js
- styles.css
- banner.png

### Opção 2: Se não há suporte a download, use o método manual
Instruções para o professor salvar cada arquivo manualmente:

1. **manifest.json**:
   - Abra o Bloco de Notas ou editor de texto
   - Copie o bloco JSON completo
   - Salve como "manifest.json" (certifique-se que é texto simples, não .txt)

2. **index.html**:
   - Abra o Bloco de Notas ou editor de texto
   - Copie o bloco HTML completo
   - Salve como "index.html" (certifique-se que é .html, não .txt)

3. **script.js**:
   - Abra o Bloco de Notas ou editor de texto
   - Copie o bloco JavaScript completo
   - Salve como "script.js" (certifique-se que é .js, não .txt)

4. **styles.css**:
   - Abra o Bloco de Notas ou editor de texto
   - Copie o bloco CSS completo
   - Salve como "styles.css" (certifique-se que é .css, não .txt)

5. **banner.png**:
   - A imagem será anexada separadamente
   - Salve ou baixe como "banner.png"

6. **Imagens adicionais do jogo (se houver)**:
   - Se o jogo incluir imagens adicionais (personagens, fundos, ícones, etc), salve cada uma como PNG na mesma pasta
   - Use os nomes indicados pela IA (ex: personagem.png, fundo.png, mascote.png)
   - O script.js fará referência a essas imagens usando apenas o nome da imagem

Após salvar todos os arquivos na mesma pasta, o professor fará um arquivo ZIP contendo todos eles, renomeará para seu_slug.edugame e enviará para importar na plataforma EduLab.

Responda com exatamente estes quatro blocos de código, anexe o arquivo banner.png e todas as imagens adicionais necessárias em PNG. Se não puder anexar imagens, escreva depois dos blocos somente prompts específicos para gerar cada imagem:
${fence}json manifest.json
...JSON completo...
${fence}
${fence}html index.html
...HTML completo...
${fence}
${fence}javascript script.js
...JavaScript completo...
${fence}
${fence}css styles.css
...CSS completo...
${fence}`
}

export function GameCreatorPage() {
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [answers, setAnswers] = useState({
    title: '', objective: '', content: '', audience: '', mechanics: '', turn: '',
    controls: '', rules: '', feedback: '', ending: '', duration: '', visual: '', accessibility: '',
  })
  const [wantsExtras, setWantsExtras] = useState(false)
  const [extras, setExtras] = useState<ExtraQuestion[]>([])
  const [nextExtraId, setNextExtraId] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const [uploads, setUploads] = useState<Uploads>(initialUploads)
  const [additionalImages, setAdditionalImages] = useState<File[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const subjectValue = subject === 'Outra' ? customSubject.trim() : subject

  function updateAnswer(key: keyof typeof answers, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  function handleGeneratePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const completeAnswers = { ...answers, grade, subject: subjectValue }
    setPrompt(makePrompt(completeAnswers, wantsExtras ? extras : []))
    setCopied(false)
    document.getElementById('generated-prompt')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function addExtraQuestion() {
    setExtras((current) => [...current, { id: nextExtraId, question: '', answer: '' }])
    setNextExtraId((id) => id + 1)
  }

  function updateExtra(id: number, key: 'question' | 'answer', value: string) {
    setExtras((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item))
  }

  function selectUpload(key: UploadKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setUploads((current) => ({ ...current, [key]: file }))
    setError(null)
    setResult(null)
  }

  function handleAdditionalImagesSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : []
    const pngFiles = files.filter(file => file.type === 'image/png' || file.name.toLowerCase().endsWith('.png'))
    
    if (files.length !== pngFiles.length) {
      setError(`Apenas arquivos PNG são aceitos. ${files.length - pngFiles.length} arquivo(s) ignorado(s).`)
    } else {
      setError(null)
    }
    
    setAdditionalImages(pngFiles)
    setResult(null)
  }

  function removeAdditionalImage(index: number) {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (Object.values(uploads).some((file) => !file)) {
      setError('Selecione os quatro arquivos do jogo e a imagem banner.png para continuar.')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const manifestFile = uploads.manifest!
      const scriptFile = uploads.script!
      const htmlFile = uploads.html!
      const styleFile = uploads.style!
      let bannerFile = uploads.banner!
      
      if (bannerFile.type !== 'image/png') {
        throw new Error('A capa precisa ser uma imagem PNG.')
      }
      
      // Auto-crop banner to 16:7 ratio and ensure minimum size
      bannerFile = await cropImageToRatio(bannerFile)
      const manifestText = await manifestFile.text()
      const manifest = JSON.parse(manifestText) as Record<string, unknown>
      const slug = typeof manifest.slug === 'string' ? manifest.slug.trim() : ''
      const title = typeof manifest.title === 'string' ? manifest.title.trim() : ''
      const version = typeof manifest.version === 'string' ? manifest.version.trim() : ''

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('O manifesto precisa ter um slug em minúsculas, usando letras, números e hífens.')
      }
      if (!title || !/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error('O manifesto precisa ter title e version no formato semântico, como 1.0.0.')
      }

      const schoolGrades = Array.isArray(manifest.school_grades)
        ? manifest.school_grades.map(String).join(', ')
        : typeof manifest.school_grades === 'string' ? manifest.school_grades.trim() : ''
      const manifestGrade = typeof manifest.grade === 'string' ? manifest.grade.trim() : schoolGrades
      const manifestSubject = typeof manifest.subject === 'string' ? manifest.subject.trim() : ''
      const finalGrade = grade.trim() || manifestGrade
      const finalSubject = subjectValue || manifestSubject
      if (!finalGrade || !finalSubject) {
        throw new Error('Informe o ano e a disciplina no questionário ou inclua grade e subject no manifesto JSON.')
      }

      manifest.grade = finalGrade
      manifest.subject = finalSubject
      manifest.entry_point = 'index.html'
      manifest.api_version = '1.0.0'
      if (!manifest.description) manifest.description = answers.objective
      manifest.thumbnail = 'banner.png'

      const zip = new JSZip()
      zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
      zip.file('script.js', scriptFile)
      zip.file('index.html', htmlFile)
      zip.file('styles.css', styleFile)
      zip.file('banner.png', bannerFile)
      
      // Add additional images to a subdirectory or root
      for (const imageFile of additionalImages) {
        zip.file(imageFile.name, imageFile)
      }
      
      const packageBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const packageFile = new File([packageBlob], `${slug}.edugame`, { type: 'application/zip' })
      setResult(await importGame(packageFile, isPublic))
    } catch (err) {
      setError(userErrorMessage(err, 'Não foi possível montar o pacote do jogo.'))
    } finally {
      setUploading(false)
    }
  }

  async function copyPrompt() {
    try {
      // Tenta usar Clipboard API (moderna e segura)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(prompt)
      } else {
        // Fallback para document.execCommand (navegadores antigos)
        const textarea = document.createElement('textarea')
        textarea.value = prompt
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        
        if (!document.execCommand('copy')) {
          throw new Error('execCommand falhou')
        }
        
        document.body.removeChild(textarea)
      }
      
      setCopied(true)
      // Reset após 2 segundos
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar prompt:', err)
      setError('Não foi possível copiar o prompt. Tente manualmente.')
      // Reset após 3 segundos
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const answerField = (key: keyof typeof answers, label: string, hint: string, placeholder: string, rows = 3) => (
    <Field hint={hint} label={label}>
      <Textarea required value={answers[key]} onChange={(event) => updateAnswer(key, event.target.value)} placeholder={placeholder} rows={rows} />
    </Field>
  )

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Oficina de criação"
        title="Planeje seu jogo"
        description="Organize a ideia, gere um prompt para sua IA e publique os arquivos do jogo."
        actions={<Link className="text-sm font-semibold text-brand no-underline hover:text-brand-dark" to="/professor/biblioteca">Voltar à biblioteca</Link>}
      />

      <form onSubmit={handleGeneratePrompt} className="grid gap-8">
        <section className="grid gap-5 border-b border-line pb-8">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">1. Turma e aprendizagem</h2>
            <p className="mt-1 text-sm text-muted">Defina para quem é o jogo e o que a turma vai praticar.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Ano da turma">
                <Select required value={grade} onChange={(event) => setGrade(event.target.value)}>
                  <option value="">Selecione o ano</option>
                  {Array.from({ length: 9 }, (_, index) => <option key={index + 1} value={`${index + 1}º ano`}>{index + 1}º ano</option>)}
                  <option value="1ª série do Ensino Médio">1ª série do Ensino Médio</option>
                  <option value="2ª série do Ensino Médio">2ª série do Ensino Médio</option>
                  <option value="3ª série do Ensino Médio">3ª série do Ensino Médio</option>
                </Select>
              </Field>
              <Field label="Disciplina">
                <Select required value={subject} onChange={(event) => setSubject(event.target.value)}>
                  <option value="">Selecione a disciplina</option>
                  {['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Arte', 'Inglês', 'Educação Física', 'Outra'].map((option) => <option key={option}>{option}</option>)}
                </Select>
              </Field>
              {subject === 'Outra' && <Field label="Nome da disciplina"><Input required value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} /></Field>}
              <Field label="Título provisório do jogo"><Input required value={answers.title} onChange={(event) => updateAnswer('title', event.target.value)} placeholder="Ex.: Missão das Frações" /></Field>
              {answerField('audience', 'Faixa etária e contexto', 'Informe idade aproximada, conhecimentos prévios e necessidades da turma.', 'Ex.: turma de 8 anos que já reconhece multiplicação simples.')}
              {answerField('objective', 'Objetivo de aprendizagem', 'O que o aluno deverá aprender ou demonstrar ao jogar?', 'Ex.: comparar frações com denominadores iguais.')}
              {answerField('content', 'Conteúdos e habilidades', 'Liste conceitos, vocabulário ou habilidades que devem aparecer.', 'Ex.: numerador, denominador, equivalência e comparação.')}
          </div>
        </section>

        <section className="grid gap-5 border-b border-line pb-8">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">2. Como o jogo funciona</h2>
            <p className="mt-1 text-sm text-muted">Descreva as ações e regras como se estivesse explicando o jogo a quem vai programá-lo.</p>
          </div>
            <div className="rounded-md border-l-4 border-brand bg-brand-pale p-4 text-sm leading-6 text-brand-dark">
              Para explicar a mecânica, conte: o que aparece na tela; o que o jogador pode tocar, arrastar, digitar ou escolher; o que acontece depois de cada ação; como o jogo informa acerto ou erro; como se avança de fase; e o que encerra a partida. Exemplo: “A cada rodada aparece uma fração e quatro cartões. O aluno escolhe a fração equivalente; recebe uma dica imediata, ganha pontos se acertar e passa por dez rodadas, com dificuldade crescente.”
            </div>
            {answerField('mechanics', 'Mecânica principal', 'Explique a ideia central e o ciclo que se repete durante a partida.', 'Ex.: explorar um mapa, resolver um desafio e escolher uma rota; cada resposta abre uma nova etapa.', 4)}
            <div className="grid gap-5 sm:grid-cols-2">
              {answerField('turn', 'O que o jogador faz em cada rodada?', 'Descreva a sequência de ações, do início ao próximo desafio.', 'Ex.: observa a pergunta, escolhe um cartão e confirma a resposta.')}
              {answerField('controls', 'Controles e interações', 'Como o aluno usa mouse, toque, teclado, arrastar e soltar ou outros controles?', 'Ex.: tocar em uma resposta; botão grande para confirmar; teclado opcional.')}
              {answerField('rules', 'Regras e avaliação', 'Como saber se a resposta está certa? Há tentativas, tempo, vidas ou pontuação?', 'Ex.: uma tentativa por questão; cada acerto vale 10 pontos; sem penalidade por erro.')}
              {answerField('feedback', 'Feedback para o aluno', 'O que aparece após acertos e erros? Inclua dicas educativas, não apenas “certo/errado”.', 'Ex.: mostrar por que a alternativa está correta e dar uma pista após o erro.')}
              {answerField('ending', 'Conclusão e resultado', 'Quando a partida termina e o que o aluno vê no resumo final?', 'Ex.: após 8 fases, apresentar pontuação, habilidades praticadas e incentivo para tentar novamente.')}
              {answerField('duration', 'Duração e quantidade de etapas', 'Informe o número aproximado de rodadas e o tempo esperado.', 'Ex.: 10 desafios em cerca de 8 minutos.')}
              {answerField('visual', 'Tema e estilo visual', 'Descreva cenário, cores, personagens e clima desejado.', 'Ex.: expedição submarina, cores claras e ilustrações simples.')}
              {answerField('accessibility', 'Acessibilidade', 'Inclua tamanho de texto, contraste, áudio, leitura, movimento reduzido ou outras adaptações.', 'Ex.: instruções curtas, alto contraste e nenhuma informação transmitida só por cor.')}
            </div>
        </section>

        <section className="grid gap-4 border-b border-line pb-8">
            <h2 className="font-display text-xl font-semibold text-ink">3. Requisitos adicionais</h2>
            <label className="flex items-start gap-3 text-sm text-ink">
              <input className="mt-0.5 size-4 rounded border-line text-brand focus:ring-brand" checked={wantsExtras} onChange={(event) => { setWantsExtras(event.target.checked); if (event.target.checked && extras.length === 0) addExtraQuestion() }} type="checkbox" />
              Quero incluir minhas próprias perguntas e respostas no prompt
            </label>
            {wantsExtras && <div className="grid gap-3">
              {extras.map((item, index) => (
                <Card key={item.id} className="grid gap-4 p-4">
                  <strong className="text-sm font-semibold text-ink">Pergunta adicional {index + 1}</strong>
                  <Field label="Pergunta"><Input value={item.question} onChange={(event) => updateExtra(item.id, 'question', event.target.value)} placeholder="O que mais a IA precisa saber?" /></Field>
                  <Field label="Resposta"><Textarea value={item.answer} onChange={(event) => updateExtra(item.id, 'answer', event.target.value)} placeholder="Descreva o requisito" rows={2} /></Field>
                </Card>
              ))}
              <Button className="justify-self-start" onClick={addExtraQuestion} type="button" variant="secondary">Adicionar outra pergunta</Button>
            </div>}
        </section>

        <Button className="justify-self-start" type="submit">Gerar prompt para minha IA</Button>
      </form>

        {prompt && (
          <section id="generated-prompt" className="mt-10 grid scroll-mt-24 gap-4 border-t border-line pt-8">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">4. Prompt pronto</h2>
              <p className="mt-1 text-sm text-muted">Copie o texto e envie para a IA de sua preferência.</p>
            </div>
            <Textarea className="min-h-96 font-mono text-xs leading-6" readOnly value={prompt} rows={22} />
            <Button className="justify-self-start" onClick={() => void copyPrompt()} type="button" variant="secondary">{copied ? 'Prompt copiado' : 'Copiar prompt'}</Button>
          </section>
        )}

        <section className="mt-10 grid gap-5 border-t border-line pt-8">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">5. Monte e publique o jogo</h2>
              <p className="mt-1 text-sm text-muted">Envie os 5 arquivos do jogo gerados pela IA (JSON, HTML, CSS, JS e Banner) mais as imagens PNG adicionais usadas pelo jogo.</p>
            </div>
            <form onSubmit={handleUpload} className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['manifest', 'Manifesto JSON', '.json,application/json'],
                  ['script', 'JavaScript', '.js,text/javascript'],
                  ['html', 'Página HTML', '.html,text/html'],
                  ['style', 'Folha de estilos CSS', '.css,text/css'],
                  ['banner', 'Banner da biblioteca (1280 x 560)', '.png,image/png'],
                ] as const).map(([key, title, accept]) => (
                  <label key={key} className="grid min-w-0 gap-2 rounded-md border border-line bg-white p-3 text-sm font-medium text-ink transition-colors hover:border-brand/50">
                    <strong>{title}</strong>
                    <input accept={accept} className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-dark hover:file:bg-brand/15" onChange={(event) => selectUpload(key, event)} required type="file" />
                    {uploads[key] && <span className="break-all text-xs text-brand-dark">{uploads[key]?.name}</span>}
                  </label>
                ))}
              </div>

              <div className="grid gap-2">
                <label className="grid min-w-0 gap-2 rounded-md border border-line bg-white p-3 text-sm font-medium text-ink transition-colors hover:border-brand/50">
                  <strong>Imagens PNG adicionais do jogo (opcional)</strong>
                  <p className="mt-0 text-xs font-normal text-muted">Selecione todas as imagens (sprites, personagens, fundos, etc.) usadas pelo jogo. Elas serão processadas automaticamente para remover fundos brancos.</p>
                  <input accept=".png,image/png" multiple className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-dark hover:file:bg-brand/15" onChange={handleAdditionalImagesSelect} type="file" />
                  {additionalImages.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-brand-dark">{additionalImages.length} arquivo(s) selecionado(s):</p>
                      <ul className="space-y-1">
                        {additionalImages.map((file, index) => (
                          <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-sm bg-brand-pale px-2 py-1 text-xs text-brand-dark">
                            <span className="truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeAdditionalImage(index)}
                              className="ml-2 font-semibold text-brand hover:text-brand-dark"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </label>
              </div>

              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-1 text-sm font-semibold text-ink">Quem pode encontrar este jogo?</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[false, true].map((publicValue) => (
                    <label key={String(publicValue)} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${isPublic === publicValue ? 'border-brand bg-brand-pale' : 'border-line bg-white hover:bg-canvas'}`}>
                      <input checked={isPublic === publicValue} className="mt-1 size-4 border-line text-brand focus:ring-brand" name="visibility" onChange={() => setIsPublic(publicValue)} type="radio" />
                      <span><strong className="block text-sm font-semibold text-ink">{publicValue ? 'Público' : 'Só eu'}</strong><span className="mt-1 block text-xs leading-5 text-muted">{publicValue ? 'Aparece no catálogo de jogos para todos.' : 'Só você poderá encontrar e usar este jogo.'}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
              {result && <Card role="status" className="bg-brand-pale p-3 text-sm text-brand-dark">{result.message} <Link className="font-semibold underline" to="/professor/biblioteca">Abrir biblioteca</Link></Card>}
              <Button className="justify-self-start" disabled={uploading} type="submit">{uploading ? 'Montando e importando…' : 'Montar e importar jogo'}</Button>
            </form>
        </section>
    </PageContainer>
  )
}