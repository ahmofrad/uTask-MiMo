import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getBucket } from "./index";

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
