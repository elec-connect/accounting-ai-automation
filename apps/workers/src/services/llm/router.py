import json
from core.config import get_settings
from core.logging import get_logger


logger = get_logger(__name__)


def _is_placeholder_key(key: str) -> bool:
    if not key: return True
    if "xxxx" in key.lower(): return True
    if "placeholder" in key.lower(): return True
    if key.startswith("sk-proj-xxx"): return True
    return False


class LLMRouter:
    def __init__(self):
        settings = get_settings()
        self.use_stub = _is_placeholder_key(settings.OPENAI_API_KEY)
        self.openai = None
        if not self.use_stub:
            try:
                from openai import OpenAI
                self.openai = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception:
                self.use_stub = True
        logger.info(f"LLM Router in {'STUB' if self.use_stub else 'REAL'} mode")

    def call(self, model: str, prompt: str, max_tokens: int = 1000,
             temperature: float = 0, response_format: dict | None = None) -> str:
        if self.use_stub:
            return self._stub_response(prompt, model)
        if model.startswith("gpt"):
            return self._call_openai(model, prompt, max_tokens, temperature, response_format)
        raise ValueError(f"Unknown model: {model}")

    def _call_openai(self, model, prompt, max_tokens, temperature, response_format):
        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format:
            kwargs["response_format"] = response_format
        response = self.openai.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    def _stub_response(self, prompt: str, model: str) -> str:
        logger.info("LLM STUB called", extra={"extra_model": model})

        if "Classify this document" in prompt:
            return "invoice"

        if "Return ONLY a JSON object" in prompt:
            return json.dumps({
                "fields": {
                    "supplier_name": "Acme Ltd",
                    "invoice_number": "INV-2026-001",
                    "date": "2026-10-07",
                    "due_date": "2026-11-07",
                    "total_amount": 1250.00,
                    "vat_amount": 250.00,
                    "currency": "GBP",
                    "description": "Consulting services",
                    "_confidence": 0.92,
                }
            })

        return "STUB response"
