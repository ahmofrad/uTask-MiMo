import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    })
  : undefined;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "taskapp",
  }),
  ...(traceExporter ? { traceExporter } : {}),
});

if (process.env.OTEL_ENABLED === "true") {
  sdk.start();
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .catch((err) => console.error("Error shutting down OpenTelemetry", err));
  });
}

export { sdk };
