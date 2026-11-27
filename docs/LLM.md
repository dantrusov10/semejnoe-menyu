# Free-tier LLM (без своего сервера)

Всё через уже существующий **Cloudflare Worker** + KV.

## Провайдеры

| Задача | Провайдер | Секрет / binding |
|--------|-----------|------------------|
| Умные замены (текст) | Gemini 3.5 Flash Lite (+ fallback) **или** Workers AI Llama | `GEMINI_API_KEY` и/или `[ai] binding = "AI"` |
| Фото полки | Gemini 3.5 Flash Lite (vision) | `GEMINI_API_KEY` |

Ключ Gemini: https://aistudio.google.com/apikey (бесплатный tier).

## Безопасность ключа

- Ключ **не** хранится в GitHub и не должен попадать в клиентский JS.
- Прод: только **Cloudflare Worker Secret** `GEMINI_API_KEY` (шифруется на стороне CF).
- Локально: `cloud-api/.dev.vars` (в `.gitignore`).
- Файл на рабочем столе `Google API Key.txt` — только у вас на ПК, не в репо.
- Скрипт `cloud-api/scripts/put-gemini-secret.ps1` читает ключ с Desktop и шлёт в CF Secrets, не коммитя его.

## Один раз настроить Worker

```powershell
cd cloud-api
npx wrangler login
.\scripts\put-gemini-secret.ps1
```

Или вручную: `npx wrangler secret put GEMINI_API_KEY` (вставить ключ) → `npx wrangler deploy`.

Workers AI включается строкой `[ai] binding = "AI"` в `wrangler.toml` (уже есть).

## Эндпоинты

- `GET /ai/quota` — лимиты дня (suggest 40, vision 10)
- `POST /ai/suggest` — переранжирование shortlist
- `POST /ai/vision` — фото → черновик продуктов

Без ключа: suggest падает на локальный скорер; vision отвечает 501.

## Клиент

- Рецепт → «Умная замена» зовёт `/ai/suggest`
- Запасы → «Пополнить» → «С фото»
