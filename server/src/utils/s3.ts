const crypto = require('crypto');

// تنفيذ توقيع AWS Signature Version 4 للملف المراد رفعه إلى مزوّد متوافق مع S3
// (Cloudflare R2، Backblaze B2، Amazon S3...). يعتمد على fetch المدمج في Node، بلا مكتبات إضافية.

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function hmacHex(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

// إرجاع significant subset من التواجد لحساب الطلب الموقّع
function canonicalHeaders(headers) {
  return Object.keys(headers)
    .sort()
    .map((k) => `${k.toLowerCase()}:${String(headers[k]).trim()}\n`)
    .join('');
}

function signedHeaderNames(headers) {
  return Object.keys(headers).map((k) => k.toLowerCase()).sort().join(';');
}

// توليد عنوان Authorization منسّق لنطاق التوقيع
function buildAuthHeader({ method, url, headers, bodyHash, key, secret, region, service, now }) {
  const host = new URL(url).host;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const allHeaders = { host, 'x-amz-date': amzDate, ...headers };

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequest = [
    method,
    new URL(url).pathname,
    new URL(url).search,
    canonicalHeaders(allHeaders),
    signedHeaderNames(allHeaders),
    bodyHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmacHex(kSigning, stringToSign);

  return `AWS4-HMAC-SHA256 Credential=${key}/${credentialScope}, SignedHeaders=${signedHeaderNames(allHeaders)}, Signature=${signature}`;
}

// رفع محتوى (سلسلة/Buffer) إلى كائن في مزوّد متوافق مع S3.
// config: { endpoint, bucket, key, secret, region, prefix }
async function putObject({ endpoint, bucket, key: accessKey, secret, region = 'us-east-1', prefix = '' }, { name, data }) {
  const objectKey = prefix ? `${prefix}/${name}` : name;
  const url = `${endpoint.replace(/\/+$/, '')}/${bucket}/${objectKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const bodyHash = sha256(data);
  const headers = {
    'x-amz-content-sha256': bodyHash,
    'Content-Type': 'application/octet-stream',
  };

  const authorization = buildAuthHeader({
    method: 'PUT',
    url,
    headers,
    bodyHash,
    key: accessKey,
    secret,
    region,
    service: 's3',
    now,
  });

  const finalHeaders = {
    Authorization: authorization,
    ...headers,
    'x-amz-date': amzDate,
    'Content-Length': String(Buffer.byteLength(data)),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: finalHeaders,
      body: data,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 upload failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
  }

  return { uri: `${url.replace(/\/$/, '')}`, objectKey, uploaded_at: new Date().toISOString() };
}

module.exports = { putObject, buildAuthHeader };