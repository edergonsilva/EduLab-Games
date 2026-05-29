"""
Roteador de importação de módulos .edugame.

Um pacote .edugame é um arquivo ZIP renomeado com a seguinte estrutura:

    meu_jogo_v1.edugame
    ├── manifest.json        (obrigatório)
    ├── index.html           (obrigatório — ponto de entrada HTML5)
    ├── assets/              (opcional — imagens, sons, etc.)
    ├── preview/
    │   └── cover.png        (opcional — thumbnail do jogo)
    └── README.md            (opcional — documentação do módulo)

PLACEHOLDER: esta implementação é apenas um esqueleto. A lógica completa de
validação, armazenamento e publicação será implementada em versão futura.
"""

import json
import zipfile
import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.game import GameManifest

router = APIRouter()

REQUIRED_FILES = {"manifest.json", "index.html"}
REQUIRED_MANIFEST_FIELDS = {
    "id", "name", "version", "developer", "school_grades",
    "subject", "mode", "entry_point", "api_version",
}


@router.post("/edugame")
async def import_edugame(file: UploadFile = File(...)):
    """
    Importa um pacote de jogo no formato .edugame (ZIP).
    Valida o manifesto e registra o jogo com status 'test'.
    """
    if not file.filename or not file.filename.endswith(".edugame"):
        raise HTTPException(status_code=400, detail="O arquivo deve ter extensão .edugame")

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Arquivo .edugame inválido ou corrompido.")

    names = set(zf.namelist())

    missing = REQUIRED_FILES - names
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Arquivos obrigatórios ausentes no pacote: {', '.join(missing)}",
        )

    try:
        manifest_raw = json.loads(zf.read("manifest.json"))
    except Exception:
        raise HTTPException(status_code=422, detail="manifest.json inválido ou não é JSON válido.")

    missing_fields = REQUIRED_MANIFEST_FIELDS - set(manifest_raw.keys())
    if missing_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Campos obrigatórios ausentes no manifest.json: {', '.join(missing_fields)}",
        )

    try:
        manifest = GameManifest(**manifest_raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"manifest.json com dados inválidos: {exc}")

    # TODO: salvar o jogo no banco de dados e extrair os assets para o diretório correto
    manifest.status = "test"

    return {
        "ok": True,
        "message": f"Jogo '{manifest.name}' importado com sucesso. Status: test.",
        "manifest": manifest,
    }


@router.get("/edugame/spec")
async def edugame_spec():
    """Retorna a especificação oficial do formato .edugame."""
    return {
        "format": ".edugame",
        "description": "Pacote ZIP com extensão .edugame contendo o jogo educativo.",
        "required_files": list(REQUIRED_FILES),
        "optional_files": ["assets/", "preview/cover.png", "README.md"],
        "manifest_fields": {
            "id":                         "string — identificador único do jogo",
            "name":                       "string — nome exibido na plataforma",
            "version":                    "string — versão semântica (ex: 1.0.0)",
            "developer":                  "string — nome do desenvolvedor",
            "credits":                    "string — texto de créditos exibido no jogo",
            "school_grades":              "array<int> — anos escolares compatíveis (1–9)",
            "subject":                    "string|null — id da disciplina",
            "tags":                       "array<string> — palavras-chave",
            "mode":                       "array<string> — solo | duelo_local | sala_codigo",
            "min_players":                "int — mínimo de jogadores",
            "max_players":                "int — máximo de jogadores",
            "session_required":           "bool — exige código de sala",
            "supports_teacher_panel":     "bool — suporta painel do professor",
            "supports_ranking":           "bool — suporta ranking",
            "estimated_duration_minutes": "int — duração estimada em minutos",
            "entry_point":                "string — arquivo HTML de entrada (ex: index.html)",
            "thumbnail":                  "string — caminho da imagem de capa dentro do pacote",
            "description":                "string — descrição curta do jogo",
            "status":                     "string — draft | test | published | archived",
            "api_version":                "string — versão da API da plataforma (ex: 1.0)",
        },
    }
