export default {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      // type: description   (an optional (scope) after the type is accepted)
      headerPattern: /^(\w+)(?:\(([^)]*)\))?!?: (.+)$/,
      headerCorrespondence: ["type", "scope", "subject"],
    },
  },
};
