# Предложение правил автозаключения для шаблона УЗИ молочных желез

Ниже — расширенный перечень правил «по аналогии» с текущим движком `conclusionRules.json` для ЩЖ, но адаптированный под шаблон `breast`.

## Таблица: № правила → JSON-ключи

| № | Что проверяет правило (кратко) | JSON-ключи (условия/выход) |
|---:|---|---|
| 1 | Нет очаговых образований и нет патологических л/у | `fallbackConclusion`, `lesionsRule.noLesionsConclusion`, `lymphRule.normalAmountToken` |
| 2 | Любое образование BI-RADS 1–2 | `noduleRules[].biradsIn=[1,2]`, `conclusion`, `riskLevel=benign`, `group="birads-main"` |
| 3 | Любое образование BI-RADS 3 | `noduleRules[].biradsEquals=3`, `conclusion`, `riskLevel=moderate`, `group="birads-main"` |
| 4 | Любое образование BI-RADS 4 | `noduleRules[].biradsEquals=4`, `conclusion`, `riskLevel=high`, `group="birads-main"` |
| 5 | Любое образование BI-RADS 5 | `noduleRules[].biradsEquals=5`, `conclusion`, `riskLevel=high`, `group="birads-main"` |
| 6 | Множественные BI-RADS 3 (≥2) | `noduleRules[].minBiradsCount`, `biradsEquals=3`, `conclusion`, `riskLevel` |
| 7 | Мультифокальное поражение (разные квадранты) | `noduleRules[].requireQuadrantCount>=2`, `conclusion`, `riskLevel` |
| 8 | Билатеральные очаги (левая+правая) | `noduleRules[].requireBothSides=true`, `conclusion`, `riskLevel` |
| 9 | Вертикальная ориентация (taller-than-wide) | `noduleRules[].orientationIncludes=["вертикально ориентированное"]`, `conclusion`, `riskLevel` |
| 10 | Неровный+нечеткий контур | `noduleRules[].contoursIncludes=["неровное, нечеткое"]`, `conclusion`, `riskLevel` |
| 11 | Гипо/выраженно гипоэхогенное + вертикальное | `combinedRules[].requireEchogenicityIncludes`, `requireOrientationIncludes`, `conclusion`, `riskLevel` |
| 12 | Интранодулярная хаотичная васкуляризация | `noduleRules[].vascularityIncludes=["интранодулярная, хаотичная"]`, `conclusion`, `riskLevel` |
| 13 | Киста простая | `noduleRules[].tagIncludes=["киста"]`, `conclusion`, `riskLevel=benign` |
| 14 | Осложненная киста | `noduleRules[].tagIncludes=["осложненная киста"]`, `conclusion`, `riskLevel=moderate` |
| 15 | Кластер микрокист? | `noduleRules[].tagIncludes=["кластер микрокист?"]`, `conclusion`, `riskLevel=moderate` |
| 16 | Фиброаденома по типичным признакам | `combinedRules[].requireTagIncludes=["фиброаденома"]`, `requireBenignShape=true`, `conclusion`, `riskLevel=benign` |
| 17 | Филлоидная опухоль? | `noduleRules[].tagIncludes=["филлоидная опухоль?"]`, `conclusion`, `riskLevel=high` |
| 18 | Новообразование? без уточнения | `noduleRules[].tagIncludes=["новообразование?"]`, `conclusion`, `riskLevel=high` |
| 19 | BI-RADS 4/5 + патологические л/у | `combinedRules[].requireBiradsIn=[4,5]`, `requirePathologicalLymph=true`, `conclusion`, `recommendation`, `riskLevel=high` |
| 20 | BI-RADS 3 + реактивные л/у | `combinedRules[].requireBiradsIn=[3]`, `requireReactiveLymph=true`, `conclusion`, `riskLevel=moderate` |
| 21 | BI-RADS 1/2 + реактивные л/у | `combinedRules[].requireBiradsIn=[1,2]`, `requireReactiveLymph=true`, `conclusion`, `riskLevel=benign` |
| 22 | BI-RADS 4/5 без изменений л/у | `combinedRules[].requireBiradsIn=[4,5]`, `requireNoPathologicalLymph=true`, `conclusion`, `riskLevel=high` |
| 23 | Расширение млечных протоков до 2–3 мм | `ductRules[].ductsIncludes=["незначительно расширены"]`, `conclusion`, `riskLevel=benign` |
| 24 | Локальное расширение протоков | `ductRules[].ductsIncludes=["локально расширены"]`, `conclusion`, `riskLevel=moderate` |
| 25 | Диффузное расширение протоков >3 мм | `ductRules[].ductsIncludes=["диффузно расширены"]`, `conclusion`, `riskLevel=moderate` |
| 26 | Лактационный морфотип + расширение протоков | `combinedRules[].requireMorphotypeIncludes=["Лактационный"]`, `requireDuctsExpanded=true`, `conclusion`, `riskLevel=benign` |
| 27 | Постменопаузальный/инволютивный морфотип без очагов | `morphotypeRules[].morphotypeIncludes`, `requireNoLesions=true`, `conclusion`, `riskLevel=benign` |
| 28 | Плотный морфотип (ювенальный/репродуктивный) + BI-RADS 3 | `combinedRules[].requireMorphotypeIn`, `requireBiradsIn=[3]`, `conclusion`, `riskLevel=moderate` |
| 29 | Изолированная аваскулярная анэхогенная киста | `combinedRules[].requireEchogenicityIncludes=["анэхогенное"]`, `requireVascularityIncludes=["аваскулярное"]`, `conclusion`, `riskLevel=benign` |
| 30 | Подмышечные л/у: реактивные без «?» | `lymphRule.reactiveTokens`, `reactiveConclusion`, `reactiveRecommendation`, `reactiveRiskLevel` |
| 31 | Подмышечные л/у: реактивные с «?» | `lymphRule.questionMarkToken`, `reactiveProbableConclusion`, `reactiveProbableRecommendation`, `reactiveProbableRiskLevel` |
| 32 | Патологические л/у любой группы | `lymphRule.pathologicalToken`, `pathologicalFallbackConclusion`, `pathologicalRecommendation`, `pathologicalRiskLevel` |
| 33 | Патологические л/у с детализацией по группе | `lymphRule.pathologicalDetailedPrefix`, `amountFieldIndex`, `statusFieldIndex`, `pathologicalRecommendation` |
| 34 | Конгломерат л/у | `lymphRule.conglomerateConclusion`, `amountFieldIndex`, `pathologicalRiskLevel` |
| 35 | Над-/подключичные патологические л/у | `lymphRule.predefinedBlockPattern`, `combinedRules[].requireLymphGroupIn`, `conclusion`, `riskLevel=high` |
| 36 | Только подмышечные реактивные л/у | `combinedRules[].requireOnlyAxillaryLymph=true`, `requireReactiveLymph=true`, `conclusion`, `riskLevel=benign` |
| 37 | Билатеральная лимфаденопатия | `combinedRules[].requireLymphSides=["с обеих сторон"]`, `conclusion`, `riskLevel` |
| 38 | BI-RADS 3 + патологические/сомнительные л/у | `combinedRules[].requireBiradsIn=[3]`, `requirePathologicalOrQuestionLymph=true`, `conclusion`, `riskLevel=high` |
| 39 | BI-RADS 1/2 + патологические л/у | `combinedRules[].requireBiradsIn=[1,2]`, `requirePathologicalLymph=true`, `conclusion`, `riskLevel=moderate/high` |
| 40 | Одиночный доброкачественный узел без л/у | `combinedRules[].requireSingleLesion=true`, `requireBiradsIn=[2]`, `requireNoPathologicalLymph=true`, `conclusion`, `riskLevel=benign` |
| 41 | Множественные доброкачественные кисты | `combinedRules[].requireTagIncludes=["киста"]`, `minLesionsCount>=2`, `conclusion`, `riskLevel=benign` |
| 42 | Несоответствие BI-RADS и морфологии (контроль качества) | `qualityRules[].whenMorphologySuspiciousAndLowBirads`, `warningConclusion`, `riskLevel=moderate` |
| 43 | Приоритет high-risk правил над benign | `priorityRules[].order=["high","moderate","benign"]`, `noduleRules[].priority`, `combinedRules[].priority` |
| 44 | Рекомендация по уровню риска | `recommendationTemplates.benignRisk/moderateRisk/highRisk` |
| 45 | Срок контрольного УЗИ по риску | `followUpMonthsByRisk.benign/moderate/high`, `recommendationTemplates.followUpPrefix` |
| 46 | Фолбэк при пустом/неполном вводе | `fallbackConclusion`, `qualityRules[].incompleteDataConclusion` |
| 47 | BI-RADS max в протоколе как главный | `noduleRules[].group="birads-main"`, `selectionStrategy="maxBirads"` |
| 48 | Доп. правила для non-main находок | `noduleRules[].group!="birads-main"`, `allowAdditionalConclusions=true` |
| 49 | Исключение дублирующихся фраз | `deduplication.enabled=true`, `deduplication.mode="exact"` |
| 50 | Финальное объединение заключений и рекомендаций | `outputFormat.conclusionPrefix`, `outputFormat.recommendationPrefix`, `joinMode` |

## Рекомендуемый минимальный каркас JSON для `breast`

- `recommendationTemplates`
- `followUpMonthsByRisk`
- `fallbackConclusion`
- `lesionsRule`
- `noduleRules`
- `ductRules`
- `morphotypeRules`
- `lymphRule`
- `combinedRules`
- `qualityRules`
- `priorityRules`
- `deduplication`
- `outputFormat`

