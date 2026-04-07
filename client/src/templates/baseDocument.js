export function buildDocument(title, bodyHTML) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Be Vietnam Pro", sans-serif; font-size: 13px;
           color: #1a1a1a; padding: 32px; max-width: 720px; margin: 0 auto; }

    .hostel-name { font-size: 22px; font-weight: 700; color: #1a5c2a; }
    .hostel-meta { font-size: 12px; color: #444; margin-top: 4px; }
    hr.divider { border: none; border-top: 2px solid #1a5c2a; margin: 12px 0; }

    .doc-title { text-align: center; font-size: 16px; font-weight: 700;
                 text-transform: uppercase; margin: 16px 0 8px; }
        .doc-title-vi { text-align: center; font-size: 12px; font-style: italic;
            color: #666; margin-bottom: 14px; }
    .doc-badge { text-align: center; background: #1a5c2a; color: white;
                 padding: 4px 16px; border-radius: 4px;
                 font-size: 12px; margin-bottom: 16px; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr;
                 gap: 4px 16px; margin-bottom: 16px; font-size: 12.5px; }
    .info-grid span { color: #555; }
        .info-item { display: grid; grid-template-columns: 1fr auto; gap: 0 12px;
            align-items: start; padding: 4px 0; }
        .info-item .value { grid-column: 2; grid-row: 1 / span 2; text-align: right; }
        .label-en { font-weight: 600; font-size: 13px; color: #1a1a1a; }
        .label-vi { font-size: 11px; font-style: italic; color: #666; margin-bottom: 2px; }
        .value { font-size: 13px; color: #1a1a1a; }

    table { width: 100%; table-layout: fixed; border-collapse: collapse;
            margin-bottom: 12px; }
    th { background: #1a5c2a; color: white; padding: 7px 8px;
         font-size: 12px; text-align: left; }
        .th-en { display: block; font-size: 12px; font-weight: 600; }
        .th-vi { display: block; font-size: 10px; font-weight: 400; opacity: 0.85;
           font-style: italic; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5;
         font-size: 12.5px; vertical-align: top; }
    td.amount { text-align: right; white-space: nowrap;
                letter-spacing: 0; font-variant-numeric: tabular-nums; }
        tr.discount-row td { color: #dc2626; }
        tr.discount-row td.amount::before { content: "−"; margin-right: 2px; }
    tr.total-row td { font-weight: 700; background: #f0fdf4; }
    tr.due-row td { font-weight: 700; font-size: 14px;
                    background: #1a5c2a; color: white; }

    .summary { width: 100%; margin-left: auto; margin-bottom: 16px; }
    .summary-row { display: flex; justify-content: space-between;
                   padding: 5px 10px; border-bottom: 1px solid #e5e5e5;
                   font-size: 13px; }
    .summary-row.total { font-weight: 700; background: #f0fdf4; }
    .summary-row.due { font-weight: 700; font-size: 15px;
                       background: #1a5c2a; color: white; }

    .box { border: 1px solid #d1d5db; border-radius: 6px;
           padding: 14px 16px; margin-bottom: 12px; }
    .box-title { font-weight: 700; margin-bottom: 8px; color: #1a5c2a; }
        .box-title-vi { display: block; font-size: 11px; font-weight: 400;
              font-style: italic; color: #555; margin-top: 2px; }
    .box.deposit-highlight { background: #f0fdf4; border-color: #1a5c2a;
                             text-align: center; padding: 16px; }
    .deposit-amount { font-size: 20px; font-weight: 700; color: #1a5c2a; }
    .box.warning { background: #fef3c7; border-color: #f59e0b; }
    .box.warning p { color: #b45309; font-size: 12.5px; }
    .box.bank { display: flex; justify-content: space-between;
                align-items: center; gap: 16px; }
        .vi-note { display: block; font-size: 11px; font-style: italic;
         color: #555; margin-top: 2px; }
        .notes-list { padding-left: 18px; }
        .notes-list li { margin-bottom: 8px; }

    .watermark { position: fixed; top: 50%; left: 50%;
                 transform: translate(-50%, -50%) rotate(-30deg);
                 font-size: 64px; font-weight: 900; opacity: 0.07;
                 color: #1a5c2a; pointer-events: none; z-index: 0; }
    .content { position: relative; z-index: 1; }

    .doc-footer { text-align: center; margin-top: 24px;
                  font-size: 12px; color: #888; font-style: italic; }
    .doc-footer .footer-en { display: block; font-size: 12px; color: #666;
                 font-style: normal; }
    .doc-footer .vi-note { color: #777; }

    .print-btn { position: fixed; bottom: 24px; right: 24px;
                 background: #1a5c2a; color: white; border: none;
                 padding: 10px 20px; border-radius: 6px;
                 font-size: 14px; cursor: pointer; z-index: 999; }
    @media print {
      .print-btn { display: none; }
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  <div class="content">
    ${bodyHTML}
  </div>
</body>
</html>`
}