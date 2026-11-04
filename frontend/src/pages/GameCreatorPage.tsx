import { ChangeEvent, FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import JSZip from 'jszip'
import { importGame, type ImportResult } from '../api/games'
import { userErrorMessage } from '../api/errors'
import { Button, Card, Field, Input, PageContainer, PageHeader, Select, Textarea } from '../components/ui'

type ExtraQuestion = { id: number; question: string; answer: string }
type UploadKey = 'manifest' | 'script' | 'html' | 'style'
type Uploads = Record<UploadKey, File | null>

const initialUploads: Uploads = { manifest: null, script: null, html: null, style: null }

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

  return `Você é uma pessoa desenvolvedora experiente de jogos educacionais acessíveis para navegador. Crie um jogo completo seguindo as especificações abaixo e retorne exatamente quatro arquivos, cada um em seu próprio bloco de código identificado pelo nome do arquivo. Não omita código nem use pseudocódigo.

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

## Requisitos técnicos obrigatórios
1. Retorne somente estes quatro arquivos: manifest.json, index.html, script.js e styles.css. Use exatamente um bloco de código por arquivo e identifique cada bloco com o nome do arquivo.
2. O manifesto deve ser JSON válido, sem comentários. Use exatamente os campos e valores deste exemplo, substituindo-os pelos dados reais do jogo. É obrigatório preencher grade e subject com o ano e a disciplina informados acima; não omita nem deixe esses campos vazios:
${fence}json
${manifestExample}
${fence}
O slug deve conter somente letras minúsculas sem acentos, números e hífens. Mantenha entry_point como index.html e api_version como 1.0.0.
3. Faça o HTML carregar styles.css e script.js por caminhos relativos. O jogo deve funcionar dentro de um iframe, adaptar-se a celular e desktop e não depender de servidor próprio, build ou arquivos extras.
4. Implemente toda a lógica em JavaScript puro no script.js, sem módulos externos obrigatórios. Inicialize o jogo após o DOM estar pronto e trate reiniciar/terminar sem recarregar a página.
5. Se usar ícones, use apenas ícones de uma fonte gratuita de ícones, por exemplo Bootstrap Icons como fonte web via CDN. Não desenhe, gere ou inclua SVGs. O jogo deve continuar utilizável se os ícones externos não carregarem.
6. Evite imagens, fontes ou arquivos locais adicionais; o pacote final terá apenas estes quatro arquivos. Não use recursos externos com licença restritiva.
7. Mostre instruções breves dentro do próprio jogo, feedback claro, progresso e resultado final coerentes com a mecânica. Evite expor a resposta antes da interação.
8. Garanta que nomes, perguntas e instruções estejam em português do Brasil, com linguagem apropriada à turma.
9. Integre a pontuação com a plataforma: ao mudar o placar, se window.parent !== window, envie window.parent.postMessage({ type: 'edulab.activity.event', event_type: 'progress', score: pontuacaoNumerica }, '*'). Ao terminar, envie window.parent.postMessage({ type: 'edulab.activity.result', score: pontuacaoFinalNumerica, status: 'finished' }, '*'). Use números, não texto formatado, e não envie nomes ou dados pessoais do aluno. Em contexto de sala, identifique platform_context com activity.origin igual a room e permita somente uma tentativa: esconda/desabilite reiniciar após o primeiro resultado e ignore qualquer ação de replay.

Responda exatamente neste formato, sem introdução ou explicações fora dos quatro blocos:
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

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (Object.values(uploads).some((file) => !file)) {
      setError('Selecione os quatro arquivos para continuar.')
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
      delete manifest.thumbnail

      const zip = new JSZip()
      zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
      zip.file('script.js', scriptFile)
      zip.file('index.html', htmlFile)
      zip.file('styles.css', styleFile)
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
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
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
              <p className="mt-1 text-sm text-muted">Salve cada bloco retornado pela IA no arquivo indicado e envie os quatro arquivos abaixo.</p>
            </div>
            <form onSubmit={handleUpload} className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['manifest', 'Manifesto JSON', '.json,application/json'],
                  ['script', 'JavaScript', '.js,text/javascript'],
                  ['html', 'Página HTML', '.html,text/html'],
                  ['style', 'Folha de estilos CSS', '.css,text/css'],
                ] as const).map(([key, title, accept]) => (
                  <label key={key} className="grid min-w-0 gap-2 rounded-md border border-line bg-white p-3 text-sm font-medium text-ink transition-colors hover:border-brand/50">
                    <strong>{title}</strong>
                    <input accept={accept} className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-dark hover:file:bg-brand/15" onChange={(event) => selectUpload(key, event)} required type="file" />
                    {uploads[key] && <span className="break-all text-xs text-brand-dark">{uploads[key]?.name}</span>}
                  </label>
                ))}
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