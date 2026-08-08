{{- if .Values.app.podDisruptionBudget.enabled }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "taskapp.fullname" . }}-app
  labels:
    {{- include "taskapp.labels" . | nindent 4 }}
    app.kubernetes.io/component: app
spec:
  minAvailable: {{ .Values.app.podDisruptionBudget.minAvailable }}
  selector:
    matchLabels:
      {{- include "taskapp.selectorLabels" . | nindent 6 }}
      app.kubernetes.io/component: app
{{- end }}
