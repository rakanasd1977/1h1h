const fs = require('fs');
const path = require('path');
const { putObject } = require('../utils/s3');
const config = require('../config');
const { db } = require('../db');

const BACKUP_DIR = path.join(path.dirname(config.dbPath), 'backups');

// مصدر ضبط المزوّد السحابي المتوافق مع S3: Cloudflare R2 / Backblaze B2 / AWS.
// إن لم يُضبط كامل لم يُفعَّل الرصد السحابي (يُعيد { configured: false }).
function s3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const key = process.env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID;
  const secret = process.env.S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !key || !secret) return null;
  return {
    endpoint,
    bucket,
    key,
    secret,
    region: process.env.S3_REGION || 'us-east-1',
    prefix: process.env.S3_PREFIX || 'rafidain-backups',
  };
}

// مغلف مدمج للرفع إلى أي مزوّد متوافق مع S3 (R2/B2/AWS) مع امتداد التمرير إلى GCS إن ضُبط.
async function uploadToProvider(backupFile) {
  const s3 = s3Config();
  if (s3) {
    const data = fs.readFileSync(backupFile);
    const name = path.basename(backupFile);
    const res = await putObject(s3, { name, data });
    return { configured: true, provider: 's3', ...res };
  }

  // الرجوع إلى Google Cloud Storage الحالي إن ضُبط
  const bucket = process.env.GCS_BUCKET;
  const keyJson = process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS_JSON;
  if (bucket && keyJson) {
    let Storage;
    try {
      // @ts-ignore - @google-cloud/storage اختياري وغير مثبّت في بيئة التطوير
      ({ Storage } = await import('@google-cloud/storage'));
    } catch {
      throw new Error('مكتبة التخزين السحابي غير مثبّتة (@google-cloud/storage)');
    }
    const storage = new Storage({ credentials: JSON.parse(keyJson) });
    const dest = `rafidain-backups/${path.basename(backupFile)}`;
    await storage.bucket(bucket).file(dest).save(fs.readFileSync(backupFile));
    return { configured: true, provider: 'gcs', uri: `gs://${bucket}/${dest}`, uploaded_at: new Date().toISOString() };
  }

  return { configured: false };
}

// إرسال تنبيه عبر webhook (Slack/Telegram/...). يُتجاهل أي فشل في إرسال التنبيه نفسه.
async function alertWebhook(subject, detail, level = 'error') {
  const url = process.env.BACKUP_ALERT_WEBHOOK;
  if (!url) return;
  const payload =
    typeof url === 'string' && /slack/i.test(url)
      ? { text: `[${level}] ${subject}\n${String(detail).slice(0, 2000)}` }
      : { text: `[${level}] ${subject}\n${String(detail).slice(0, 2000)}`, level, subject, detail };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    console.error('[cloud-backup] webhook alert failed:', e.message);
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// إنشاء نسخة (بنقاط تفتيش WAL غير حاصرة) ثم رفعها إلى المزوّد المكوَّن.
async function runBackupToCloud() {
  try {
    db.exec('PRAGMA wal_checkpoint(PASSIVE);');
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const target = path.join(BACKUP_DIR, `app-${stamp()}.db`);
    fs.copyFileSync(config.dbPath, target);
    const walPath = config.dbPath + '-wal';
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, target + '-wal');

    const res = await uploadToProvider(target);
    if (!res.configured) {
      if (process.env.BACKUP_ALERT_WHEN_UNCONFIGURED === '1') {
        await alertWebhook('Backup cloud upload not configured', 'No S3 or GCS credentials set; skipped upload.', 'warn');
      }
      fs.unlinkSync(target);
      return { ok: false, configured: false, message: 'cloud backup not configured' };
    }

    // احتفاظ محلي وفق POLICY أو 7 افتراضي مشابه للصيانة
    const keep = Number(process.env.CLOUD_BACKUP_KEEP || 0);
    if (keep > 0) pruneLocal(target, keep);

    await alertWebhook('Backup uploaded successfully', `Uploaded ${path.basename(target)} -> ${res.uri}`, 'info');
    console.log(`[cloud-backup] uploaded ${path.basename(target)} (${res.provider})`);
    return { ok: true, ...res };
  } catch (e: any) {
    console.error('[cloud-backup] failed:', e.message);
    await alertWebhook('Backup FAILED', e.message, 'error');
    return { ok: false, error: e.message };
  }
}

function pruneLocal(newest, keep) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => /^app-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/.test(f))
      .sort();
    files.push(newest);
    while (files.length > keep) {
      const old = files.shift();
      if (old === newest) continue;
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch (e: any) {
    console.error('[cloud-backup] prune failed:', e.message);
  }
}

// الجدولة: تُشغَّل في الprimary مرة واحدة عند كل إقلاع مع فاصل زمني قابل للضبط
// (BACKUP_SCHEDULE_HOURS، المفترض 24). تُفعَّل فقط عندما يكون مزوّد سحابي مضبوطاً.
function startCloudBackupScheduler() {
  if (process.env.BACKUP_SCHEDULE_DISABLED === '1') return;
  const s3 = s3Config();
  const gcs = process.env.GCS_BUCKET && (process.env.GCS_CREDENTIALS_JSON || process.env.GOOGLE_CREDENTIALS_JSON);
  if (!s3 && !gcs) {
    console.log('[cloud-backup] scheduler: no cloud provider configured — disabled.');
    return;
  }
  const hours = Math.max(1, Number(process.env.BACKUP_SCHEDULE_HOURS) || 24);
  const delayMs = hours * 3600000;

  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    runBackupToCloud().finally(() => { running = false; });
  };

  setTimeout(tick, 30000); // أول رصد بعد 30 ثانية من الإقلاع
  setInterval(tick, delayMs).unref();
  console.log(`[cloud-backup] scheduler started: every ${hours}h.`);
}

module.exports = { runBackupToCloud, uploadToProvider, s3Config, startCloudBackupScheduler, alertWebhook };