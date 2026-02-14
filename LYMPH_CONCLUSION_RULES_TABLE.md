# Предложение правил автозаключения для шаблона «УЗИ лимфатических узлов»

Ниже — расширенный перечень правил для будущего блока `conclusionRules.json -> lymph`, составленный по аналогии с текущими подходами для `thyroidnecklymph` и `breast`.

## Таблица: № правила → JSON-ключи

| № | Что проверяет правило (кратко) | JSON-ключи (условия/выход) |
|---:|---|---|
| 1 | Нет значимых изменений во всех группах ЛУ | `fallbackConclusion`, `lymphRule.normalAmountToken` |
| 2 | Все выявленные ЛУ реактивные без `?` | `lymphRule.reactiveTokens`, `lymphRule.reactiveConclusion`, `lymphRule.reactiveRecommendation`, `lymphRule.reactiveRiskLevel=benign` |
| 3 | Все выявленные ЛУ реактивные/гиперплазированные с `?` | `lymphRule.questionMarkToken`, `lymphRule.reactiveProbableConclusion`, `lymphRule.reactiveProbableRecommendation`, `lymphRule.reactiveProbableRiskLevel=moderate` |
| 4 | Есть хотя бы один «патологический» ЛУ | `lymphRule.pathologicalToken`, `lymphRule.pathologicalFallbackConclusion`, `lymphRule.pathologicalRecommendation`, `lymphRule.pathologicalRiskLevel=high` |
| 5 | Патологические ЛУ с детализацией по группам | `lymphRule.pathologicalDetailedPrefix`, `lymphRule.amountFieldIndex`, `lymphRule.statusFieldIndex`, `lymphRule.pathologicalRecommendation` |
| 6 | Конгломерат ЛУ | `lymphRule.conglomerateConclusion`, `lymphRule.amountFieldIndex`, `lymphRule.pathologicalRiskLevel=high` |
| 7 | Одновременно патологические и реактивные ЛУ | `lymphRule.reactiveAdditionalPrefix`, `lymphRule.pathologicalDetailedPrefix`, `lymphRule.pathologicalRiskLevel=high` |
| 8 | Подозрение на лимфопролиферативное заболевание в статусе ЛУ | `lymphRule.pathologicalToken="подозрение на лимфопролиферативное заболевание"` (или через `combinedRules[].requireTagIncludes` при расширении), `conclusion`, `recommendation`, `riskLevel=high` |
| 9 | Поднижнечелюстные ЛУ реактивные | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["поднижнечелюст"]`, `conclusion`, `riskLevel=benign` |
| 10 | Поднижнечелюстные ЛУ патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["поднижнечелюст"]`, `conclusion`, `riskLevel=moderate/high` |
| 11 | Яремные верхней трети реактивные | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные в/3"]`, `conclusion`, `riskLevel=benign` |
| 12 | Яремные верхней трети патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные в/3"]`, `conclusion`, `riskLevel=high` |
| 13 | Яремные средней трети реактивные | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные ср/3"]`, `conclusion`, `riskLevel=benign` |
| 14 | Яремные средней трети патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные ср/3"]`, `conclusion`, `riskLevel=high` |
| 15 | Яремные нижней трети реактивные | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные н/3"]`, `conclusion`, `riskLevel=benign` |
| 16 | Яремные нижней трети патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные н/3"]`, `conclusion`, `riskLevel=high` |
| 17 | Надключичные ЛУ патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["надключич"]`, `conclusion`, `recommendation`, `riskLevel=high` |
| 18 | Подключичные ЛУ патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["подключич"]`, `conclusion`, `recommendation`, `riskLevel=high` |
| 19 | Подмышечные ЛУ реактивные (изолированно) | `combinedRules[].requireOnlyAxillaryLymph=true`, `combinedRules[].requireReactiveLymph=true`, `conclusion`, `riskLevel=benign` |
| 20 | Подмышечные ЛУ патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["подмышеч"]`, `conclusion`, `riskLevel=moderate/high` |
| 21 | Паховые ЛУ реактивные | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["пахов"]`, `conclusion`, `riskLevel=benign` |
| 22 | Паховые ЛУ патологические | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["пахов"]`, `conclusion`, `riskLevel=moderate` |
| 23 | Двустороннее поражение шейных ЛУ | `combinedRules[].requireLymphSides=["с обеих", "с обоих", "справа", "слева"]`, `combinedRules[].requireLymphGroupIn=["яремные", "поднижнечелюст"]`, `conclusion`, `riskLevel=moderate/high` |
| 24 | Одностороннее поражение справа | `combinedRules[].requireLymphSides=["справа"]`, `conclusion`, `riskLevel` |
| 25 | Одностороннее поражение слева | `combinedRules[].requireLymphSides=["слева"]`, `conclusion`, `riskLevel` |
| 26 | Многоуровневое поражение (≥2 анатомических групп) | `combinedRules[].minLesionsCount` (при расширении контекста по группам) / альтернативно несколько `combinedRules` по `requireLymphGroupIn`, `conclusion`, `riskLevel=high` |
| 27 | Локальное реактивное изменение одной группы | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireNoPathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=[...]`, `conclusion`, `riskLevel=benign` |
| 28 | Сомнительные патологические ЛУ (`патологический?`) | `combinedRules[].requirePathologicalOrQuestionLymph=true`, `conclusion`, `recommendation`, `riskLevel=moderate/high` |
| 29 | Реактивные ЛУ с вопросом + надключичные/подключичные | `combinedRules[].requirePathologicalOrQuestionLymph=true`, `combinedRules[].requireLymphGroupIn=["надключич", "подключич"]`, `conclusion`, `riskLevel=high` |
| 30 | Конгломерат + патологический статус | `lymphRule.conglomerateConclusion`, `combinedRules[].requirePathologicalLymph=true`, `conclusion`, `riskLevel=high` |
| 31 | Конгломерат без явного патологического статуса | `lymphRule.conglomerateConclusion`, `lymphRule.pathologicalFallbackConclusion`, `riskLevel=moderate/high` |
| 32 | Патологические ЛУ в шейных + подмышечных группах | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные", "подмышеч"]`, `conclusion`, `riskLevel=high` |
| 33 | Патологические ЛУ в шейных + паховых группах | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные", "пахов"]`, `conclusion`, `riskLevel=high` |
| 34 | Генерализованная лимфаденопатия (шея+подмышки+пах) | `combinedRules[]` (несколько правил с `requirePathologicalLymph` + `requireLymphGroupIn`), `conclusion`, `recommendation`, `riskLevel=high` |
| 35 | Только паховые реактивные ЛУ (вероятно неспецифические) | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["пахов"]`, `conclusion`, `riskLevel=benign` |
| 36 | Только шейные реактивные ЛУ | `combinedRules[].requireReactiveLymph=true`, `combinedRules[].requireLymphGroupIn=["поднижнечелюст", "яремные"]`, `conclusion`, `riskLevel=benign` |
| 37 | Только над-/подключичные ЛУ даже при «?» | `combinedRules[].requirePathologicalOrQuestionLymph=true`, `combinedRules[].requireLymphGroupIn=["надключич", "подключич"]`, `conclusion`, `riskLevel=high` |
| 38 | Реактивные ЛУ, но с конгломератом | `lymphRule.conglomerateConclusion`, `combinedRules[].requireReactiveLymph=true`, `conclusion`, `riskLevel=moderate` |
| 39 | Патологические ЛУ без конгломерата | `combinedRules[].requirePathologicalLymph=true`, `conclusion`, `riskLevel=high` |
| 40 | Подозрение на лимфопролиферативное + множественные группы | `combinedRules[].requirePathologicalOrQuestionLymph=true`, `combinedRules[].requireLymphGroupIn=[...]`, `conclusion`, `recommendation`, `riskLevel=high` |
| 41 | Приоритет high-risk над benign/moderate | `noduleRules[].group` (если появятся), `combinedRules[].priority` (предложение), приоритет в `riskLevel` |
| 42 | Шаблон рекомендаций по риску | `recommendationTemplates.benignRisk/moderateRisk/highRisk` |
| 43 | Интервал контрольного УЗИ по риску | `followUpMonthsByRisk.benign/moderate/high`, `recommendationTemplates.followUpPrefix` |
| 44 | Единое фолбэк-заключение при неполном вводе | `fallbackConclusion` |
| 45 | Подавление дублей формулировок | `deduplication.enabled=true`, `deduplication.mode="exact"` (предложение для развития схемы) |
| 46 | Формат вывода «Заключение/Рекомендации» | `outputFormat.conclusionPrefix`, `outputFormat.recommendationPrefix`, `joinMode` (предложение) |
| 47 | Отдельная рекомендация при «подозрение на лимфопролиферативное заболевание» | `combinedRules[].recommendation` с ключевой формулировкой, `riskLevel=high` |
| 48 | Усиленная рекомендация при двусторонних надключичных ЛУ | `combinedRules[].requireLymphSides=["с обеих"]`, `combinedRules[].requireLymphGroupIn=["надключич"]`, `recommendation`, `riskLevel=high` |
| 49 | Умеренный риск при одиночном патологическом паховом ЛУ | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["пахов"]`, `conclusion`, `riskLevel=moderate` |
| 50 | Высокий риск при патологических шейных + надключичных ЛУ | `combinedRules[].requirePathologicalLymph=true`, `combinedRules[].requireLymphGroupIn=["яремные", "надключич"]`, `conclusion`, `riskLevel=high` |

## Минимальный каркас JSON для `lymph` (предложение)

- `recommendationTemplates`
- `followUpMonthsByRisk`
- `fallbackConclusion`
- `lymphRule`
- `combinedRules`

