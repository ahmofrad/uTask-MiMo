import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucket } from "./index";

export async function removeObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}
