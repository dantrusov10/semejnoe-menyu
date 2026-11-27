# Семейная кухня

**Онлайн:** https://dantrusov10.github.io/semejnoe-menyu/

ОС домашней еды: запасы → меню → корзина → готовка → деньги.  
Облако **Cloudflare** — домашний ПК **не нужен**. Сохранил в приложении → само в облаке; открыл с другого телефона → само подтянулось.

## Облако

- API: https://semejnoe-menyu-api.aspiring-detective.workers.dev  
- Семья: ключ `bogdaniha` (вшит)  
- Инструкция: [docs/SYNC.md](docs/SYNC.md)

**Один раз закрепить облако** (чтобы preview-аккаунт Cloudflare не истёк):  
https://dash.cloudflare.com/claim-preview?claimToken=jcIWLgkR2x5xyHUB1fssl49dNOzSfd5zD0xY5tNnIXU  
→ Sign in with **GitHub** (dantrusov10).

## Стек

Bootstrap 5 · Chart.js · Fuse.js · Tom Select · dayjs · Cloudflare Workers/KV
