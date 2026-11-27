# Облако семьи (без постоянно включённого ПК)

Данные лежат в **Cloudflare Workers + KV** — серверы Cloudflare, 24/7.

- API: `https://semejnoe-menyu-api.jazzy-selenium.workers.dev`
- Ключ семьи: `bogdaniha` (вшит в приложение)
- При любом сохранении в приложении состояние уходит в облако автоматически
- При открытии с другого телефона / через неделю — подтягивается само

**Домашний компьютер не нужен.**

## Cloudflare

Preview-аккаунт **Jazzy Selenium** закреплён (claim выполнен).  
API: `https://semejnoe-menyu-api.jazzy-selenium.workers.dev`

Если Worker пропал — напишите агенту пересоздать.

## AI (free tier)

См. [LLM.md](./LLM.md). Нужно один раз:

```bash
cd cloud-api
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Ключ: https://aistudio.google.com/apikey
