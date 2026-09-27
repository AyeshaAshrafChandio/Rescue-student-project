import crypto from 'crypto';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  bytes: number;
  format: string;
  createdAt: string;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

export async function checkCloudinaryStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  cloudName?: string;
  status?: string;
  error?: string;
}> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return { configured: false, connected: false };
  }

  try {
    const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        configured: true,
        connected: false,
        cloudName,
        error: `Cloudinary ping returned ${res.status}: ${text}`,
      };
    }
    const data = await res.json();
    return {
      configured: true,
      connected: data?.status === 'ok',
      cloudName,
      status: data?.status || 'ok',
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      cloudName,
      error: err?.message || 'Cloudinary ping failed',
    };
  }
}

/**
 * Uploads a project rescue report or snapshot JSON/archive to Cloudinary
 * using the standard signed REST API.
 */
export async function uploadSnapshotToCloudinaryFree(
  projectId: string,
  fileName: string,
  content: string
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const publicId = `rescue_${projectId}_${timestamp}_${safeName}`;

  // Cloudinary signature: alphabetical parameters + apiSecret hashed with SHA-1
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  const base64Data = Buffer.from(content, 'utf-8').toString('base64');
  const dataUri = `data:application/json;base64,${base64Data}`;

  const formBody = new URLSearchParams({
    file: dataUri,
    api_key: apiKey,
    timestamp: String(timestamp),
    public_id: publicId,
    signature,
  });

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 403 && errText.includes('actions=["create"]')) {
      throw new Error(
        `Cloudinary authenticated with cloud "${cloudName}", but API key ${apiKey.slice(
          0,
          6
        )}... is restricted from "create" upload actions in Cloudinary Console > Settings > Access Keys. Enable the "create" permission on your Cloudinary API key or use Download Rescued Project (.ZIP).`
      );
    }
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    url: data.url,
    secureUrl: data.secure_url,
    publicId: data.public_id,
    bytes: data.bytes || content.length,
    format: data.format || 'json',
    createdAt: data.created_at || new Date().toISOString(),
  };
}
