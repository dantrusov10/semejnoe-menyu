# Семейная кухня

**Онлайн:** https://dantrusov10.github.io/semejnoe-menyu/  
**Репозиторий:** https://github.com/dantrusov10/semejnoe-menyu

ОС домашней еды для семьи из трёх: запасы → меню → корзина → готовка → деньги.  
Магазины: Ашан, Пятёрочка, [Парное мясо](https://parnoemjaso.ru/).

## Возможности

- **Общие запасы** между телефонами (GitHub Gist) — см. [docs/SYNC.md](docs/SYNC.md)
- Профили **Кухня** / **Командный центр**
- План недели, корзина по магазинам, подбор блюд из запасов
- Подробные рецепты + фильтры (тип, категория, белок, время, теги, Fuse.js поиск)
- **Статистика** за произвольный период (Chart.js): траты и популярные товары
- Бюджет: готовка / вино / джин / вкусняшки
- Адаптив: телефон / планшет / ноутбук / десктоп (Bootstrap 5)

## Open-source стек UI

Bootstrap 5 · Bootstrap Icons · Chart.js · Fuse.js · Tom Select · dayjs

## Синхронизация (обязательно для двух телефонов)

1. Раздел **Синхрон** в приложении  
2. Токен GitHub classic с правом `gist` на каждом устройстве  
3. Инструкция: [docs/SYNC.md](docs/SYNC.md)

## Документы

| Файл | Зачем |
|------|--------|
| [docs/PRODUCT-ARCHITECTURE.md](docs/PRODUCT-ARCHITECTURE.md) | Архитектура |
| [docs/SYNC.md](docs/SYNC.md) | Общие остатки |
| [BRIEF.md](BRIEF.md) | Бриф семьи |

```bash
node tools/build.mjs   # пересборка data/*.js и prototype.html (index.html не трогает)
```
