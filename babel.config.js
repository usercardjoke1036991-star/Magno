module.exports = {
  presets: [
    [
      'babel-preset-expo',
      {
        // Enable the unstable TransformImportMeta polyfill required by some packages
        // (e.g. valtio) when running on Hermes / React Native.
        unstable_transformImportMeta: true,
      },
    ],
  ],
};
