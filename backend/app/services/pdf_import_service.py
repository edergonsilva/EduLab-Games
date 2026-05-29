"""
Serviço de importação de alunos via PDF.

PLACEHOLDER: Este serviço está preparado para receber e processar o modelo
de lista de alunos em PDF do sistema municipal de Itajaí.

O PDF contém colunas como:
  Nº | Matrícula | Nome | Data Nasc. | E-mail | Telefone

Bibliotecas recomendadas para extração:
  - pdfplumber  (text-based PDFs — recomendado)
  - pymupdf     (alternativa rápida)
  - camelot     (PDFs tabelares mais complexos)

Para ativar, instale pdfplumber (já está no requirements.txt).

TODO:
  - Implementar extract_students_from_pdf()
  - Validar e normalizar dados extraídos
  - Vincular alunos a uma sala/turma
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StudentRecord:
    numero: Optional[str] = None
    matricula: Optional[str] = None
    nome: str = ""
    data_nascimento: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None


def extract_students_from_pdf(pdf_bytes: bytes) -> list[StudentRecord]:
    """
    Extrai a lista de alunos a partir de um PDF no formato da secretaria de Itajaí.

    Args:
        pdf_bytes: conteúdo binário do arquivo PDF.

    Returns:
        Lista de StudentRecord com os dados extraídos.

    Raises:
        NotImplementedError: enquanto a implementação estiver pendente.
    """
    # TODO: implementar extração com pdfplumber
    # Exemplo de estrutura esperada:
    #
    # import pdfplumber
    # import io
    #
    # students = []
    # with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    #     for page in pdf.pages:
    #         tables = page.extract_tables()
    #         for table in tables:
    #             for row in table[1:]:  # pula cabeçalho
    #                 students.append(StudentRecord(
    #                     numero=row[0],
    #                     matricula=row[1],
    #                     nome=row[2],
    #                     data_nascimento=row[3],
    #                     email=row[4],
    #                     telefone=row[5],
    #                 ))
    # return students

    raise NotImplementedError(
        "Importação de alunos via PDF ainda não implementada. "
        "Veja os comentários em services/pdf_import_service.py para guia de implementação."
    )
