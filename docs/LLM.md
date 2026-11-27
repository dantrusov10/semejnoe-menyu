# Free-tier LLM (без своего сервера)

Всё через уже существующий **Cloudflare Worker** + KV.

## Провайдеры

| Задача | Провайдер | Секрет / binding |
|--------|-----------|------------------|
| Умные замены (текст) | Gemini 2.0 Flash **или** Workers AI Llama | `GEMINI_API_KEY` и/или `[ai] binding = "AI"` |
| Фото полки | Gemini 2.0 Flash (vision) | `GEMINI_API_KEY` |

Ключ Gemini: https://aistudio.google.com/apikey (бесплатный tier).

## Один раз настроить Worker

```bash
cd cloud-api
npx wrangler secret put GEMINI_API_KEY
# вставить ключ из AI Studio

npx wrangler deploy
```

Workers AI включается строкой `[ai] binding = "AI"` в `wrangler.toml` (уже есть).

## Эндпоинты

- `GET /ai/quota` — лимиты дня (suggest 40, vision 10)
- `POST /ai/suggest` — переранжирование shortlist
- `POST /ai/vision` — фото → черновик продуктов

Без ключа: suggest падает на локальный скорер; vision отвечает 501.

## Клиент

- Рецепт → «Умная замена» зовёт `/ai/suggest`
- Запасы → «Пополнить» → «С фото»
