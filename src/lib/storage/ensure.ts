import {
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getS3Client, getBucket } from "./index";
import { logger } from "@/lib/logging";

export async function ensureBucket(): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === "NotFound" || error.name === "NoSuchBucket") {
      logger.info({ bucket }, "Creating S3 bucket");
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } else {
      throw err;
    }
  }
}
