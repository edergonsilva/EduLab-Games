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
"""

import io
import json
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.game import GameManifest
from app.services.storage import save_imported_game

router = APIRouter()

REQUIRED_FILES = {"manifest.json", "index.html"}
REQUIRED_MANIFEST_FIELDS = {
    "id", "name", "version", "developer", "school_grades",
    "subject", "mode", "entry_point", "api_version",
}


@router.post("/edugame")
async def import_edugame(file: UploadFile = File(...)):
    """
    Importa um pacote de jogo no formato .edugame (ZIP), valida o manifesto,
    salva os arquivos localmente e persiste o jogo com status 'test'.
    """
    if not file.filename or not file.filename.endswith(".edugame"):
        raise HTTPException(status_code=400, detail="O arquivo deve ter extensão .edugame")

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Arquivo .edugame inválido ou corrompido.") from exc

    names = set(zf.namelist())

    missing = REQUIRED_FILES - names
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Arquivos obrigatórios ausentes no pacote: {', '.join(sorted(missing))}",
        )

    try:
        manifest_raw = json.loads(zf.read("manifest.json"))
    except Exception as exc:
        raise HTTPException(status_code=422, detail="manifest.json inválido ou não é JSON válido.") from exc

    missing_fields = REQUIRED_MANIFEST_FIELDS - set(manifest_raw.keys())
    if missing_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Campos obrigatórios ausentes no manifest.json: {', '.join(sorted(missing_fields))}",
        )

    try:
        manifest = GameManifest(**manifest_raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"manifest.json com dados inválidos: {exc}") from exc

    if manifest.entry_point not in names:
        raise HTTPException(status_code=422, detail="O arquivo informado em entry_point não existe dentro do pacote.")

    try:
        manifest, created = save_imported_game(manifest, content, zf)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "ok": True,
        "created": created,
        "message": (
            f"Jogo '{manifest.name}' importado com sucesso em modo test."
            if created
            else f"Jogo '{manifest.name}' atualizado com sucesso em modo test."
        ),
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
            "session_required":           "bool — obrigatório apenas quando o jogo funciona somente via sala_codigo",
            "supports_teacher_panel":     "bool — suporta painel do professor",
            "supports_ranking":           "bool — suporta ranking",
            "estimated_duration_minutes": "int — duração estimada em minutos",
            "entry_point":                "string — arquivo HTML de entrada (ex: index.html)",
            "thumbnail":                  "string — caminho opcional da imagem de capa dentro do pacote",
            "description":                "string — descrição curta do jogo",
            "status":                     "string — draft | test | published | archived",
            "api_version":                "string — versão da API da plataforma (ex: 1.0)",
        },
    }
