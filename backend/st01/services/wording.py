"""OPTIONAL LLM wording layer. The rules decide everything; the LLM may only rephrase (e.g. into Tamil/Hindi).
Disabled unless ANTHROPIC_API_KEY and ST01_LLM_MODEL are set. Guardrail: output must contain exactly the same numbers."""
import os, re
import requests

NUM = re.compile(r"\d+(?:\.\d+)?")


def numbers_preserved(src, out):
    return sorted(NUM.findall(src)) == sorted(NUM.findall(out))


def polish(lines, language="simple English"):
    key, model = os.environ.get("ANTHROPIC_API_KEY"), os.environ.get("ST01_LLM_MODEL")
    if not key or not model or not lines:
        return lines, False
    prompt = (f"Rewrite each line below as simple, friendly farm advice in {language}. Keep every number, unit, crop and "
              "fertilizer name exactly as written. Do not add new advice or claims. Return exactly one line per input line, "
              "nothing else.\n\n" + "\n".join(lines))
    try:
        r = requests.post("https://api.anthropic.com/v1/messages", timeout=20,
                          headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                          json={"model": model, "max_tokens": 800, "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        out = [l.strip() for l in r.json()["content"][0]["text"].strip().splitlines() if l.strip()]
        if len(out) != len(lines) or not all(numbers_preserved(a, b) for a, b in zip(lines, out)):
            return lines, False                 # guardrail tripped -> keep the rule-based text
        return out, True
    except Exception:
        return lines, False
