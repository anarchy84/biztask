// 한글 주석: Babel 설정
// ▣ 핵심 포인트:
//   - babel-preset-expo: Expo 표준 프리셋 (expo-router 자동 포함)
//   - module-resolver: "@/" 경로 alias 사용 가능하게 (예: '@/lib/types')
//     → tsconfig.json의 paths랑 맞춰야 TS·빌드 둘 다 동작
//   - react-native-reanimated/plugin은 항상 마지막에 배치 (공식 요구사항)

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
