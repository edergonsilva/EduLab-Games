#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip())
    normalized = normalized.strip("-._")
    return normalized or "game"


def _resolve_entry_point(game_dir: Path, entry_point: str) -> Path:
    if not entry_point:
        raise ValueError("O campo 'entry_point' está vazio no manifest.json.")

    entry_path = Path(entry_point)
    if entry_path.is_absolute() or ".." in entry_path.parts:
        raise ValueError("O campo 'entry_point' não pode usar caminho absoluto nem '..'.")

    game_root = game_dir.resolve()
    resolved = (game_dir / entry_path).resolve()
    try:
        resolved.relative_to(game_root)
    except ValueError as exc:
        raise ValueError("O campo 'entry_point' deve apontar para arquivo dentro do diretório do jogo.") from exc
    if not resolved.exists():
        raise ValueError(f"O arquivo de entry_point não existe: {entry_point}")
    if not resolved.is_file():
        raise ValueError(f"O entry_point precisa apontar para um arquivo: {entry_point}")
    return resolved


def validate_game_dir(game_dir: Path) -> dict:
    if not game_dir.exists() or not game_dir.is_dir():
        raise ValueError(f"Diretório de jogo inválido: {game_dir}")

    manifest_path = game_dir / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("Arquivo obrigatório ausente: manifest.json")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"manifest.json inválido: {exc}") from exc

    entry_point = manifest.get("entry_point")
    if not isinstance(entry_point, str):
        raise ValueError("manifest.json deve conter 'entry_point' como string.")
    _resolve_entry_point(game_dir, entry_point)

    return manifest


def _default_output_name(game_dir: Path, manifest: dict) -> str:
    game_id = manifest.get("id")
    version = manifest.get("version")
    if isinstance(game_id, str) and isinstance(version, str):
        return f"{_slug(game_id)}-{_slug(version)}.edugame"
    return f"{_slug(game_dir.name)}.edugame"


def _iter_files(game_dir: Path, output_file: Path) -> list[Path]:
    files: list[Path] = []
    game_root = game_dir.resolve()
    resolved_output = output_file.resolve()
    for path in sorted(game_dir.rglob("*")):
        if not path.is_file():
            continue
        if path == resolved_output:
            continue
        if path.suffix == ".edugame":
            continue
        if path.is_symlink():
            resolved_path = path.resolve()
            try:
                resolved_path.relative_to(game_root)
            except ValueError as exc:
                rel = path.relative_to(game_dir).as_posix()
                raise ValueError(f"Link simbólico inseguro fora do diretório do jogo: {rel}") from exc
        files.append(path)
    return files


def package_game(game_dir: Path, output_file: Path) -> int:
    files = _iter_files(game_dir, output_file)
    if not files:
        raise ValueError("Nenhum arquivo encontrado para empacotar.")

    output_file.parent.mkdir(parents=True, exist_ok=True)
    if output_file.exists():
        output_file.unlink()

    with zipfile.ZipFile(output_file, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in files:
            archive.write(file_path, file_path.relative_to(game_dir).as_posix())
    return len(files)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Empacotador oficial de jogos .edugame (ZIP padronizado).",
    )
    parser.add_argument(
        "game_dir",
        help="Diretório raiz do jogo contendo manifest.json.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Diretório de saída do pacote (padrão: <game_dir>/dist).",
    )
    parser.add_argument(
        "--output-name",
        default=None,
        help="Nome final do arquivo .edugame (padrão: derivado de id+version do manifest).",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Somente valida o pacote sem gerar arquivo .edugame.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    game_dir = Path(args.game_dir).expanduser().resolve()

    try:
        manifest = validate_game_dir(game_dir)
    except ValueError as exc:
        print(f"❌ Validação falhou: {exc}", file=sys.stderr)
        return 1

    if args.validate_only:
        print(f"✅ Validação concluída: {game_dir}")
        return 0

    output_dir = Path(args.output_dir).expanduser().resolve() if args.output_dir else game_dir / "dist"
    output_name = args.output_name or _default_output_name(game_dir, manifest)

    if not output_name.endswith(".edugame"):
        output_name = f"{output_name}.edugame"

    output_file = output_dir / output_name

    try:
        total_files = package_game(game_dir, output_file)
    except ValueError as exc:
        print(f"❌ Empacotamento falhou: {exc}", file=sys.stderr)
        return 1

    print(f"✅ Pacote gerado: {output_file}")
    print(f"📦 Arquivos incluídos: {total_files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
