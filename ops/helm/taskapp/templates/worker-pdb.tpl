{{- if .Values.worker.podDisruptionBudget.enabled }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "taskapp.fullname" . }}-worker
  labels:
    {{- include "taskapp.labels" . | nindent 4 }}
    app.kubernetes.io/component: worker
spec:
  minAvailable: {{ .Values.worker.podDisruptionBudget.minAvailable }}
  selector:
    matchLabels:
      {{- include "taskapp.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: worker
{{- end }}
