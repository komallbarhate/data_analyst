from groq import Groq
from config import settings
import json
import re


class LLMClient:
    """Groq LLM client wrapper for structured outputs."""

    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = settings.GROQ_MODEL

    def chat(self, messages: list[dict], temperature: float = 0.1) -> str:
        """Send a chat completion request and return the text response."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=4096,
        )
        return response.choices[0].message.content

    def chat_json(self, messages: list[dict], temperature: float = 0.1) -> dict:
        """Send a chat completion request and parse JSON response."""
        # Add JSON instruction to system message
        json_messages = messages.copy()
        if json_messages and json_messages[0]["role"] == "system":
            json_messages[0]["content"] += "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation."
        else:
            json_messages.insert(0, {
                "role": "system",
                "content": "Respond ONLY with valid JSON. No markdown, no explanation."
            })

        content = self.chat(json_messages, temperature)

        # Strip markdown code blocks if present
        content = re.sub(r"```(?:json)?\s*", "", content)
        content = content.replace("```", "").strip()

        # Find JSON object/array
        match = re.search(r'[\[{].*[\]}]', content, re.DOTALL)
        if match:
            content = match.group()

        return json.loads(content)


# Singleton
llm_client = LLMClient()
