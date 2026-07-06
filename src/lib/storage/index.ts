import { S3Client } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;
let _bucket: string | null = null;

function getConfig() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error("S3 configuration missing: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET must all be set");
  }

  return { endpoint, accessKey, secretKey, bucket };
}

export function getS3Client(): S3Client {
  if (!_client) {
    const config = getConfig();
    _client = new S3Client({
      endpoint: config.endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
  }
  return _client;
}

export function getBucket(): string {
  if (!_bucket) {
    _bucket = getConfig().bucket;
  }
  return _bucket;
}
