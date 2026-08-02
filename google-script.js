/**
 * ============================================================
 *  GUD Autoserviss — заявки с сайта приходят на почту в Excel
 * ============================================================
 *  Что делает:
 *    • получает заявку с сайта;
 *    • пишет её в общий журнал (Google-таблица, создаётся сама);
 *    • отправляет письмо СРАЗУ ОБОИМ адресам из списка TO,
 *      с файлом .xlsx этой заявки во вложении.
 *
 *  КАК ПОДКЛЮЧИТЬ (5 минут, один раз):
 *    1) Зайди на https://script.google.com  → New project
 *    2) Удали то, что там есть, и вставь весь этот файл
 *    3) Кнопка Deploy → New deployment → шестерёнка → Web app
 *         Execute as:      Me
 *         Who has access:  Anyone            ← обязательно
 *       Deploy → разреши доступ к аккаунту (Allow)
 *    4) Скопируй ссылку вида https://script.google.com/macros/s/..../exec
 *    5) Вставь её в index.html в блок MAIL → поле url
 *
 *  ПРОВЕРКА: выбери сверху функцию testSend и нажми Run —
 *  на обе почты должно прийти тестовое письмо с вложением.
 *
 *  ЕСЛИ МЕНЯЕШЬ КОД ПОЗЖЕ: Deploy → Manage deployments →
 *  карандаш → Version: New version → Deploy. Ссылка не меняется.
 * ============================================================
 */

/* ---------- НАСТРОЙКИ (меняй только здесь) ---------- */

// Кому присылать заявки. Можно добавить сколько угодно адресов через запятую.
var TO = [
  'jurov20@gmail.com',
  'mr.conturix@gmail.com'
];

// Простая защита от чужих запросов. Точно такая же строка должна стоять
// в index.html → MAIL.secret. Можешь придумать свою.
var SECRET = 'gud-2026';

var SUBJECT = 'Новая заявка с сайта — GUD Autoserviss';

var HEADERS = [
  'Дата заявки',
  'Услуга',
  'Желаемая дата',
  'Имя и фамилия',
  'Телефон',
  'Авто',
  'Комментарий'
];

/* ---------- ДАЛЬШЕ МЕНЯТЬ НЕ НУЖНО ---------- */

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (SECRET && d.secret !== SECRET) return out({ ok: false, error: 'forbidden' });

    var tz = Session.getScriptTimeZone();
    var row = [
      Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'),
      d.service || '',
      d.visit_date || '',
      d.name || '',
      d.phone || '',
      d.car || '',
      d.comment || ''
    ];

    appendToLog(row);
    var xlsx = buildXlsx(row, d);

    // отдельное письмо каждому адресу — так ни одно не потеряется
    var sent = [], failed = [];
    for (var i = 0; i < TO.length; i++) {
      var addr = String(TO[i]).trim();
      if (!addr) continue;
      try {
        MailApp.sendEmail({
          to: addr,
          subject: SUBJECT + (d.name ? ' — ' + d.name : ''),
          body: textBody(row),
          htmlBody: htmlBody(row),
          attachments: [xlsx],
          name: 'GUD Autoserviss'
        });
        sent.push(addr);
      } catch (mailErr) {
        failed.push(addr + ': ' + mailErr);
      }
    }
    Logger.log('Отправлено: ' + sent.join(', ') + (failed.length ? ' | ОШИБКИ: ' + failed.join(' ; ') : ''));

    return out({ ok: failed.length === 0, sent: sent, failed: failed });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// чтобы при открытии ссылки в браузере не было ошибки
function doGet() {
  return ContentService.createTextOutput('GUD booking mailer: OK');
}

/** Общий журнал всех заявок — одна таблица на Диске, дописывается строками. */
function appendToLog(row) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('LOG_ID');
  var ss = null;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('GUD — заявки с сайта');
    var sh0 = ss.getActiveSheet();
    sh0.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh0.setFrozenRows(1);
    props.setProperty('LOG_ID', ss.getId());
  }
  ss.getActiveSheet().appendRow(row);
}

/** Файл .xlsx с одной заявкой — уходит во вложении письма. */
function buildXlsx(row, d) {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm');
  var name = 'Заявка ' + (d.name || 'без имени') + ' ' + stamp;

  var ss = SpreadsheetApp.create(name);
  var sh = ss.getActiveSheet();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sh.getRange(2, 1, 1, row.length).setValues([row]);
  sh.autoResizeColumns(1, HEADERS.length);
  SpreadsheetApp.flush();

  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  var blob = UrlFetchApp
    .fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } })
    .getBlob()
    .setName(name + '.xlsx');

  DriveApp.getFileById(ss.getId()).setTrashed(true); // временный файл в корзину
  return blob;
}

function textBody(r) {
  return HEADERS.map(function (h, i) { return h + ': ' + (r[i] || '—'); }).join('\n');
}

function htmlBody(r) {
  var rows = HEADERS.map(function (h, i) {
    return '<tr>' +
      '<td style="padding:7px 14px;color:#777;white-space:nowrap;border-bottom:1px solid #eee">' + h + '</td>' +
      '<td style="padding:7px 14px;font-weight:600;border-bottom:1px solid #eee">' + esc(r[i] || '—') + '</td>' +
      '</tr>';
  }).join('');

  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">' +
    '<h2 style="margin:0 0 14px;font-size:18px">Новая заявка с сайта</h2>' +
    '<table style="border-collapse:collapse;border:1px solid #e6e6e6">' + rows + '</table>' +
    '<p style="color:#999;font-size:12px;margin-top:16px">Та же заявка в формате Excel — во вложении.</p>' +
    '</div>';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Тест: нажми Run на этой функции — придёт письмо на все адреса из TO. */
function testSend() {
  doPost({
    postData: {
      contents: JSON.stringify({
        secret: SECRET,
        service: 'Замена масла',
        visit_date: '2026-08-10',
        name: 'Тест Тестов',
        phone: '+371 20 000 000',
        car: 'VW Passat 2015',
        comment: 'Проверка отправки писем'
      })
    }
  });
}
