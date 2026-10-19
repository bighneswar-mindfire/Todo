export default {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      // type(scope): description AB#1234
      headerPattern: /^(\w+)(?:\(([^)]*)\))?!?: (.+) AB#(\d+)$/,
      headerCorrespondence: ["type", "scope", "subject", "ticket"],
    },
  },
};
