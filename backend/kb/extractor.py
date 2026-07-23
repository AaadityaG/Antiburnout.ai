import os
import re
from logger import get_logger

logger = get_logger("kb.extractor")

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}


def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}")

    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext == ".txt":
        return _extract_txt(file_path)
    elif ext == ".md":
        return _extract_markdown(file_path)

    return ""


def _extract_pdf(file_path: str) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        pages = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            if text.strip():
                pages.append(text.strip())
        doc.close()
        text = "\n\n".join(pages)
        logger.info("PDF extracted", file_path=file_path, pages=len(pages), chars=len(text))
        return text
    except ImportError:
        raise RuntimeError("PyMuPDF not installed. Run: pip install PyMuPDF")
    except Exception as e:
        logger.error("PDF extraction failed", file_path=file_path, error=str(e))
        raise


def _extract_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    logger.info("TXT extracted", file_path=file_path, chars=len(text))
    return text


def _extract_markdown(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    # Strip markdown syntax for better embedding quality
    text = re.sub(r"#{1,6}\s+", "", text)          # headings
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)    # bold
    text = re.sub(r"\*(.+?)\*", r"\1", text)         # italic
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)    # code blocks
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)       # images
    text = re.sub(r"\[(.+?)\]\(.*?\)", r"\1", text)  # links
    text = re.sub(r"^[-*+]\s+", "", text, flags=re.MULTILINE)  # list markers
    text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)  # numbered lists
    logger.info("Markdown extracted", file_path=file_path, chars=len(text))
    return text
