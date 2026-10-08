"""STRETCH: pull N/P/K/pH/OC from a soil-test report (text or text-based PDF) so the farmer does not retype it."""
import re

PATTERNS = {
    "N": r"(?:available\s+nitrogen|nitrogen|\bN\b)\D{0,25}?(\d+(?:\.\d+)?)",
    "P": r"(?:available\s+phosphorus|phosphorus|olsen\s*p|\bP\b)\D{0,25}?(\d+(?:\.\d+)?)",
    "K": r"(?:available\s+potassium|potassium|\bK\b)\D{0,25}?(\d+(?:\.\d+)?)",
    "pH": r"\bpH\b\D{0,15}?(\d+(?:\.\d+)?)",
    "OC": r"(?:organic\s+carbon|\bOC\b)\D{0,20}?(\d+(?:\.\d+)?)",
}


def parse_report_text(text):
    out = {}
    for k, pat in PATTERNS.items():
        m = re.search(pat, text, flags=re.I)
        if m:
            out[k] = float(m.group(1))
    return out


def parse_pdf(fileobj):
    try:
        import pdfplumber
    except ImportError:
        raise RuntimeError("pdfplumber is not installed (pip install pdfplumber)")
    with pdfplumber.open(fileobj) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    return parse_report_text(text), text
