# Облако семьи (без постоянно включённого ПК)

Данные лежат в **Cloudflare Workers + KV** — серверы Cloudflare, 24/7.

- API: `https://semejnoe-menyu-api.jazzy-selenium.workers.dev`
- Ключ семьи: `bogdaniha` (вшит в приложение)
- При любом сохранении в приложении состояние уходит в облако автоматически
- При открытии с другого телефона / через неделю — подтягивается само

**Домашний компьютер не нужен.**

## Важно: закрепить аккаунт Cloudflare (один раз)

Worker создан на preview-аккаунте. Чтобы он не истёк, один раз закрепите его:

1. Откройте: https://dash.cloudflare.com/claim-preview?claimToken=SUbCjmluo4benNPtZ3vy48NkcfHdh2zOG3DOzaFQwHY  
2. Войдите через **Continue with GitHub** (аккаунт dantrusov10)  
3. Готово — облако становится постоянным

Если ссылка истекла — напишите агенту пересоздать Worker.

## AI (free tier)

См. [LLM.md](./LLM.md). Нужно один раз:

```bash
cd cloud-api
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Ключ: https://aistudio.google.com/apikey
