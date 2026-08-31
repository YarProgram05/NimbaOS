import fs from 'node:fs'
import path from 'node:path'

type Article = {
  article: string
  salesRub: number
  avgRealizedPriceRub: number
  operatingProfitRub: number
  marginPct: number
  breakEvenPriceIncreasePctStaticVolume: number
  breakEvenAvgRealizedPriceRub: number
}

type Analysis = {
  generatedAt: string
  cabinet: {
    salesRub: number
    operatingProfitRub: number
    marginPct: number
    adsRub: number
    commissionRub: number
    commissionPctOfPreSppSales: number
    logisticsRub: number
    costPriceRub: number
    breakEvenPriceIncreasePctStaticVolume: number
    targetFivePctMarginPriceIncreasePctStaticVolume: number
    counterfactualAtJulyCommissionRate: {
      julyEffectiveCommissionPct: number
      commissionRub: number
      operatingProfitRub: number
      marginPct: number
    }
  }
  julyBaseline: {
    operatingProfitRub: number
    marginPct: number
  }
  actionSummary: {
    raisePriceOrStop: Article[]
    keep: Article[]
    monitorLowMargin: Article[]
  }
}

const root = process.cwd()
const inputPath = path.join(root, 'output', 'analysis', 'nimba_margin_response_2026-08-01_12.json')
const outputDir = path.join(root, 'output', 'reports', 'nimba_margin_recovery_august_2026')
const outputPath = path.join(outputDir, 'nimba_margin_recovery_august_2026.html')
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as Analysis

const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const one = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signedRub = (value: number) => `${value >= 0 ? '+' : '−'}${rub.format(Math.abs(value))} ₽`
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char))

const negatives = data.actionSummary.raisePriceOrStop
const top10 = negatives.slice(0, 10)
const totalNegativeLoss = Math.abs(negatives.reduce((sum, row) => sum + row.operatingProfitRub, 0))
const top10Loss = Math.abs(top10.reduce((sum, row) => sum + row.operatingProfitRub, 0))
const top10Share = top10Loss / totalNegativeLoss * 100
const maxLoss = Math.max(...top10.map((row) => Math.abs(row.operatingProfitRub)))

const priceTest = negatives
  .filter((row) => row.salesRub > 0 && row.breakEvenPriceIncreasePctStaticVolume <= 15)
  .sort((a, b) => a.breakEvenPriceIncreasePctStaticVolume - b.breakEvenPriceIncreasePctStaticVolume)

const stopFirst = negatives
  .filter((row) => row.salesRub > 0 && row.breakEvenPriceIncreasePctStaticVolume > 25)
  .sort((a, b) => a.operatingProfitRub - b.operatingProfitRub)

const noSales = negatives.filter((row) => row.salesRub <= 0)
const keep = [...data.actionSummary.keep].sort((a, b) => b.operatingProfitRub - a.operatingProfitRub)

const tableRows = (rows: Article[], limit = rows.length) => rows.slice(0, limit).map((row) => `
  <tr>
    <td><strong>${esc(row.article)}</strong></td>
    <td class="num">${rub.format(row.salesRub)} ₽</td>
    <td class="num loss">${signedRub(row.operatingProfitRub)}</td>
    <td class="num">${one.format(row.marginPct)}%</td>
    <td class="num"><strong>+${one.format(row.breakEvenPriceIncreasePctStaticVolume)}%</strong></td>
    <td class="num">${rub.format(row.avgRealizedPriceRub)} → ${rub.format(row.breakEvenAvgRealizedPriceRub)} ₽</td>
  </tr>`).join('')

const chartRows = top10.map((row, index) => `
  <div class="bar-row">
    <div class="bar-label"><span>${index + 1}. ${esc(row.article)}</span><strong>${signedRub(row.operatingProfitRub)}</strong></div>
    <div class="track"><div class="bar" style="width:${Math.max(4, Math.abs(row.operatingProfitRub) / maxLoss * 100).toFixed(1)}%"></div></div>
  </div>`).join('')

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>План восстановления маржи WB Nimba — август 2026</title>
  <style>
    :root{--ink:#18222d;--muted:#62707d;--paper:#f4f1eb;--card:#fff;--navy:#17324d;--teal:#21847b;--red:#b6403a;--amber:#c47a23;--line:#d9d4cb;--green:#2d765c}
    *{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
    .page{max-width:1180px;margin:0 auto;padding:40px 28px 72px}.eyebrow{font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:var(--teal);font-weight:800}
    h1{font:700 clamp(34px,5vw,62px)/1.02 Georgia,serif;max-width:920px;margin:10px 0 14px;color:var(--navy)} h2{font:700 30px/1.15 Georgia,serif;color:var(--navy);margin:0 0 10px} h3{margin:0 0 8px;font-size:18px}
    .lead{max-width:900px;font-size:19px;color:#344250;margin:0 0 24px}.meta{color:var(--muted);font-size:13px}.grid{display:grid;gap:16px}.kpis{grid-template-columns:repeat(4,minmax(0,1fr));margin:28px 0 18px}
    .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 7px 20px rgba(27,43,58,.05)}.kpi .value{font:700 31px/1 Georgia,serif;margin:8px 0 7px}.kpi .label{color:var(--muted);font-size:13px}.bad{color:var(--red)}.good{color:var(--green)}
    .callout{margin:16px 0 34px;border-left:5px solid var(--red);padding:18px 20px;background:#fff7f5;border-radius:0 14px 14px 0;font-size:17px}.callout strong{color:var(--red)}
    section{margin-top:42px}.two{grid-template-columns:1.05fr .95fr}.steps{counter-reset:step;display:grid;gap:12px}.step{position:relative;padding:18px 18px 18px 64px;background:#fff;border:1px solid var(--line);border-radius:14px}.step:before{counter-increment:step;content:counter(step);position:absolute;left:18px;top:18px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--navy);color:#fff;font-weight:800}.step p{margin:3px 0 0;color:#465462}
    .decision{border-top:4px solid var(--teal)}.decision.stop{border-top-color:var(--red)}.decision.keep{border-top-color:var(--green)}.decision .big{font:700 34px/1 Georgia,serif;margin:8px 0}.decision ul{margin:10px 0 0;padding-left:18px}.decision li{margin:5px 0}
    .chart{padding:22px}.bar-row{margin:13px 0}.bar-label{display:flex;gap:14px;justify-content:space-between;font-size:13px;margin-bottom:5px}.bar-label span{overflow-wrap:anywhere}.bar-label strong{color:var(--red);white-space:nowrap}.track{height:12px;background:#eeeae2;border-radius:9px;overflow:hidden}.bar{height:100%;background:linear-gradient(90deg,#d67364,var(--red));border-radius:9px}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff}table{border-collapse:collapse;width:100%;min-width:820px}th,td{padding:12px 13px;border-bottom:1px solid #e8e3da;text-align:left;vertical-align:top}th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:#f7f4ee;color:#66717c;position:sticky;top:0}td.num{text-align:right;white-space:nowrap}td.loss{color:var(--red);font-weight:700}tbody tr:last-child td{border-bottom:0}.note{font-size:13px;color:var(--muted);margin-top:10px}
    .source{font-size:13px;color:#4f5d69}.source a{color:var(--teal)}.pill{display:inline-block;padding:4px 9px;border-radius:999px;background:#e8f4f1;color:#1f6f68;font-size:12px;font-weight:700;margin-right:5px}
    .warn{background:#fff7e8;border:1px solid #efd9aa;border-radius:14px;padding:16px 18px;color:#614a23}.footer{margin-top:45px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
    @media(max-width:850px){.page{padding:26px 16px 52px}.kpis,.two{grid-template-columns:1fr 1fr}.lead{font-size:17px}}
    @media(max-width:560px){.kpis,.two{grid-template-columns:1fr}h1{font-size:38px}.bar-label{font-size:12px}.page{padding-left:12px;padding-right:12px}}
    @page{size:A4 landscape;margin:10mm}
    @media print{
      html,body{background:var(--paper);-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-size:12px}.page{max-width:none;margin:0;padding:0}.eyebrow{font-size:10px}
      h1{font-size:44px;max-width:820px;margin:7px 0 10px}h2{font-size:24px}h3{font-size:15px}.lead{font-size:15px;max-width:850px;margin-bottom:16px}.meta{font-size:10px}
      .kpis{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0 12px}.card{padding:14px;border-radius:12px;box-shadow:none}.kpi .value{font-size:24px}.kpi .label{font-size:10px}
      .callout{margin:10px 0 22px;padding:12px 15px;font-size:13px}.two{grid-template-columns:1.05fr .95fr;gap:12px}.steps{gap:8px}.step{padding:12px 12px 12px 48px;border-radius:10px}.step:before{left:12px;top:12px;width:25px;height:25px}.decision .big{font-size:26px}.warn{padding:11px 13px}
      section{margin-top:28px}.chart{padding:16px}.bar-row{margin:8px 0}.bar-label{font-size:10px}.track{height:9px}.table-wrap{overflow:visible;border-radius:10px}table{min-width:0;font-size:10px}th,td{padding:7px 8px}th{font-size:8px;position:static}
      .card,.step,.callout,.chart,.chart-section,.warn,.bar-row,tr{break-inside:avoid;page-break-inside:avoid}h1,h2,h3{break-after:avoid;page-break-after:avoid}thead{display:table-header-group}
      a{color:var(--teal);text-decoration:none}.footer{margin-top:28px}
    }
  </style>
</head>
<body>
<main class="page">
  <div class="eyebrow">WB Nimba · управленческое решение · 1–12 августа 2026</div>
  <h1>Маржу можно вернуть, но не одной кнопкой</h1>
  <p class="lead">Да, падение СПП повлияло. Но сильнее вырос сам КВВ. Реклама не является причиной убытка. Нужна точечная работа с ценами и остановка заведомо убыточных SKU — без общего повышения по всему ассортименту.</p>
  <div class="meta">Расчёт по локальной базе NimbaOS. Финансовый и рекламный периоды покрыты полностью; 3 450 строк отчёта уникальны.</div>

  <div class="grid kpis">
    <div class="card kpi"><div class="label">Операционная прибыль</div><div class="value bad">${signedRub(data.cabinet.operatingProfitRub)}</div><div class="label">маржа ${one.format(data.cabinet.marginPct)}%</div></div>
    <div class="card kpi"><div class="label">Фактическая комиссия</div><div class="value">${rub.format(data.cabinet.commissionRub)} ₽</div><div class="label">${one.format(data.cabinet.commissionPctOfPreSppSales)}% от базы до СПП</div></div>
    <div class="card kpi"><div class="label">Реклама</div><div class="value">${one.format(data.cabinet.adsRub)} ₽</div><div class="label">не объясняет убыток</div></div>
    <div class="card kpi"><div class="label">При июльской комиссии</div><div class="value good">${signedRub(data.cabinet.counterfactualAtJulyCommissionRate.operatingProfitRub)}</div><div class="label">контрфакт, маржа ${one.format(data.cabinet.counterfactualAtJulyCommissionRate.marginPct)}%</div></div>
  </div>

  <div class="callout"><strong>Главное:</strong> если применить к августовской базе июльскую эффективную комиссию ${one.format(data.cabinet.counterfactualAtJulyCommissionRate.julyEffectiveCommissionPct)}%, прибыль была бы около ${signedRub(data.cabinet.counterfactualAtJulyCommissionRate.operatingProfitRub)}. Это подтверждает, что переход в минус прежде всего связан с изменением КВВ/СПП, а не с рекламой.</div>

  <section>
    <h2>Что делать сейчас</h2>
    <div class="grid two">
      <div class="steps">
        <div class="step"><h3>Остановить утечку</h3><p>Временно ограничить продажи SKU, которым для нуля требуется рост реализованной цены больше 25%. Таких позиций 14. Исключение — осознанная распродажа остатков.</p></div>
        <div class="step"><h3>Запустить точечный ценовой тест</h3><p>На 17 убыточных позициях порог безубыточности находится в пределах +15%. Начать со ступени +7–10% к цене продавца / уменьшения скидки продавца и не затрагивать прибыльные карточки.</p></div>
        <div class="step"><h3>Через 3 полных дня пересчитать</h3><p>Смотреть не только заказы, но и среднюю реализованную цену, выкуп, КВВ, СПП, комиссию и операционную прибыль по SKU. Если объём держится, довести цену до расчётного порога плюс запас 3–5 п.п.</p></div>
        <div class="step"><h3>Параллельно проверить условия WB</h3><p>Сверить комиссию категории, «Конструктор тарифов», уровень продавца и новости тарифов. Поддержку WB имеет смысл спросить о скачке КВВ, но бизнес-решение нельзя строить на ожидании возврата старой СПП.</p></div>
      </div>
      <div class="card decision">
        <span class="pill">Сценарий при прежнем объёме</span>
        <div class="big">+${one.format(data.cabinet.breakEvenPriceIncreasePctStaticVolume)}%</div>
        <p>Такой рост средней реализованной цены по кабинету математически возвращает нулевую маржу.</p>
        <div class="big">+${one.format(data.cabinet.targetFivePctMarginPriceIncreasePctStaticVolume)}%</div>
        <p>Оценка для маржи около 5%.</p>
        <div class="warn"><strong>Не применять ко всем товарам.</strong> Сценарий не учитывает падение спроса и возможное изменение СПП. Поэтому — только ступенчатый тест по группам.</div>
      </div>
    </div>
  </section>

  <section class="chart-section">
    <h2>Где сосредоточен убыток</h2>
    <p>50 артикулов дали суммарно ${signedRub(-totalNegativeLoss)}, а прибыльные позиции компенсировали часть потерь. Первые 10 убыточных SKU формируют ${one.format(top10Share)}% всех отрицательных результатов.</p>
    <div class="card chart" role="img" aria-label="Топ-10 артикулов по операционному убытку">
      ${chartRows}
    </div>
  </section>

  <section>
    <h2>Первая волна ценового теста</h2>
    <p>17 SKU, где статический порог безубыточности не превышает 15%. В таблице последняя колонка — не готовая цена в кабинете WB, а эквивалент средней фактически реализованной цены.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Артикул</th><th>Продажи</th><th>ОП</th><th>Маржа</th><th>Порог цены</th><th>Реализованная цена: факт → ноль</th></tr></thead>
      <tbody>${tableRows(priceTest)}</tbody>
    </table></div>
  </section>

  <section>
    <h2>Ограничить в первую очередь</h2>
    <div class="grid two">
      <div class="card decision stop">
        <div class="big">${stopFirst.length} SKU</div>
        <p>Требуют роста реализованной цены более чем на 25%, чтобы только выйти в ноль. Для большинства это слишком высокий риск потери спроса.</p>
        <ul>${stopFirst.slice(0, 8).map((row) => `<li><strong>${esc(row.article)}</strong>: ${signedRub(row.operatingProfitRub)}, порог +${one.format(row.breakEvenPriceIncreasePctStaticVolume)}%</li>`).join('')}</ul>
      </div>
      <div class="card decision keep">
        <div class="big">${keep.length} SKU</div>
        <p>Уже дают маржу выше 5%. Их не надо поднимать «за компанию» и рисковать объёмом.</p>
        <ul>${keep.slice(0, 8).map((row) => `<li><strong>${esc(row.article)}</strong>: ${signedRub(row.operatingProfitRub)}, маржа ${one.format(row.marginPct)}%</li>`).join('')}</ul>
      </div>
    </div>
    <p class="note">Ещё ${noSales.length} позиций имеют затраты без продаж за период — их нужно разобрать отдельно по логистике/возвратам, а не лечить ценой.</p>
  </section>

  <section>
    <h2>Почему СПП всё-таки важна</h2>
    <p>В сравнении 1–12 июля и 1–12 августа средний КВВ вырос с 36,38% до 44,04% (+7,66 п.п.), а платформенная скидка снизилась с 35,17% до 30,43% (−4,73 п.п.). По разложению разницы примерно 62% ухудшения связано с ростом КВВ и 38% — с падением СПП.</p>
    <p>Официально WB пишет, что КВВ зависит от категории и скидки WB, а сама скидка WB устанавливается площадкой и может меняться. Фактические значения надо смотреть в детализации отчёта и разделе «Тарифы».</p>
  </section>

  <section>
    <h2>Контрольный лист через 3 дня</h2>
    <div class="grid two">
      <div class="card"><h3>Продолжать тест, если</h3><ul><li>средняя реализованная цена выросла;</li><li>заказы/выкуп не упали сильнее прироста вклада;</li><li>ОП на заказ и маржа стали лучше;</li><li>КВВ/СПП не ухудшились дополнительно.</li></ul></div>
      <div class="card"><h3>Остановить продажи SKU, если</h3><ul><li>после допустимого повышения ОП всё ещё отрицательная;</li><li>порог безубыточности выше 25%;</li><li>нет продаж, но продолжаются логистические расходы;</li><li>рост цены обрушил объём и ухудшил общий вклад.</li></ul></div>
    </div>
  </section>

  <section class="source">
    <h2>Источники и ограничения</h2>
    <p>Внутренние данные: <code>calculateReport</code> и ограниченная выборка детализации реализации из локальной БД NimbaOS за 01–12.07 и 01–12.08.2026; файл расчёта: <code>output/analysis/nimba_margin_response_2026-08-01_12.json</code>.</p>
    <p>Официальные материалы WB: <a href="https://seller.wildberries.ru/instructions/ru/by/material/wildberries-reward-ratio">Коэффициент вознаграждения Wildberries</a>, <a href="https://seller.wildberries.ru/instructions/ru/by/material/wb-discount?recommended=true">Скидка WB</a>, <a href="https://seller.wildberries.ru/instructions/ru/ru/material/fees-site-section?categoryId=introduction-to-sellers-portal&amp;goBackOption=prevRoute">Раздел «Тарифы»</a>, <a href="https://seller.wildberries.ru/instructions/ru/ru/material/how-to-read-fimancial-reports-detalization?categoryId=008ae04b-0568-467f-9033-f86bc1e3d379&amp;goBackOption=prevRoute">Детализация отчёта реализации</a>.</p>
    <p>Ценовой сценарий статический: сохраняет объём, возвраты, КВВ, СПП и рублёвые затраты; не моделирует эластичность спроса. Поэтому цифры используются как пороги для теста, а не как гарантия.</p>
  </section>
  <div class="footer">Сформировано ${new Date(data.generatedAt).toLocaleString('ru-RU')} · Изменения на WB не применялись.</div>
</main>
</body>
</html>`

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(outputPath, html, 'utf8')
console.log(outputPath)
