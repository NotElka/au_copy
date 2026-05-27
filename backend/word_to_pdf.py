import asyncio
import tempfile
from pathlib import Path


def _convert_blocking(src: Path, dst: Path) -> None:
    # docx2pdf использует MS Word через COM — нужна явная инициализация
    # в потоке, который запускает asyncio.to_thread.
    import pythoncom

    pythoncom.CoInitialize()
    try:
        from docx2pdf import convert as docx_convert

        docx_convert(str(src), str(dst))
    finally:
        pythoncom.CoUninitialize()


async def convert_word_to_pdf(data: bytes, original_name: str) -> tuple[bytes, str]:
    suffix = Path(original_name).suffix.lower()
    if suffix not in (".doc", ".docx"):
        raise ValueError(f"unsupported suffix {suffix}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        src = tmp_dir / f"input{suffix}"
        dst = tmp_dir / "output.pdf"
        src.write_bytes(data)
        await asyncio.to_thread(_convert_blocking, src, dst)
        if not dst.exists():
            raise RuntimeError("docx2pdf produced no output")
        pdf_bytes = dst.read_bytes()

    pdf_name = Path(original_name).stem + ".pdf"
    return pdf_bytes, pdf_name
