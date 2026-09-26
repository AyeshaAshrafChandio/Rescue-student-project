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
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Uploads a project rescue report or snapshot JSON/archive to Cloudinary Free Tier
 * using the standard signed REST API (no paid SDK or billing required).
 */
export async function uploadSnapshotToCloudinaryFree(
  projectId: string,
  fileName: string,
  content: string
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary Free Tier credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'student_project_rescue';
  const publicId = `rescue_${projectId}_${timestamp}`;

  // Cloudinary signature: alphabetical parameters + apiSecret hashed with SHA-1
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
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
    folder,
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
    throw new Error(`Cloudinary Free Tier upload failed (${res.status}): ${errText}`);
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
