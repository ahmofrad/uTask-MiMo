module.exports = {
  ci: {
    collect: {
      startServerCommand: "pnpm start",
      startServerReadyPattern: "ready",
      url: [
        "http://localhost:3000/en-US/login",
        "http://localhost:3000/en-US/inbox",
        "http://localhost:3000/en-US/today",
        "http://localhost:3000/en-US/upcoming",
      ],
      numberOfRuns: 2,
      settings: {
        preset: "desktop",
        throttling: { cpuSlowdownMultiplier: 1 },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./lhci-reports",
    },
  },
};
