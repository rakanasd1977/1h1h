// تخزين مستندات توثيق المزودين: مجلد مركزي واحد لكل مزود data/docs/<providerId>/.
// كل صورة تُضغط (WebP جودة 80، أكبر ضلع 1600px، بلا تكبير) حتى لا تأخذ مساحة كبيرة،
// والمسار /docs لا يُقدَّم عاماً إطلاقاً — الوثائق تُقدَّم فقط عبر مسارات مصادقة.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { ApiError } = require('./helpers');
const { validateImageBuffer, uploadFilePath } = require('./uploads');

const DOCS_DIR = path.join(__dirname, '../../data/docs');
const MAX_DOC_BYTES = 8 * 1024 * 1024;
const MAX_DOC_DIM = 1600;
const WEBP_QUALITY = 80;

// فك رموز data:image/...;base64، التحقق من الصيغة والمحتوى، ثم ضغط الصورة وحفظها
// في مجلد المزوّد المركزي. يُعيد مرجع /docs/<providerId>/<file>.
async function saveProviderDoc(providerId, dataUri, opts: any = {}) {
  const maxBytes = opts.maxBytes || MAX_DOC_BYTES;
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(dataUri || '').trim());
  if (!m) throw new ApiError(400, 'صيغة غير صالحة — أرسل الصورة بصيغة data:image/...;base64');
  const mime = m[1].toLowerCase();
  if (!mime.startsWith('image/')) throw new ApiError(400, 'يُقبل ملفات الصور فقط');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0) throw new ApiError(400, 'الملف فارغ');
  if (buf.length > maxBytes) throw new ApiError(400, `حجم الصورة يتجاوز الحد الأقصى (${Math.round(maxBytes / 1024 / 1024)}MB)`);
  validateImageBuffer(buf, mime);

  // الضغط: تصحيح الاتجاه تلقائياً + تحجيم لأقصى ضلع 1600px بلا تكبير + WebP جودة 80
  const out = await sharp(buf)
    .rotate()
    .resize(MAX_DOC_DIM, MAX_DOC_DIM, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  if (out.length === 0) throw new ApiError(500, 'تعذّر ضغط الصورة');

  const pid = String(Number(providerId) || 0);
  const dir = path.join(DOCS_DIR, pid);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.webp`;
  fs.writeFileSync(path.join(dir, filename), out);
  return { url: `/docs/${pid}/${filename}`, filename, filePath: path.join(dir, filename), bytes: out.length };
}

// مسار ملف صالح داخل مجلد مستندات المزوّد المحدد فقط (منع الخروج منه بأسماء ضارة)
function providerDocFilePath(ref) {
  const m = /^\/docs\/(\d+)\/([A-Za-z0-9._-]+)$/.exec(String(ref || '').trim());
  if (!m) return null;
  const base = path.resolve(DOCS_DIR, m[1]);
  const abs = path.resolve(base, m[2]);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

// يقرأ مرجع المستند الحديث (/docs/...) أو القديم (/uploads/...) بأمان
function resolveDocRef(ref) {
  return providerDocFilePath(ref) || uploadFilePath(ref);
}

const DOC_REF_RE = /\/docs\/\d+\/[A-Za-z0-9._-]+/g;

function extractDocRefs(value) {
  if (value === null || value === undefined) return [];
  const s = String(value);
  const re = new RegExp(DOC_REF_RE.source, 'g');
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[0]);
  return out;
}

function deleteProviderDoc(ref) {
  const abs = providerDocFilePath(ref);
  if (!abs) return;
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch (e: any) { /* تجاهل */ }
}

function deleteProviderDocValue(value) {
  for (const ref of extractDocRefs(value)) deleteProviderDoc(ref);
}

// حذف مستندات المزوّد القديمة غير الموجودة في الجديدة (عند استبدال مستند)
function deleteRemovedProviderDocs(oldValue, newValue) {
  const kept = new Set(extractDocRefs(newValue));
  for (const ref of extractDocRefs(oldValue)) {
    if (!kept.has(ref)) deleteProviderDoc(ref);
  }
}

// نوع MIME حسب الامتداد (WebP هو الصيغة الأساسية بعد الضغط)
function extToMime(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  return null;
}

// تقديم مستند مستخدم عبر res (لتوجيه /api/providers/:id/documents/:field و/أو /api/provider/documents/:field).
// يُعيد false إن كان المرجع غير موجود — يُرفع الخطأ من الناصب بعدها.
function serveDocRef(res, ref) {
  const abs = resolveDocRef(ref);
  if (!abs || !fs.existsSync(abs)) return false;
  const ext = path.extname(abs).toLowerCase().slice(1);
  const mime = extToMime(ext) || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(abs)}"`);
  const stream = fs.createReadStream(abs);
  stream.on('error', () => res.status(404).end());
  stream.pipe(res);
  return true;
}

module.exports = {
  DOCS_DIR,
  MAX_DOC_BYTES,
  MAX_DOC_DIM,
  WEBP_QUALITY,
  saveProviderDoc,
  providerDocFilePath,
  resolveDocRef,
  extractDocRefs,
  deleteProviderDoc,
  deleteProviderDocValue,
  deleteRemovedProviderDocs,
  serveDocRef,
};